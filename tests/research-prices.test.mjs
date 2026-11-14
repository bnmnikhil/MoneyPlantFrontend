import test from "node:test";
import assert from "node:assert/strict";
import {
  averageDelivery, axisTicks, dayMove, daysInRange, priceFigures, pricePoints, sharesAxisLabel, sharesLabel, tickLabel,
} from "../src/features/research/prices.ts";

test("the date axis labels each month once over a year, and spreads about six labels over a month", () => {
  const ticks = axisTicks(year, "1Y");
  const months = ticks.map((d) => d.slice(0, 7));
  assert.equal(new Set(months).size, months.length, "no month twice");
  assert.ok(ticks.length >= 11 && ticks.length <= 12);
  assert.ok(!ticks.includes(year[0].date), "the partial first month gets no label");
  const month = daysInRange(year, "1M");
  const few = axisTicks(month, "1M");
  assert.ok(few.length >= 4 && few.length <= 7);
  assert.equal(sharesAxisLabel(30e7), "30 cr");
  assert.equal(sharesAxisLabel(4_521_000), "45 L");
});

const day = (date, over = {}) => ({
  date, open: 100, high: 105, low: 95, close: 100, prevClose: 100,
  volume: 1_000_000, deliveryQty: 500_000, deliveryPct: 50, ...over,
});

// A year of weekdays-ish: every third day from 15 Nov 2025 to 13 Nov 2026.
const year = [];
for (let t = Date.parse("2025-11-15"); t <= Date.parse("2026-11-13"); t += 3 * 86_400_000) {
  year.push(day(new Date(t).toISOString().slice(0, 10)));
}

test("a range counts back in calendar days from the latest stored day", () => {
  const month = daysInRange(year, "1M");
  assert.ok(month.length >= 9 && month.length <= 11);
  assert.equal(month[month.length - 1].date, year[year.length - 1].date);
  assert.ok(Date.parse(month[0].date) > Date.parse(year[year.length - 1].date) - 30 * 86_400_000);
  assert.equal(daysInRange(year, "1Y").length, year.length);
  assert.deepEqual(daysInRange([], "1Y"), []);
});

test("volume splits into delivered and not delivered, and a missing delivery leaves the whole bar undelivered", () => {
  const [known, unknown, odd] = pricePoints([
    day("2026-11-11", { volume: 2_000, deliveryQty: 1_500 }),
    day("2026-11-12", { volume: 2_000, deliveryQty: null, deliveryPct: null }),
    day("2026-11-13", { volume: 2_000, deliveryQty: 2_500 }),
  ]);
  assert.deepEqual([known.delivered, known.notDelivered], [1_500, 500]);
  assert.deepEqual([unknown.delivered, unknown.notDelivered], [null, 2_000]);
  assert.deepEqual([odd.delivered, odd.notDelivered], [2_000, 0], "never more delivered than traded");
});

test("delivery averages are plain means over the days that state one", () => {
  const days = [day("2026-11-10", { deliveryPct: 40 }), day("2026-11-11", { deliveryPct: null }), day("2026-11-12", { deliveryPct: 60 })];
  assert.equal(averageDelivery(days), 50);
  assert.equal(averageDelivery(days, 1), 60);
  assert.equal(averageDelivery([day("2026-11-12", { deliveryPct: null })]), null);
});

test("the figures: change over the range, its high and low, and delivery today against its averages", () => {
  const days = [
    day("2026-10-14", { close: 200, high: 210, low: 190, deliveryPct: 40 }),
    day("2026-11-12", { close: 250, high: 260, low: 230, deliveryPct: 60 }),
    day("2026-11-13", { close: 220, high: 255, low: 215, deliveryPct: 70 }),
  ];
  const f = priceFigures(days, "1M");
  assert.equal(f.close, "₹220.00");
  assert.equal(f.asOf, "13 Nov 2026");
  assert.equal(f.change, "+10.00%");
  assert.equal(f.changeTone, "up");
  assert.deepEqual([f.high, f.low], ["₹260.00", "₹190.00"]);
  assert.deepEqual([f.deliveryToday, f.delivery20, f.deliveryRange], ["70.0%", "56.7%", "56.7%"]);
  assert.equal(f.shortNote, null);
  assert.equal(priceFigures([], "1Y"), null);
});

test("a range longer than what is stored says where the stored days begin", () => {
  const f = priceFigures([day("2026-10-01"), day("2026-11-13")], "1Y");
  assert.equal(f.shortNote, "From 1 Oct 2026, the first day stored");
  assert.equal(priceFigures(year, "1Y").shortNote, null, "a full year is not short");
});

test("labels: shares in Indian units, ticks by range, the day's move signed with a real minus", () => {
  assert.equal(sharesLabel(18_677_205), "1.87 cr");
  assert.equal(sharesLabel(4_521_000), "45.2 L");
  assert.equal(sharesLabel(9_876), "9,876");
  assert.equal(sharesLabel(null), "—");
  assert.equal(tickLabel("2026-11-09", "1M"), "9 Nov");
  assert.equal(tickLabel("2026-11-09", "1Y"), "Nov 26");
  assert.equal(dayMove({ close: 278.8, prevClose: 283.45 }), "−1.64%");
  assert.equal(dayMove({ close: 285, prevClose: null }), "—");
});
