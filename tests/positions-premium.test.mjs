import assert from "node:assert/strict";
import test from "node:test";
import { groupPositions, premiumAtEntry, premiumLeft } from "../src/features/positions/grouping.ts";

const position = (overrides = {}) => ({
  broker: "kite",
  connectionId: "account-a",
  symbol: "TEST-CE",
  underlying: "TEST",
  underlyingLabel: "Test",
  instrumentType: "CE",
  contract: { strike: 100, expiry: "2026-09-29", lotSize: 50 },
  product: "NRML",
  qty: -100,
  avgPrice: 12,
  ltp: 8,
  priceKnown: true,
  pnl: 400,
  realisedPnl: 0,
  dayChange: 100,
  ...overrides,
});

test("premium nets short and long option units without multiplying the lot size again", () => {
  const rows = [position(), position({ symbol: "TEST-PE", instrumentType: "PE", qty: 50, ltp: 3, avgPrice: 4 })];
  const [account] = groupPositions(rows);
  assert.equal(premiumLeft(rows[0]), 800);
  assert.equal(premiumLeft(rows[1]), -150);
  assert.equal(account.premiumLeft, 650);
  assert.equal(account.premiumAtEntry, 1000);
  assert.deepEqual(account.groups[0].rights.map((right) => right.premiumLeft), [800, -150]);
});

test("equity and futures never contribute their notional value to option premium", () => {
  const rows = [
    position(),
    position({ symbol: "TEST-FUT", instrumentType: "FUT", qty: 100, ltp: 105, avgPrice: 100 }),
    position({ symbol: "TEST-EQ", instrumentType: "EQ", qty: 20, ltp: 105, avgPrice: 100 }),
  ];
  const [account] = groupPositions(rows);
  assert.equal(account.premiumLeft, 800);
  assert.equal(account.premiumAtEntry, 1200);
  assert.equal(account.groups[0].premiumLeft, 800);
  for (const row of rows.slice(1)) {
    assert.equal(premiumLeft(row), null);
    assert.equal(premiumAtEntry(row), null);
  }
  assert.deepEqual(account.groups[0].rights.map((right) => right.premiumLeft), [800, null, null]);
  assert.equal(account.groups[0].positions.length, 3);
  assert.equal(account.pnl, 1200);
});

test("unquoted long and short legs are excluded even when they carry a stale nonzero price", () => {
  for (const qty of [-100, 100]) {
    const missing = position({ symbol: "MISSING-PE", instrumentType: "PE", qty, ltp: 99, priceKnown: false });
    const [account] = groupPositions([position(), missing]);
    assert.equal(premiumLeft(missing), null);
    assert.equal(account.premiumLeft, 800);
    assert.equal(account.unpricedLegs, 1);
    assert.equal(account.groups[0].unpricedLegs, 1);
    assert.equal(account.groups[0].rights[1].premiumLeft, null);
    assert.equal(account.groups[0].rights[1].unpricedLegs, 1);
  }
});

test("unresolved instrument types make premium incomplete without guessing from their symbols", () => {
  const unknown = position({ instrumentType: null, contract: null, symbol: "LOOKS-LIKE-CE" });
  const [account] = groupPositions([position(), unknown]);
  assert.equal(account.premiumLeft, 800);
  assert.equal(account.premiumAtEntry, 1200);
  assert.equal(account.unpricedLegs, 1);
  assert.equal(account.groups[0].rights[1].right, "OTHER");
  assert.equal(account.groups[0].rights[1].premiumLeft, null);
});

test("no measurable option premium is unknown, while a quoted zero is a real zero", () => {
  for (const rows of [
    [position({ priceKnown: false })],
    [position({ instrumentType: null })],
    [position({ instrumentType: "EQ" })],
    [position({ instrumentType: "FUT", priceKnown: false })],
  ]) {
    assert.equal(groupPositions(rows)[0].premiumLeft, null);
  }
  const [worthless] = groupPositions([position({ ltp: 0 })]);
  assert.equal(worthless.premiumLeft, 0);
  assert.equal(worthless.unpricedLegs, 0);
  const [closed] = groupPositions([position({ qty: 0, priceKnown: false })]);
  assert.equal(closed.premiumLeft, 0);
  assert.equal(closed.unpricedLegs, 0);
});

test("invalid option prices do not poison premium totals", () => {
  for (const ltp of [NaN, Infinity, -1]) {
    const [account] = groupPositions([position(), position({ ltp })]);
    assert.equal(account.premiumLeft, 800);
    assert.equal(account.unpricedLegs, 1);
  }
});

test("each broker account keeps its own premium and missing-data state", () => {
  const rows = [
    position(),
    position({ symbol: "SECOND-PE", underlying: "SECOND", instrumentType: "PE", qty: 50, ltp: 2 }),
    position({ broker: "aliceblue", connectionId: "account-b", qty: 100 }),
    position({ broker: "aliceblue", connectionId: "account-b", instrumentType: null }),
  ];
  const [first, second] = groupPositions(rows);
  assert.equal(first.premiumLeft, 700);
  assert.equal(first.unpricedLegs, 0);
  assert.equal(first.groups.reduce((sum, group) => sum + group.premiumLeft, 0), 700);
  assert.equal(second.premiumLeft, -800);
  assert.equal(second.unpricedLegs, 1);
});

test("entry minus remaining premium reconciles to unrealised P&L after a partial close", () => {
  const row = position({ qty: -50, pnl: 350, realisedPnl: 150 });
  assert.equal(premiumAtEntry(row), 600);
  assert.equal(premiumLeft(row), 400);
  assert.equal(premiumAtEntry(row) - premiumLeft(row), row.pnl - row.realisedPnl);
});
