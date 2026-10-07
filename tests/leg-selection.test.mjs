import assert from "node:assert/strict";
import test from "node:test";
import {
  comparisonRequest, legKey, legOpenPnl, openPnl, pruneExcluded, selectedLegs, toggleLeg,
} from "../src/features/payoff/legSelection.ts";

const leg = (overrides = {}) => ({
  legId: "l1", symbol: "NIFTY24800CE", underlying: "NIFTY", exchange: "NFO", strike: 24800, type: "CE",
  qty: -75, avgPrice: 62.4, expiry: "2026-10-13", lotSize: 75, origin: "EXISTING_POSITION",
  currentMark: 48.1, currentMarkKnown: true, ...overrides,
});
const condor = [
  leg({ legId: "a" }),
  leg({ legId: "b", strike: 25000, qty: 75, avgPrice: 21.1, currentMark: 14.75 }),
  leg({ legId: "c", type: "PE", strike: 24300, avgPrice: 58.9, currentMark: 34.18 }),
  leg({ legId: "d", type: "PE", strike: 24100, qty: 75, avgPrice: 19.5, currentMark: 15.03 }),
];

test("a leg's open P/L is (current - average) x signed quantity", () => {
  assert.ok(Math.abs(legOpenPnl(condor[0]) - 1072.5) < 1e-6);   // short: price fell, so a gain
  assert.equal(Math.round(legOpenPnl(condor[1])), -476);   // long: price fell, so a loss
});

test("an unpriced leg has no P/L, and a total missing it is marked partial", () => {
  assert.equal(legOpenPnl(leg({ currentMarkKnown: false })), null);
  const partial = openPnl([condor[0], leg({ legId: "x", currentMark: null, currentMarkKnown: false })]);
  assert.ok(Math.abs(partial.value - 1072.5) < 1e-6);
  assert.equal(partial.partial, true);
  assert.deepEqual(openPnl([leg({ currentMarkKnown: false })]), { value: null, partial: false });
  assert.equal(openPnl(condor).partial, false);
});

test("unticking removes a leg; the last ticked leg cannot be unticked", () => {
  let excluded = new Set();
  excluded = toggleLeg(excluded, "d", condor);
  assert.deepEqual(selectedLegs(condor, excluded).map((l) => l.legId), ["a", "b", "c"]);
  excluded = toggleLeg(excluded, "c", condor);
  excluded = toggleLeg(excluded, "b", condor);
  const before = new Set(excluded);
  excluded = toggleLeg(excluded, "a", condor);
  assert.deepEqual([...excluded].sort(), [...before].sort());
  assert.equal(selectedLegs(condor, excluded).length, 1);
  excluded = toggleLeg(excluded, "d", condor);
  assert.equal(selectedLegs(condor, excluded).length, 2);
});

test("a leg without an id is still addressable, and a vanished leg's exclusion is dropped", () => {
  const anon = leg({ legId: "" });
  assert.match(legKey(anon, 3), /:3$/);
  const excluded = new Set(["a", "gone"]);
  assert.deepEqual([...pruneExcluded(excluded, condor)], ["a"]);
  const kept = new Set(["a"]);
  assert.equal(pruneExcluded(kept, condor), kept);
});

test("the compare request holds only the ticked legs as baseline, and drafts nothing", () => {
  const data = { underlying: "NIFTY", connectionId: "u:kite:main", retrievedAt: "2026-10-07T06:00:00Z",
    complete: true, spot: 24512, legs: condor };
  const request = comparisonRequest(data, condor.slice(0, 3));
  assert.deepEqual(request.baselineLegs.map((l) => l.id), ["a", "b", "c"]);
  assert.equal(request.draftTradeLegs.length, 0);
  assert.equal(request.context.positionConnectionId, "u:kite:main");
  assert.equal(request.baselineLegs[0].priceBasis, "POSITION_AVERAGE");
  assert.equal(request.baselineLegs[0].currentMark.value, 48.1);
  assert.equal(comparisonRequest({ ...data, spot: 0 }, condor).spot, null);
});
