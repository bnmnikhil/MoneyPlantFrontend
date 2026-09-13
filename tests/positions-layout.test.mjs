import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Render the real TSX through the project's existing compiler dependency.
// This checks semantics/table structure; it is not a browser or pixel test.
const result = buildSync({
  entryPoints: [fileURLToPath(new URL("../src/features/positions/PositionsTable.tsx", import.meta.url))],
  bundle: true, platform: "node", format: "cjs", packages: "external", write: false,
  logLevel: "silent",
});
const loaded = { exports: {} };
new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, createRequire(import.meta.url));
const { PositionsTable } = loaded.exports;

const position = (overrides = {}) => ({
  broker: "kite", connectionId: "account-a", symbol: "TEST-CE", underlying: "TEST",
  underlyingLabel: "Test", instrumentType: "CE", contract: null, product: "NRML",
  qty: -100, avgPrice: 12, ltp: 8, priceKnown: true, pnl: 400, realisedPnl: 0, dayChange: -25,
  ...overrides,
});

test("expanded account, underlying, right and leg rows all align to nine columns with distinct P&L headings", () => {
  const html = renderToStaticMarkup(React.createElement(PositionsTable, { positions: [position(), position({ symbol: "TEST-PE", instrumentType: "PE" })] }));
  const table = html.match(/<table[\s\S]*?<\/table>/)[0];
  assert.match(table, />P&amp;L<\/th>/);
  assert.match(table, />Day P&amp;L<\/th>/);
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length, 7); // header + account + underlying + 2 rights + 2 legs
  for (const [, row] of rows) {
    const columnCount = [...row.matchAll(/<(?:td|th)\b([^>]*)>/g)].reduce((sum, [, attrs]) => sum + Number(attrs.match(/colSpan="(\d+)"/i)?.[1] ?? 1), 0);
    assert.equal(columnCount, 9);
  }
});

test("a single connected account keeps its name, real bill tooltip and missing LTP visible", () => {
  const html = renderToStaticMarkup(React.createElement(PositionsTable, {
    positions: [position({ priceKnown: false })], accountLabels: new Map([["account-a", "Main account"]]),
    connectionMargin: new Map([["account-a", 12345]]),
  }));
  assert.match(html, /Main account/);
  assert.match(html, /reported account margin bill/);
  assert.match(html, /Quote unavailable/);
  assert.match(html, /No valued options/);
  assert.doesNotMatch(html, /today<\/span>/);
});
