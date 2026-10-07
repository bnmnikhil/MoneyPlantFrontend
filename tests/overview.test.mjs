import assert from "node:assert/strict";
import test from "node:test";
import { capitalUtilisation } from "../src/features/dashboard/overview.ts";
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
  assert.deepEqual(buildBrokerRows([], [], []).rows, []);
});
