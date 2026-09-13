import assert from "node:assert/strict";
import test from "node:test";
import { groupPositions } from "../src/features/positions/grouping.ts";
import { positionsSummary } from "../src/features/positions/summary.ts";

const position = (overrides = {}) => ({
  broker: "kite", connectionId: "account-a", symbol: "TEST-CE", underlying: "TEST",
  underlyingLabel: "Test", instrumentType: "CE", contract: null, product: "NRML",
  qty: -100, avgPrice: 12, ltp: 8, priceKnown: true, pnl: 400, realisedPnl: 0, dayChange: -25,
  ...overrides,
});
const margin = (overrides = {}) => ({ used: 1000, provenance: "ESTIMATED", unattributed: 0, attributed: 1, ...overrides });

test("positions headline counts open rows but preserves realised and day P&L from closed rows", () => {
  const summary = positionsSummary(groupPositions([position(), position({ symbol: "CLOSED", qty: 0, pnl: 100, realisedPnl: 100, dayChange: 30 })]));
  assert.equal(summary.openCount, 1);
  assert.equal(summary.pnl, 500);
  assert.equal(summary.dayPnl, 5);
  assert.equal(summary.premium, 800);
});

test("headline premium nets account totals and carries missing-quote counts without including futures notional", () => {
  const summary = positionsSummary(groupPositions([
    position(),
    position({ connectionId: "account-b", qty: 50, ltp: 3 }),
    position({ symbol: "FUT", instrumentType: "FUT", qty: 100, ltp: 200 }),
    position({ symbol: "NOQUOTE", instrumentType: "PE", priceKnown: false, qty: -50 }),
  ]));
  assert.equal(summary.premium, 650);
  assert.equal(summary.unpricedLegs, 1);
});

test("estimated headline only sums represented account/underlying groups, not stale groups or account bills", () => {
  const brokers = groupPositions([position(), position({ connectionId: "account-b" })]);
  const summary = positionsSummary(brokers, new Map([
    ["account-a:TEST", margin()], ["account-b:TEST", margin({ used: 2000 })],
    ["account-c:TEST", margin({ used: 9000 })], ["account-a:OLD", margin({ used: 4000 })],
  ]));
  assert.equal(summary.estimatedMargin, 3000);
  assert.equal(summary.missingMarginLegs, 0);
});

test("known zero margin is displayed while absent and unattributed margins stay incomplete", () => {
  const brokers = groupPositions([position(), position({ connectionId: "account-b" })]);
  const partial = positionsSummary(brokers, new Map([["account-a:TEST", margin({ used: 0 })]]));
  assert.equal(partial.estimatedMargin, 0);
  assert.equal(partial.missingMarginLegs, 1);
  const absent = positionsSummary(brokers, new Map([["account-a:TEST", margin({ used: 0, attributed: 0, unattributed: 1 })]]));
  assert.equal(absent.estimatedMargin, null);
  assert.equal(absent.missingMarginLegs, 2);
});

test("unknown option prices and empty books do not invent a premium or margin", () => {
  const missing = positionsSummary(groupPositions([position({ priceKnown: false })]));
  assert.equal(missing.premium, null);
  assert.equal(missing.unpricedLegs, 1);
  const empty = positionsSummary([]);
  assert.equal(empty.openCount, 0);
  assert.equal(empty.premium, null);
  assert.equal(empty.estimatedMargin, null);
});
