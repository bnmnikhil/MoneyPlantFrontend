import test from "node:test";
import assert from "node:assert/strict";
import {
  basesOf, chartBars, exposureIn, inCrore, keyFigures, missingKind, operatingProfit, quarterLabel, quartersFor, resultRows,
  resultsAreStale, trailingEps,
} from "../src/features/research/fundamentals.ts";

// The filing parsers moved to the backend in AN-12 (fundamentals/parse, FilingParsersTest); what
// stays here is the page's own arithmetic.

const quarter = (periodEnd, over = {}) => ({
  basis: "consolidated", periodStart: "", periodEnd, audited: false, approvedOn: null,
  revenue: 1000e7, otherIncome: 50e7, totalIncome: 1050e7, financeCosts: 10e7, depreciation: 40e7,
  totalExpenses: 650e7, profitBeforeTax: 400e7, tax: 100e7, netProfit: 300e7,
  paidUpEquity: 100e7, faceValue: 1, epsBasic: 3, epsDiluted: 3, filing: null, ...over,
});
const year = ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"].map((end) => quarter(end));

test("operating profit leaves interest and depreciation out of expenses", () => {
  assert.equal(operatingProfit(year[0]), 400e7);
  assert.equal(operatingProfit(quarter("2026-09-30", { depreciation: null })), null);
  const rows = Object.fromEntries(resultRows([year[0]]).map((row) => [row.label, row.cells[0]]));
  assert.equal(rows["Expenses"], "600");
  assert.equal(rows["Operating profit"], "400");
  assert.equal(rows["Operating margin"], "40%");
  assert.equal(rows["EPS (₹)"], "3.00");
});

test("trailing EPS needs four consecutive quarters", () => {
  assert.equal(trailingEps(year), 12);
  assert.equal(trailingEps(year.slice(1)), null);
  assert.equal(trailingEps([quarter("2025-06-30"), ...year.slice(1)]), null);
});

test("old results still show, but not a P/E against today's price", () => {
  const fresh = new Date("2026-11-11");
  assert.equal(resultsAreStale("2026-09-30", fresh), false);
  assert.equal(resultsAreStale("2026-06-30", fresh), false);
  assert.equal(resultsAreStale("2024-12-31", fresh), true);
  const figures = Object.fromEntries(keyFigures(year, 240, new Date("2028-01-01")).map((figure) => [figure.label, figure]));
  assert.equal(figures["P/E"].value, "—");
  assert.equal(figures["P/E"].note, "Latest results loaded are Sep 2026");
  assert.equal(figures["EPS, last four quarters"].value, "₹12.00");
});

test("key figures are worked out from price and filings, and dash when an input is missing", () => {
  const figures = Object.fromEntries(keyFigures(year, 240, new Date("2026-11-11")).map((figure) => [figure.label, figure.value]));
  assert.equal(figures["Market cap"], "₹24,000 cr");
  assert.equal(figures["P/E"], "20.0");
  assert.equal(figures["EPS, last four quarters"], "₹12.00");
  assert.equal(figures["Operating margin"], "40%");
  assert.equal(figures["Dividend yield"], "—");

  const unpriced = Object.fromEntries(keyFigures(year, null).map((figure) => [figure.label, figure.value]));
  assert.deepEqual([unpriced["Market cap"], unpriced["P/E"]], ["—", "—"]);
  const oneQuarter = Object.fromEntries(keyFigures(year.slice(3), 240).map((figure) => [figure.label, figure.value]));
  assert.deepEqual([oneQuarter["P/E"], oneQuarter["Market cap"]], ["—", "₹24,000 cr"]);
  assert.equal(keyFigures(year.map((q) => ({ ...q, paidUpEquity: 1252e7 })), 400)[0].value, "₹5.01 lakh cr");
});

test("quarters are shown per basis, oldest first, latest eight", () => {
  const data = { symbol: "X", name: null, isin: null, source: "", generatedAt: "",
    quarters: [...year].reverse().concat(quarter("2026-09-30", { basis: "standalone" })) };
  assert.deepEqual(basesOf(data), ["consolidated", "standalone"]);
  assert.deepEqual(quartersFor(data, "consolidated").map((q) => quarterLabel(q.periodEnd)), ["Dec 2025", "Mar 2026", "Jun 2026", "Sep 2026"]);
  assert.equal(quartersFor(data, "consolidated", 2).length, 2);
  assert.equal(quartersFor(data, "standalone").length, 1);
});

