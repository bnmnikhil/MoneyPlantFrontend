import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { draftCashflow, legCashflow, markedPnl, quantitySize } from "../src/features/strategy-builder/legFigures.ts";

function components(name) {
  const result = buildSync({ entryPoints: [fileURLToPath(new URL(`../src/features/strategy-builder/${name}.tsx`, import.meta.url))],
    bundle: true, platform: "node", format: "cjs", packages: "external", write: false, logLevel: "silent" });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, createRequire(import.meta.url));
  return loaded.exports;
}
const { StrategyLegEditor } = components("StrategyLegEditor");
const { OptionChainPicker } = components("OptionChainPicker");
const { BuilderMetrics, BuilderMargin, TargetInspector } = components("BuilderMetrics");
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const observation = (value, priceKnown = true) => ({ value, priceKnown, fetchedAt: "2026-09-12T05:00:00Z", sourceConnectionId: "quote-account", status: "AVAILABLE" });
const leg = (overrides = {}) => ({ id: "leg-a", contract: { underlying: "TEST", type: "CE", expiry: "2026-09-24", strike: 100 },
  qty: -100, lotSize: 50, entryPrice: 12, currentMark: observation(8), enabled: true, priceBasis: "MANUAL", entryQuote: null, ...overrides });
const callbacks = { onToggle() {}, onRemove() {}, onDirection() {}, onQuantity() {}, onPrice() {}, onLatest() {}, onExpiry() {}, onContract() {}, onClose() {} };
const payoff = { maxProfit: 1000, maxLoss: -500, unboundedProfit: false, unboundedLoss: false, breakevens: [80, 120], points: [] };

test("draft cashflow uses exact signed units and excludes disabled trades without hiding missing prices", () => {
  assert.equal(legCashflow(leg()), 1200);
  assert.equal(draftCashflow([leg(), leg({ id: "b", qty: 50, entryPrice: 10 })]), 700);
  assert.equal(draftCashflow([leg(), leg({ enabled: false, entryPrice: null })]), 1200);
  assert.equal(draftCashflow([leg(), leg({ entryPrice: null })]), null);
  assert.equal(legCashflow(leg({ entryPrice: -1 })), null);
});

test("baseline unrealised P&L requires a known mark and preserves a genuine zero mark", () => {
  assert.equal(markedPnl(leg()), 400);
  assert.equal(markedPnl(leg({ currentMark: observation(8, false) })), null);
  assert.equal(markedPnl(leg({ currentMark: observation(0) })), 1200);
  assert.equal(markedPnl(leg({ entryPrice: null })), null);
});

test("quantities distinguish complete lots, partial units and shares without rounding the position", () => {
  assert.deepEqual(quantitySize(leg()), { value: 2, unit: "lots" });
  assert.deepEqual(quantitySize(leg({ qty: -127, lotSize: 1600 })), { value: 127, unit: "units" });
  assert.deepEqual(quantitySize(leg({ contract: { type: "EQ" }, qty: 20, lotSize: 20 })), { value: 20, unit: "units" });
});

test("baseline and draft tables retain seven columns and locked entry costs", () => {
  const html = render(StrategyLegEditor, { ...callbacks, baseline: [leg()], drafts: [leg({ id: "draft" })], expiries: ["2026-09-24"], account: "Kite · Main" });
  assert.match(html, /1 locked/);
  assert.match(html, /Kite · Main/);
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/g)].map(([table]) => table);
  assert.equal(tables.length, 2);
  for (const table of tables) {
    for (const [, row] of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) assert.equal((row.match(/<(?:td|th)\b/g) ?? []).length, 7);
  }
  assert.doesNotMatch(tables[0], /<input|<select/);
  assert.match(tables[0], /Unreal\. P&amp;L/);
});

test("shares and futures remain editable as linear closes without option contract controls", () => {
  for (const type of ["EQ", "FUT"]) {
    const html = render(StrategyLegEditor, { ...callbacks, baseline: [], drafts: [leg({ contract: { underlying: "TEST", type, strike: 0, expiry: type === "EQ" ? null : "2026-09-24" }, qty: 10, lotSize: null })], expiries: [] });
    assert.doesNotMatch(html, /aria-label="Option type"|aria-label="Draft strike"|aria-label="Draft expiry"/);
    assert.match(html, /Quantity in units/);
    assert.match(html, /Assumed price/);
  }
});

test("drafts keep out-of-window contracts and flag unpriced or excluded cashflows", () => {
  const html = render(StrategyLegEditor, { ...callbacks, baseline: [], drafts: [leg({ entryPrice: null }), leg({ id: "disabled", enabled: false })], expiries: [] });
  assert.match(html, /Price required/);
  assert.match(html, /Excluded/);
  assert.match(html, /<option value="2026-09-24" selected="">/);
  assert.match(html, /<option value="100" selected="">/);
});

test("chain has seven aligned columns, unknown quotes and disabled conflicting contracts", () => {
  const chain = { underlying: "TEST", expiry: "2026-09-24", fetchedAt: "2026-09-12T05:00:00Z", spot: 100, availability: "STALE", warnings: [], rows: [
    { strike: 100, lotSize: null, metadataConflict: true, call: observation(null, false), put: observation(8) },
  ] };
  const html = render(OptionChainPicker, { chain, isLoading: false, error: null, onRetry() {}, onExpand() {}, onAdd() {}, canExpand: false, quantityFor: () => ({ existing: -100, draft: 50 }) });
  assert.match(html, /No quote/);
  assert.match(html, /Stale after failed refresh/);
  assert.match(html, /Held -100 · Draft \+50/);
  assert.match(html, /Lot-size conflict/);
  assert.equal((html.match(/<td\b/g) ?? []).length, 7);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 5); // four contract actions plus expansion
});

test("mixed expiry metrics preserve global limits and a signed debit", () => {
  const html = render(BuilderMetrics, { comparison: { combined: payoff, expiries: ["2026-09-24", "2026-10-29"], adjustmentCashflow: -400 } });
  assert.match(html, /Scenario max loss/);
  assert.match(html, /Scenario max profit/);
  assert.match(html, /New premium \(debit\)/);
  assert.match(html, /-₹400/);
  assert.match(html, /₹80 \/ ₹120/);
});

test("unsupported holdings margin does not expose a numeric estimate", () => {
  const html = render(BuilderMargin, { account: "Kite · Main", comparison: { margin: { status: "UNSUPPORTED_HOLDINGS", combined: { withBenefitMargin: 10000 } } } });
  assert.match(html, /unsupported holdings/);
  assert.doesNotMatch(html, /₹10,000/);
});

test("target inspector allows manual prices without inventing an unknown spot or P&L", () => {
  const html = render(TargetInspector, { spot: null, target: null, metrics: null, onTarget() {} });
  assert.match(html, /Target underlying price/);
  assert.doesNotMatch(html, /type="range"|₹0/);
  const ranged = render(TargetInspector, { spot: 100, target: 120, metrics: { existing: -100, combined: 50, change: 150 }, onTarget() {} });
  assert.match(ranged, /min="90" max="120"/);
  assert.match(ranged, /After adjustments/);
});
