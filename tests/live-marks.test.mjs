import test from "node:test";
import assert from "node:assert/strict";
import { applyLiveMarks, liveTitle } from "../src/features/positions/liveMarks.ts";

const KEY = "NIFTY|2026-11-25|23000|CE";
const row = (over = {}) => ({
  broker: "kite", connectionId: "u:kite:default", symbol: "NIFTY25NOV23000CE",
  underlying: "NIFTY", underlyingLabel: "NIFTY", instrumentType: "CE",
  contract: { strike: 23000, expiry: "2026-11-25", lotSize: 65 }, quoteKey: KEY,
  product: "NRML", qty: -65, avgPrice: 120, ltp: 100, priceKnown: true,
  pnl: 1300, realisedPnl: 0, dayChange: -200, ...over,
});
const book = (...items) => ({ items, warnings: [] });
const live = (price, source = "paytm") => new Map([[KEY, { price, change: null, changePercent: null, source }]]);

test("a live price shifts the broker's own P&L and day P&L by the move", () => {
  // Short 65 at a mark of 100 moving to 98: the short gains 65 × 2 = 130.
  const [p] = applyLiveMarks(book(row()), live(98)).items;
  assert.equal(p.ltp, 98);
  assert.equal(p.pnl, 1430);
  assert.equal(p.dayChange, -70);
});

test("each batch applies to the polled row, so moves never accumulate", () => {
  const polled = book(row());
  applyLiveMarks(polled, live(98));
  const [p] = applyLiveMarks(polled, live(101)).items;
  assert.equal(p.pnl, 1300 - 65);
  assert.equal(polled.items[0].ltp, 100);
});

test("a row the poll could not price becomes realised plus the open leg at the live price", () => {
  const [p] = applyLiveMarks(book(row({ priceKnown: false, ltp: 0, pnl: 50, realisedPnl: 50, dayChange: 0 })), live(98)).items;
  assert.equal(p.priceKnown, true);
  assert.equal(p.pnl, 50 + -65 * (98 - 120));
  assert.equal(p.dayChange, 0);
});

test("rows with no key, no live price, or nothing open keep their polled figures", () => {
  const polled = book(row({ quoteKey: null }), row({ quoteKey: "BANKNIFTY|2026-11-25|55500|PE" }), row({ qty: 0 }));
  assert.equal(applyLiveMarks(polled, live(98)).items[0], polled.items[0]);
  assert.equal(applyLiveMarks(polled, live(98)).items[1], polled.items[1]);
  assert.equal(applyLiveMarks(polled, live(98)).items[2], polled.items[2]);
});

test("nothing streaming returns the same object, so nothing re-renders", () => {
  const polled = book(row());
  assert.equal(applyLiveMarks(polled, new Map()), polled);
  assert.equal(applyLiveMarks(polled, live(100)), polled);
});

test("a nonsense price is ignored rather than zeroing a row", () => {
  const polled = book(row());
  assert.equal(applyLiveMarks(polled, live(0)), polled);
  assert.equal(applyLiveMarks(polled, live(Number.NaN)), polled);
});

test("the live mark says where the price streams from", () => {
  const nameOf = (id) => ({ paytm: "Paytm Money" })[id] ?? id;
  assert.equal(liveTitle({ price: 1, change: null, changePercent: null, source: "paytm" }, nameOf),
    "Live price from your Paytm Money connection");
  assert.equal(liveTitle({ price: 1, change: null, changePercent: null, source: "shared" }, nameOf),
    "Live price from the shared market feed");
});
