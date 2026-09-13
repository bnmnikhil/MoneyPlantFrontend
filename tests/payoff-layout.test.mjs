import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { curveKey, resolveSelectedCurve } from "../src/features/payoff/curveSelection.ts";

// Exercise the real components' data semantics. This is not a browser/pixel test.
function component(name) {
  const result = buildSync({
    entryPoints: [fileURLToPath(new URL(`../src/features/payoff/${name}.tsx`, import.meta.url))],
    bundle: true, platform: "node", format: "cjs", packages: "external", write: false, logLevel: "silent",
  });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, createRequire(import.meta.url));
  return loaded.exports[name];
}
const PayoffSummary = component("PayoffSummary");
const LegsTable = component("LegsTable");
const HoldingsToggle = component("HoldingsToggle");
const CurveSelector = component("CurveSelector");
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const curve = (overrides = {}) => ({ connectionId: "a", brokerId: "kite", accountLabel: "Main account", underlying: "TEST", underlyingLabel: "Test display", ...overrides });
const response = (overrides = {}) => ({
  spot: 100, expiries: ["2026-09-24"],
  payoff: { maxProfit: 1000, maxLoss: -500, unboundedProfit: false, unboundedLoss: false, breakevens: [80, 120], points: [] },
  ...overrides,
});

test("curve refresh preserves account identity and takes fresh display metadata", () => {
  const other = curve({ connectionId: "b" });
  const refreshed = curve({ accountLabel: "Renamed account" });
  assert.notEqual(curveKey(other), curveKey(refreshed));
  assert.equal(resolveSelectedCurve([other, refreshed], curve()), refreshed);
});

test("removed curves fall back to an available account and an empty list clears stale selection", () => {
  const other = curve({ connectionId: "b" });
  assert.equal(resolveSelectedCurve([other], curve()), other);
  assert.equal(resolveSelectedCurve([], curve()), undefined);
});

test("curve trigger distinguishes the account and uses the display spelling", () => {
  const html = render(CurveSelector, { curves: [curve()], selected: curve(), onSelect() {} });
  assert.match(html, /Test display/);
  assert.match(html, /Main account/);
  assert.match(html, /aria-expanded="false"/);
});

test("mixed expiry summary keeps every date and global breakeven with scenario labels", () => {
  const html = render(PayoffSummary, { loading: false, data: response({ expiries: ["2026-09-24", "2026-10-29"] }) });
  assert.match(html, /Scenario max profit/);
  assert.match(html, /Scenario max loss/);
  assert.match(html, /24 Sept 2026/);
  assert.match(html, /29 Oct 2026/);
  assert.match(html, /₹80 \/ ₹120/);
  assert.match(html, /-₹500/);
});

test("unknown spot stays unavailable and unbounded payoff is never shown as a finite loss", () => {
  const data = response();
  data.spot = 0;
  data.expiries = [];
  data.payoff.unboundedLoss = true;
  const html = render(PayoffSummary, { loading: false, data });
  assert.match(html, /Unlimited/);
  assert.doesNotMatch(html, /-₹500|₹0/);
  assert.match(html, /—/);
});

test("legs retain signed unit quantities, duplicate symbols, futures and purchased shares", () => {
  const html = render(LegsTable, { legs: [
    { symbol: "TEST", type: "CE", qty: -100, strike: 120, avgPrice: 12, lotSize: 50 },
    { symbol: "TEST", type: "PE", qty: 50, strike: 80, avgPrice: 5, lotSize: 50 },
    { symbol: "TEST-FUT", type: "FUT", qty: 25, strike: 0, avgPrice: 100, lotSize: 25 },
    { symbol: "TEST-SHARES", type: "EQ", qty: 10, strike: 0, avgPrice: 90, lotSize: null },
  ] });
  assert.equal((html.match(/<tr>/g) ?? []).length, 5);
  assert.equal((html.match(/<th>/g) ?? []).length, 5);
  assert.match(html, /Short 100/);
  assert.match(html, /Long 50/);
  assert.match(html, /Long 25/);
  assert.match(html, /Shares/);
  assert.equal((html.match(/<td>—<\/td>/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Short 5,000/);
});

const toggleProps = { onToggle() {}, onQty() {}, onRetry() {}, loading: false, errored: false };
test("included holdings remain removable after a warning and display the response quantity", () => {
  const html = render(HoldingsToggle, { ...toggleProps, included: true,
    holding: { availableQty: 120, includedQty: 30, avgCost: 150, warning: "Quote unavailable" } });
  assert.match(html, /role="switch"[^>]*checked=""/);
  assert.doesNotMatch(html, /disabled=""/);
  assert.match(html, /aria-label="Shares to include"[^>]*max="120"[^>]*value="30"/);
  assert.match(html, /Retry/);
});

test("unavailable holdings cannot be added", () => {
  const html = render(HoldingsToggle, { ...toggleProps, included: false });
  assert.match(html, /role="switch"[^>]*disabled=""/);
  assert.match(html, /None available/);
  assert.doesNotMatch(html, /Shares to include/);
});
