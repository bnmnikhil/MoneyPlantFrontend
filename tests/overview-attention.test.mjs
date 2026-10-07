import assert from "node:assert/strict";
import test from "node:test";
import {
  attention, biggestMoves, daysUntil, expiringSoon, istDate, marginPressure, tightestAccount, toFix,
} from "../src/features/dashboard/attention.ts";

const row = (connectionId, available, used, brokerId = connectionId.split(":")[1]) => ({
  key: connectionId, brokerId, connectionId, positionsPnl: 0, holdingsPnl: 0, totalPnl: 0, dayPnl: 0,
  positionCount: 0, holdingCount: 0,
  margin: available === null ? null : { broker: brokerId, connectionId, available, used, total: available + used, cash: 0, collateral: 0 },
});

const leg = (overrides = {}) => ({
  broker: "kite", connectionId: "u:kite:K1", symbol: "NIFTY25000CE", underlying: "NIFTY", underlyingLabel: "NIFTY",
  instrumentType: "CE", contract: { strike: 25000, expiry: "2026-10-13", lotSize: 75 }, product: "NRML",
  qty: -75, avgPrice: 40, ltp: 30, priceKnown: true, pnl: 750, realisedPnl: 0, dayChange: 120, ...overrides,
});

// 7 Oct 2026, 15:00 IST.
const NOW = new Date("2026-10-07T09:30:00Z");

// ------------------------------------------------------------------ margin

test("margin pressure is per account, from 75% up, most used first", () => {
  const rows = [row("u:kite:K1", 25, 75), row("u:aliceblue:A1", 251, 749), row("u:upstox:U1", 10, 90)];
  assert.deepEqual(marginPressure(rows).map((a) => [a.connectionId, a.pct]), [["u:upstox:U1", 90], ["u:kite:K1", 75]]);
  assert.equal(marginPressure(rows)[0].free, 10);
});

test("an account whose margin is unknown is skipped, never read as 0% used", () => {
  const rows = [row("u:kite:K1", null, 0), row("u:aliceblue:A1", 10, 90)];
  assert.deepEqual(marginPressure(rows).map((a) => a.connectionId), ["u:aliceblue:A1"]);
  assert.equal(tightestAccount([row("u:kite:K1", null, 0), row("u:aliceblue:A1", 50, 50)]), null);
});

test("the tightest account needs at least two accounts to be worth saying", () => {
  assert.equal(tightestAccount([row("u:kite:K1", 16, 84)]), null);
  const tight = tightestAccount([row("u:kite:K1", 16, 84), row("u:aliceblue:A1", 88, 12)]);
  assert.equal(tight.connectionId, "u:kite:K1");
  assert.equal(tight.pct, 84);
});

// ------------------------------------------------------------------ expiry

test("days are IST calendar days: 23:30 UTC is already tomorrow in India", () => {
  assert.equal(istDate(new Date("2026-10-07T18:29:59Z")), "2026-10-07");
  assert.equal(istDate(new Date("2026-10-07T18:30:00Z")), "2026-10-08");
  assert.equal(daysUntil("2026-10-13", new Date("2026-10-07T18:29:59Z")), 6);
  assert.equal(daysUntil("2026-10-13", new Date("2026-10-07T23:30:00Z")), 5);
  assert.equal(daysUntil("2026-10-07", NOW), 0);
});

test("legs inside the 7-day window are grouped per account and expiry, soonest first", () => {
  const legs = [
    leg(),
    leg({ symbol: "NIFTY25200CE", qty: 75, pnl: -520, contract: { strike: 25200, expiry: "2026-10-13", lotSize: 75 } }),
    leg({ connectionId: "u:aliceblue:A1", broker: "aliceblue", contract: { strike: 300, expiry: "2026-10-09", lotSize: 1 }, pnl: 100 }),
    leg({ contract: { strike: 26000, expiry: "2026-10-14", lotSize: 75 } }),   // 7 days: outside
    leg({ contract: { strike: 26000, expiry: "2026-10-27", lotSize: 75 } }),
  ];
  const { soon, next } = expiringSoon(legs, NOW);
  assert.deepEqual(soon.map((g) => [g.connectionId, g.expiry, g.daysLeft, g.legs.length]),
    [["u:aliceblue:A1", "2026-10-09", 2, 1], ["u:kite:K1", "2026-10-13", 6, 2]]);
  assert.equal(soon[1].pnl, 230);
  assert.deepEqual(next, { expiry: "2026-10-14", daysLeft: 7, legCount: 1 });
});

