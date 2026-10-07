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
const PositionFigures = component("PositionFigures");
const LegsRail = component("LegsRail");
const HoldingsToggle = component("HoldingsToggle");
const CurveSelector = component("CurveSelector");
const PayoffTooltip = component("PayoffTooltip");
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

const figureSet = (overrides = {}) => ({
  openPnl: { value: 2115, partial: false },
  payoff: { maxProfit: 8420, maxLoss: -11580, unboundedProfit: false, unboundedLoss: false, breakevens: [], points: [] },
  margin: { status: "AVAILABLE", baseline: { initialMargin: 200000, withBenefitMargin: 142000, hedgeBenefit: 58000 }, combined: null },
  ...overrides,
});

test("the four figures: current P/L, margin used, max profit and max loss", () => {
  const html = render(PositionFigures, { shown: figureSet(), mixedExpiries: false });
  assert.match(html, /Current P\/L.*\+₹2,115/s);
  assert.match(html, /Margin used.*₹1,42,000/s);
  assert.match(html, /Max profit.*₹8,420/s);
  assert.match(html, /Max loss.*-₹11,580/s);
  assert.doesNotMatch(html, /Spot|Breakeven|Expiry/);
});

test("mixed expiries label the limits as a scenario", () => {
  const html = render(PositionFigures, { shown: figureSet(), mixedExpiries: true });
  assert.match(html, /Scenario max profit/);
  assert.match(html, /Scenario max loss/);
});

test("unbounded loss is never shown as a finite figure, and missing values are dashes", () => {
  const payoff = { ...figureSet().payoff, unboundedLoss: true };
  const html = render(PositionFigures, { shown: figureSet({ payoff, openPnl: { value: null, partial: false },
    margin: { status: "UNSUPPORTED_HOLDINGS", baseline: null, combined: null } }), mixedExpiries: false });
  assert.match(html, /Unlimited/);
  assert.doesNotMatch(html, /-₹11,580/);
  assert.equal((html.match(/>—</g) ?? []).length, 2);
  assert.match(html, /Not estimated when shares are included/);
});

test("a P/L that is missing a leg's price is marked partial", () => {
  const html = render(PositionFigures, { shown: figureSet({ openPnl: { value: 900, partial: true } }), mixedExpiries: false });
  assert.match(html, /\+₹900 \?/);
});

test("a what-if shows the real position's figures struck through, and only where they differ", () => {
  const shown = figureSet({ openPnl: { value: 2450, partial: false }, payoff: { ...figureSet().payoff, unboundedLoss: true } });
  const html = render(PositionFigures, { shown, real: figureSet(), mixedExpiries: false });
  assert.match(html, /<s>\+₹2,115<\/s>/);
  assert.match(html, /<s>-₹11,580<\/s>/);
  assert.doesNotMatch(html, /<s>₹8,420<\/s>/);
});

test("figures still loading show placeholders, not stale numbers", () => {
  const html = render(PositionFigures, { shown: figureSet({ payoff: undefined, margin: undefined }), mixedExpiries: false });
  assert.doesNotMatch(html, /₹8,420|₹1,42,000/);
  assert.match(html, /\+₹2,115/);
});

test("payoff tooltip shows hovered spot change relative to the current spot", () => {
  const tooltip = (hoveredSpot, referenceSpot) => render(PayoffTooltip, {
    active: true,
    referenceSpot,
    payload: [{ payload: { spot: hoveredSpot, pnl: 250 } }],
  });

  assert.match(tooltip(110, 100), /\(\+10\.00%\)/);
  assert.match(tooltip(90, 100), /\(-10\.00%\)/);
  assert.match(tooltip(100, 100), /\(0\.00%\)/);
  assert.doesNotMatch(tooltip(110, 0), /%/);
});

const railLeg = (overrides = {}) => ({ legId: "a", symbol: "TEST120CE", underlying: "TEST", exchange: "NFO", type: "CE", qty: -100,
  strike: 120, avgPrice: 12, lotSize: 50, expiry: "2026-10-13", origin: "EXISTING_POSITION", currentMark: 10, currentMarkKnown: true, ...overrides });
const railProps = { onToggle() {}, onShowAll() {}, showExpiry: false };

test("legs show signed sides, each leg's own P/L, futures and purchased shares", () => {
  const html = render(LegsRail, { ...railProps, excluded: new Set(), legs: [
    railLeg(),
    railLeg({ legId: "b", type: "PE", qty: 50, strike: 80, avgPrice: 5, currentMark: 4 }),
    railLeg({ legId: "c", symbol: "TEST-FUT", type: "FUT", qty: 25, strike: 0, avgPrice: 100, currentMark: 103 }),
    railLeg({ legId: "d", symbol: "TEST-SHARES", type: "EQ", qty: 10, strike: 0, avgPrice: 90, currentMark: null, currentMarkKnown: false, origin: "EXISTING_HOLDING" }),
  ] });
  assert.equal((html.match(/<li /g) ?? []).length, 4);
  assert.match(html, /S 100/);
  assert.match(html, /B 50/);
  assert.match(html, /\+₹200/);
  assert.match(html, /-₹50/);
  assert.match(html, /TEST FUT/);
  assert.match(html, /TEST shares/);
  assert.match(html, /no price/);
  assert.match(html, /4 of 4 on the graph/);
  assert.doesNotMatch(html, /Show all/);
});

test("an unticked leg is marked off the graph, and the last ticked leg cannot be unticked", () => {
  const html = render(LegsRail, { ...railProps, excluded: new Set(["b"]),
    legs: [railLeg(), railLeg({ legId: "b", strike: 140 })] });
  assert.match(html, /1 of 2 on the graph/);
  assert.match(html, /not on graph/);
  assert.match(html, /Show all/);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 1);
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