test("a loss draws no profit bar and prints with a minus", () => {
  const [bar] = chartBars([quarter("2026-09-30", { netProfit: -20e7 })]);
  assert.deepEqual([bar.revenuePct, bar.profitPct], [100, 0]);
  assert.deepEqual([bar.revenue, bar.profit, bar.profitIsLoss], ["1,000", "−20", true], "the tooltip still states the loss");
  assert.equal(inCrore(-20e7), "−20");
  assert.equal(inCrore(null), "—");
});

test("exposure groups the user's positions and holdings in the stock by account", () => {
  const accounts = exposureIn("ITC",
    [
      { connectionId: "u:kite:A", broker: "kite", symbol: "ITC26NOV260CE", underlying: "ITC", qty: -1600, pnl: 1840 },
      { connectionId: "u:kite:A", broker: "kite", symbol: "NIFTY26NOV24000PE", underlying: "NIFTY", qty: 75, pnl: -900 },
    ],
    [{ connectionId: "u:aliceblue:B", broker: "aliceblue", underlying: "ITC", qty: 400, avgCost: 241.3, pnl: 6600 }],
  );
  assert.deepEqual(accounts.map((account) => [account.broker, account.pnl, account.lines.map((line) => line.text)]), [
    ["aliceblue", 6600, ["400 shares · avg ₹241.30"]],
    ["kite", 1840, ["Short 1600 · ITC26NOV260CE"]],
  ]);
  assert.deepEqual(exposureIn("TCS", [], []), []);
});

test("a 404 means not loaded only when the API says so; a bare one means the page is hidden", () => {
  assert.equal(missingKind({ error: "STOCK_NOT_LOADED", message: "No results are loaded for TCS." }), "not-loaded");
  assert.equal(missingKind(undefined), "hidden");
  assert.equal(missingKind("Not Found"), "hidden");
  assert.equal(missingKind({ error: "SOMETHING_ELSE" }), "hidden");
});

test("one-off rows appear only when a shown quarter has one", () => {
  const plain = resultRows(year).map((row) => row.label);
  assert.equal(plain.includes("Exceptional items"), false);
  assert.equal(plain.includes("Profit from discontinued operations"), false);

  // ITC, Mar 2025: the hotels demerger is profit from discontinued operations, not an exceptional item.
  const demerger = [...year.slice(0, 3), quarter("2026-09-30", { exceptionalItems: 0, profitDiscontinued: 14653e7 })];
  const rows = Object.fromEntries(resultRows(demerger).map((row) => [row.label, row.cells]));
  assert.equal(rows["Exceptional items"], undefined);
  assert.deepEqual(rows["Profit from discontinued operations"], ["—", "—", "—", "14,653"]);
  const order = resultRows(demerger).map((row) => row.label);
  assert.ok(order.indexOf("Tax") < order.indexOf("Profit from discontinued operations"));
  assert.ok(order.indexOf("Profit from discontinued operations") < order.indexOf("Net profit"));

  const withExceptional = resultRows([quarter("2026-09-30", { exceptionalItems: 528e7 })]).map((row) => row.label);
  assert.ok(withExceptional.indexOf("Depreciation") < withExceptional.indexOf("Exceptional items"));
  assert.ok(withExceptional.indexOf("Exceptional items") < withExceptional.indexOf("Profit before tax"));
});

test("the 52-week tile reads stored prices and says when the year is not complete", () => {
  const full = { lastDate: "2026-11-09", lastClose: 278.8, high52w: 444.2, low52w: 270.05, since: "2025-11-10", days: 248 };
  const range = Object.fromEntries(keyFigures(year, 240, new Date("2026-11-11"), full).map((f) => [f.label, f]))["52-week range"];
  assert.equal(range.value, "₹270.05 – ₹444.20");
  assert.equal(range.note, "To the close of 9 Nov 2026");

  const partial = Object.fromEntries(keyFigures(year, 240, new Date("2026-11-11"), { ...full, days: 23, since: "2026-10-09" })
    .map((f) => [f.label, f]))["52-week range"];
  assert.equal(partial.note, "From 23 trading days since 9 Oct 2026");

  const none = Object.fromEntries(keyFigures(year, 240, new Date("2026-11-11")).map((f) => [f.label, f]))["52-week range"];
  assert.deepEqual([none.value, none.note], ["—", "Needs price history"]);
});
