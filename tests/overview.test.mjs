import assert from "node:assert/strict";
import test from "node:test";
import { capitalUtilisation, previewGroups } from "../src/features/dashboard/overview.ts";
import { buildBrokerRows } from "../src/features/dashboard/aggregate.ts";

test("overview utilisation uses used plus available, with no invented percentage for unfunded accounts", () => {
  assert.equal(capitalUtilisation(400, 600), 60);
  assert.equal(capitalUtilisation(0, 100), 100);
  assert.equal(capitalUtilisation(100, 0), 0);
  assert.equal(capitalUtilisation(0, 0), null);
  assert.equal(capitalUtilisation(-100, 100), null);
  assert.equal(capitalUtilisation(100, -10), null);
  assert.equal(capitalUtilisation(NaN, 100), null);
  assert.equal(capitalUtilisation(100, Infinity), null);
});

test("negative available capital stays visibly over-utilised rather than capped to 100 percent", () => {
  assert.equal(capitalUtilisation(-200, 1000), 125);
});

test("overview preview keeps identical symbols in different accounts separate and does not mutate input", () => {
  const second = { broker: "kite", connectionId: "kite-b", symbol: "ABC", qty: 10, pnl: -20 };
  const first = { broker: "kite", connectionId: "kite-a", symbol: "ABC", qty: 10, pnl: 40 };
  const extra = { broker: "kite", connectionId: "kite-a", symbol: "XYZ", qty: -5, pnl: -10 };
  const input = Object.freeze([Object.freeze(second), Object.freeze(first), Object.freeze(extra)]);
  const groups = previewGroups(input);
  assert.deepEqual(groups.map((group) => [group.connectionId, group.items.length, group.pnl]), [
    ["kite-a", 2, 30], ["kite-b", 1, -20],
  ]);
  assert.equal(groups[0].items[0], first);
  assert.equal(input[0], second);
});

test("holdings preview uses the API total and never adds pledged shares again", () => {
  const item = { broker: "kite", connectionId: "kite-a", symbol: "ABC", qty: 100, pledgedQty: 80, currentValue: 20000, pnl: 5000 };
  const [group] = previewGroups([item]);
  assert.equal(group.pnl, 5000);
  assert.equal(group.items.reduce((sum, holding) => sum + holding.currentValue, 0), 20000);
  assert.equal(group.items[0].qty, 100);
});

test("overview keeps missing margins null and preserves separate day and since-entry P&L", () => {
  const { rows, totals } = buildBrokerRows(
    [{ broker: "kite", connectionId: "kite-a", pnl: 100, dayChange: -25 },
      { broker: "kite", connectionId: "kite-b", pnl: -50, dayChange: 10 }],
    [{ broker: "kite", connectionId: "kite-a", pnl: 400 }],
    [{ broker: "kite", connectionId: "kite-a", available: 400, used: 600, total: 9999, collateral: 80 }],
  );
  assert.equal(rows[1].margin, null);
  assert.equal(rows[0].positionsPnl, 100);
  assert.equal(rows[0].holdingsPnl, 400);
  assert.equal(totals.totalPnl, 450);
  assert.equal(totals.dayPnl, -15);
  assert.equal(capitalUtilisation(totals.available, totals.used), 60);
});

test("empty overview input has no fabricated account groups", () => {
  assert.deepEqual(previewGroups([]), []);
  assert.deepEqual(buildBrokerRows([], [], []).rows, []);
});
