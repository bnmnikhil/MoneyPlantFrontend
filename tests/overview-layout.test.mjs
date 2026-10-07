import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { buildBrokerRows } from "../src/features/dashboard/aggregate.ts";
import { attention } from "../src/features/dashboard/attention.ts";

// The real Overview components, rendered on the server: data semantics, not pixels. Broker names
// come from the catalogue the app installs at runtime, so here they fall back to the broker id.
function component(file, name = file) {
  const result = buildSync({
    entryPoints: [fileURLToPath(new URL(`../src/features/dashboard/${file}.tsx`, import.meta.url))],
    bundle: true, platform: "node", format: "cjs", packages: "external", write: false, logLevel: "silent",
  });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, createRequire(import.meta.url));
  return loaded.exports[name];
}
const AccountsTable = component("AccountsTable");
const CapitalSummary = component("CapitalSummary");
const AttentionBand = component("AttentionBand");
const render = (Component, props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Component, props)));

const position = (connectionId, overrides = {}) => ({
  broker: connectionId.split(":")[1], connectionId, symbol: "NIFTY25000CE", underlying: "NIFTY", underlyingLabel: "NIFTY",
  instrumentType: "CE", contract: { strike: 25000, expiry: "2026-10-27", lotSize: 75 }, product: "NRML",
  qty: -75, avgPrice: 40, ltp: 30, priceKnown: true, pnl: 750, realisedPnl: 0, dayChange: 120, ...overrides,
});
const margin = (connectionId, available, used) => ({ broker: connectionId.split(":")[1], connectionId, available, used, total: available + used, cash: 0, collateral: 0 });
const NOW = new Date("2026-10-07T09:30:00Z");

// ------------------------------------------------------------------ accounts table

test("two accounts at one broker stay two rows, each labelled", () => {
  const { rows, totals } = buildBrokerRows([position("u:kite:K1"), position("u:kite:K2")], [], [margin("u:kite:K1", 50, 50), margin("u:kite:K2", 90, 10)]);
  const html = render(AccountsTable, { rows, totals });
  assert.equal((html.match(/<tr/g) ?? []).length, 4);   // header, two accounts, total
  assert.match(html, /K1/);
  assert.match(html, /K2/);
  assert.match(html, /Total · 2 accounts/);
});

test("a margin that did not load is a dash in every capital cell, never zero", () => {
  const { rows, totals } = buildBrokerRows([position("u:kite:K1")], [], []);
  const html = render(AccountsTable, { rows, totals });
  assert.ok((html.match(/>—</g) ?? []).length >= 3);
  assert.doesNotMatch(html, /₹0</);
});

test("an account with nothing open is dimmed to one line but keeps its capital", () => {
  const { rows, totals } = buildBrokerRows([position("u:kite:K1")], [], [margin("u:kite:K1", 10, 90), margin("u:paytm:P1", 250000, 0)]);
  const html = render(AccountsTable, { rows, totals });
  assert.match(html, /class="overview-idle"/);
  assert.match(html, /Nothing open/);
  assert.match(html, /₹2,50,000/);
});

// ------------------------------------------------------------------ capital cell

test("the tightest account appears only with two or more accounts, amber only from 75%", () => {
  const one = buildBrokerRows([], [], [margin("u:kite:K1", 16, 84)]).rows;
  assert.doesNotMatch(render(CapitalSummary, { rows: one, utilisation: 84, partial: false }), /Tightest/);

  const calm = buildBrokerRows([], [], [margin("u:kite:K1", 40, 60), margin("u:aliceblue:A1", 88, 12)]).rows;
  const calmHtml = render(CapitalSummary, { rows: calm, utilisation: 36, partial: false });
  assert.match(calmHtml, /Tightest: kite 60%/);
  assert.doesNotMatch(calmHtml, /overview-tight-hot/);

  const hot = buildBrokerRows([], [], [margin("u:kite:K1", 57001, 291595), margin("u:aliceblue:A1", 220000, 30000)]).rows;
  const hotHtml = render(CapitalSummary, { rows: hot, utilisation: 54, partial: false });
  assert.match(hotHtml, /overview-tight-hot/);
  assert.match(hotHtml, /▲ Tightest: kite 84% · ₹57,001 available/);
});

// ------------------------------------------------------------------ attention band

const status = (brokers, live) => ({ brokers, connections: live.map((id) => ({ connectionId: id, brokerId: id.split(":")[1], accountLabel: id.split(":")[2], credentialLabel: "default", connected: true })) });
const band = (input) => {
  const { rows } = buildBrokerRows(input.positions, [], input.margins);
  const result = attention({ rows, positions: input.positions, status: input.status, warnings: input.warnings ?? [], now: NOW, risk: input.risk });
  return { result, html: render(AttentionBand, { attention: result, rows, accountLabels: new Map(), credentialLabels: new Map([["u:kite:K1", "Personal"]]), onConnect() {} }) };
};

test("a quiet day is one all-clear line that names the next expiry, and has no cards", () => {
  const { html } = band({ positions: [position("u:kite:K1", { dayChange: 20 })], margins: [margin("u:kite:K1", 70, 30)], status: status(["kite"], ["u:kite:K1"]) });
  assert.match(html, /Nothing needs attention/);
  assert.match(html, /No expiry in the next 7 days \(next: 27 Oct, 1 leg\)/);
  assert.doesNotMatch(html, /overview-att-grid/);
});

test("moves are information: they show beside the all-clear line", () => {
  const { html } = band({ positions: [position("u:kite:K1", { dayChange: 870 })], margins: [margin("u:kite:K1", 70, 30)], status: status(["kite"], ["u:kite:K1"]) });
  assert.match(html, /Nothing needs attention/);
  assert.match(html, /Biggest moves today/);
  assert.match(html, /NIFTY 25,000 CE/);
  assert.match(html, /\+₹870/);
});

test("each problem gets its own card, and empty cards are not drawn", () => {
  const { html } = band({
    positions: [position("u:kite:K1", { contract: { strike: 25000, expiry: "2026-10-13", lotSize: 75 }, dayChange: 0 })],
    margins: [margin("u:kite:K1", 16, 84)],
    status: status(["kite", "dhan"], ["u:kite:K1"]),
  });
  assert.doesNotMatch(html, /Nothing needs attention/);
  assert.match(html, /Margin pressure/);
  assert.match(html, /Expiring soon/);
  assert.match(html, /6 days/);
  assert.match(html, /dhan is not connected/);
  assert.match(html, />Connect</);
  assert.doesNotMatch(html, /Biggest moves today/);
});

test("an expired session offers Reconnect; a failed load never does", () => {
  const { html } = band({ positions: [], margins: [], status: status(["kite", "paytm"], ["u:kite:K1", "u:paytm:P1"]), warnings: [
    { brokerId: "kite", connectionId: "u:kite:K1", code: "SESSION_EXPIRED", message: "" },
    { brokerId: "paytm", connectionId: "u:paytm:P1", code: "CALL_FAILED", message: "" },
  ] });
  assert.match(html, /needs reconnecting/);
  assert.match(html, />Reconnect</);
  assert.match(html, /Couldn&#x27;t load paytm/);
  assert.equal((html.match(/>Reconnect</g) ?? []).length, 1);
});