test("closed, expired and unresolved legs are not expiring; an unpriced leg makes the group partial", () => {
  const legs = [
    leg({ qty: 0 }),
    leg({ contract: { strike: 1, expiry: "2026-10-06", lotSize: 1 } }),
    leg({ contract: null }),
    leg({ symbol: "X", priceKnown: false, pnl: 9999 }),
  ];
  const { soon, next } = expiringSoon(legs, NOW);
  assert.equal(soon.length, 1);
  assert.equal(soon[0].legs.length, 1);
  assert.equal(soon[0].pnl, 0);
  assert.equal(soon[0].partial, true);
  assert.equal(next, null);
});

// ------------------------------------------------------------------ moves

test("biggest moves are the top three by size either way, ignoring small and unpriced legs", () => {
  const legs = [
    leg({ symbol: "A", dayChange: 870 }), leg({ symbol: "B", dayChange: -743 }), leg({ symbol: "C", dayChange: 212 }),
    leg({ symbol: "D", dayChange: 150 }), leg({ symbol: "E", dayChange: 99 }),
    leg({ symbol: "F", dayChange: 5000, priceKnown: false }), leg({ symbol: "G", dayChange: 4000, qty: 0 }),
  ];
  assert.deepEqual(biggestMoves(legs).map((p) => p.symbol), ["A", "B", "C"]);
  assert.deepEqual(biggestMoves([leg({ dayChange: 99 })]), []);
});

// ------------------------------------------------------------------ to fix

const status = (brokers, connected) => ({
  brokers,
  connections: connected.map(([brokerId, label]) => ({ connectionId: `u:${brokerId}:${label}`, brokerId, accountLabel: label, credentialLabel: "default", connected: true })),
});

test("a broker with credentials and no live account is 'not connected'", () => {
  const items = toFix({ status: status(["kite", "dhan"], [["kite", "K1"]]), warnings: [], positions: [] });
  assert.deepEqual(items, [{ kind: "not-connected", brokerId: "dhan" }]);
});

test("an expired session asks for reconnect; a failed call never does; unsupported is not a problem", () => {
  const warnings = [
    { brokerId: "kite", connectionId: "u:kite:K1", code: "SESSION_EXPIRED", message: "" },
    { brokerId: "kite", connectionId: "u:kite:K1", code: "SESSION_EXPIRED", message: "dup from holdings" },
    { brokerId: "paytm", connectionId: "u:paytm:P1", code: "CALL_FAILED", message: "" },
    { brokerId: "dhan", connectionId: "u:dhan:D1", code: "UNSUPPORTED_CAPABILITY", message: "" },
  ];
  const kinds = toFix({ status: undefined, warnings, positions: [] }).map((i) => i.kind);
  assert.deepEqual(kinds, ["session-expired", "load-failed"]);
});

test("unpriced open legs are counted, and stale estimates are flagged but NONE is not", () => {
  const items = toFix({ status: undefined, warnings: [], positions: [leg({ priceKnown: false }), leg({ priceKnown: false, qty: 0 }), leg()],
    risk: { freshness: "STALE", asOf: "2026-10-04T05:56:20Z" } });
  assert.deepEqual(items.map((i) => i.kind), ["unpriced", "stale-estimates"]);
  assert.equal(items[0].count, 1);
  assert.deepEqual(toFix({ status: undefined, warnings: [], positions: [], risk: { freshness: "NONE", asOf: null } }), []);
  assert.deepEqual(toFix({ status: undefined, warnings: [], positions: [], risk: { freshness: "LIVE", asOf: null } }), []);
});

// ------------------------------------------------------------------ all clear

test("all clear only when there is no pressure, no expiry and nothing to fix; moves alone do not count", () => {
  const calm = attention({ rows: [row("u:kite:K1", 70, 30)], positions: [leg({ contract: { strike: 1, expiry: "2026-10-27", lotSize: 1 }, dayChange: 900 })],
    status: status(["kite"], [["kite", "K1"]]), warnings: [], now: NOW, risk: { freshness: "LIVE", asOf: null } });
  assert.equal(calm.allClear, true);
  assert.equal(calm.moves.length, 1);
  assert.equal(calm.expiring.next.expiry, "2026-10-27");
  assert.equal(calm.checks.length, 4);

  const busy = attention({ rows: [row("u:kite:K1", 16, 84)], positions: [], status: status(["kite"], [["kite", "K1"]]), warnings: [], now: NOW });
  assert.equal(busy.allClear, false);
  assert.equal(busy.margin.length, 1);
});
