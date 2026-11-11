import test from "node:test";
import assert from "node:assert/strict";
import { FilingFormatError, parseAmount, parseAny, parseFiling, parseXbrl } from "../scripts/fundamentals/parse-filing.mjs";
import {
  basesOf, chartBars, exposureIn, inCrore, keyFigures, operatingProfit, quarterLabel, quartersFor, resultRows, resultsAreStale,
  trailingEps,
} from "../src/features/research/fundamentals.ts";

/** A filing page cut down to the rows the parser reads, quirks included. */
function filing({ heading = "Integrated Filing &mdash; IndAS", symbol = "ACME", rounding = "Lakhs", basis = "Consolidated" } = {}) {
  return `<html><body><h1>${heading}</h1>
<h3 style="font-weight: bold">General information about company</h3>
<table>
<tr><th>NSE Symbol</th><td>${symbol}</td></tr>
<tr><th>ISIN</th><td>INE000A01010</td></tr>
<tr><th>Name of company</th><td>Acme &amp; Sons Limited</td></tr>
<tr><th>Date of board meeting when results were approved</th><td>11-11-2025</td></tr>
<tr><th>Level of rounding used in financial results</th><td>${rounding}</td></tr>
</table>
<h3 style="font-weight: bold">Financial Results Ind-AS</h3>
<h3 style="color:red">Amount in (${rounding})</h3>
<table>
<tr><th></th><th>Particulars</th><th>3 months ended</th><th>Year to date</th></tr>
<tr><th>A</th><th>Date of start of reporting period</th><td>01-07-2025</td><td>01-04-2025</td></tr>
<tr><th>B</th><th>Date of end of reporting period</th><td>30-09-2025</td><td>30-09-2025</td></tr>
<tr><th>C</th><th>Whether results are audited or unaudited</th><td>Unaudited</td><td>Unaudited</td></tr>
<tr><th>D</th><th>Nature of report standalone or consolidated</th><td>${basis}</td><td>${basis}</td></tr>
<tr><th>1</th><th>Income</th><td></td><td></td></tr>
<tr><th></th><th>Revenue from operations</th><td>1,06,839.00</td><td>2,02,634.00</td></tr>
<tr><th></th><th>Other income</th><td>7,114.00</td><td>15,764.00</td></tr>
<tr><th></th><th>Total income</th><td>1,13,953.00</td><td>2,18,398.00</td></tr>
<tr><th>(e)</th><th>Finance costs</th><td>0.00</td><td>0.00</td></tr>
<tr><th>(f)</th><th>Depreciation, depletion and amortisation expense
<td>3,246.00</td><td>5,934.00</td></tr>
<tr><th></th><th>Total expenses</th><td>42,059.00</td><td>77,993.00</td></tr>
<tr><th>5</th><th>Total profit before tax</th><td>71,894.00</td><td>1,40,405.00</td></tr>
<tr><th>9</th><th>Total tax expenses</th><td>18,194.00</td><td>35,712.00</td></tr>
<tr><th>16</th><th>Total profit (loss) for period</th><td>55,702.00</td><td>1,09,519.00</td></tr>
<tr><th>17</th><th>Other comprehensive income net of taxes</th><td>1,160.00</td><td>1,012.00</td></tr>
<tr><th></th><th>Total profit or loss, attributable to non-controlling interests</th><td>(141.00)</td><td>(265.00)</td></tr>
<tr><th></th><th>Paid-up equity share capital</th><td>8,146.00</td><td>8,146.00</td></tr>
<tr><th></th><th>Face value of equity share capital</th><td>2</td><td>2</td></tr>
<tr><th></th><th>Basic earnings (loss) per share from continuing operations</th><td>13.50</td><td>26.36</td></tr>
<tr><th></th><th>Basic earnings (loss) per share from continuing and discontinued operations</th><td>13.56</td><td>26.65</td></tr>
<tr><th></th><th>Diluted earnings (loss) per share from continuing and discontinued operations</th><td>13.55</td><td>26.60</td></tr>
</table>
<h3 style="font-weight: bold">Remarks</h3><table><tr><th>Revenue from operations</th><td>999</td></tr></table>
</body></html>`;
}

test("a filing is read into rupees, from the quarter column, with per-share figures unscaled", () => {
  const { company, quarter } = parseFiling(filing());
  assert.deepEqual(company, { symbol: "ACME", isin: "INE000A01010", name: "Acme & Sons Limited" });
  assert.equal(quarter.basis, "consolidated");
  assert.deepEqual([quarter.periodStart, quarter.periodEnd, quarter.approvedOn], ["2025-07-01", "2025-09-30", "2025-11-11"]);
  assert.equal(quarter.audited, false);
  assert.equal(quarter.revenue, 10_683_900_000);
  assert.equal(quarter.otherIncome, 711_400_000);
  assert.equal(quarter.netProfit, 5_570_200_000);
  assert.equal(quarter.paidUpEquity, 814_600_000);
  assert.deepEqual([quarter.faceValue, quarter.epsBasic, quarter.epsDiluted], [2, 13.56, 13.55]);
});

test("an unclosed label cell does not swallow its number", () => {
  assert.equal(parseFiling(filing()).quarter.depreciation, 324_600_000);
});

test("commented-out markup inside a cell is ignored", () => {
  const page = filing({ rounding: "Crores" }).replace("<td>Crores</td>", "<td>Crores <!-- <span>old</span> --></td>");
  assert.equal(parseFiling(page).quarter.revenue, 1_068_390_000_000);
});

test("without a rounding row the unit comes from the table's heading, then the currency row", () => {
  const noRow = filing().replace(/<tr><th>Level of rounding[\s\S]*?<\/tr>/, "");
  assert.equal(parseFiling(noRow).quarter.revenue, 10_683_900_000);
  const actuals = noRow.replace(/<h3 style="color:red">[\s\S]*?<\/h3>/, "")
    .replace("</table>", "<tr><th>Description of presentation currency</th><td>INR (in Actuals)</td></tr></table>");
  assert.equal(parseFiling(actuals).quarter.revenue, 106_839);
  assert.throws(() => parseFiling(noRow.replace(/<h3 style="color:red">[\s\S]*?<\/h3>/, "")), FilingFormatError);
});

test("dates with month names are read too", () => {
  const page = filing().replace("<td>01-07-2025</td>", "<td>01-Jul-2025</td>").replace("<td>30-09-2025</td>", "<td>30-Sep-2025</td>");
  const { quarter } = parseFiling(page);
  assert.deepEqual([quarter.periodStart, quarter.periodEnd], ["2025-07-01", "2025-09-30"]);
});

test("the rounding level scales amounts; an unknown one is refused", () => {
  assert.equal(parseFiling(filing({ rounding: "Crores" })).quarter.revenue, 1_068_390_000_000);
  assert.throws(() => parseFiling(filing({ rounding: "Bushels" })), FilingFormatError);
});

test("a page that is not an IndAS integrated filing is refused, not half-read", () => {
  assert.throws(() => parseFiling(filing({ heading: "Integrated Filing &mdash; Banking" })), FilingFormatError);
  assert.throws(() => parseFiling("<html><body>Access denied</body></html>"), FilingFormatError);
});

test("amounts: Indian grouping, brackets for negatives, and text is not a number", () => {
  assert.equal(parseAmount("1,06,839.00"), 106839);
  assert.equal(parseAmount("(141.00)"), -141);
  assert.equal(parseAmount("-6300000"), -6300000);
  assert.equal(parseAmount("Unaudited"), null);
  assert.equal(parseAmount(""), null);
});

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

test("an XBRL instance is read from the quarter's context, in rupees as filed", () => {
  const fact = (name, context, value) => `<in-bse-fin:${name} contextRef="${context}" unitRef="INR" decimals="-7">${value}</in-bse-fin:${name}>`;
  const text = (name, value) => `<in-bse-fin:${name} contextRef="OneD">${value}</in-bse-fin:${name}>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance">
${text("Symbol", "ITC")}${text("NameOfTheCompany", "ITC Limited")}
${text("DateOfBoardMeetingWhenFinancialResultsWereApproved", "2025-02-06")}
${text("LevelOfRoundingUsedInFinancialStatements", "Crores")}
${text("DateOfStartOfReportingPeriod", "2024-10-01")}${text("DateOfEndOfReportingPeriod", "2024-12-31")}
${text("WhetherResultsAreAuditedOrUnaudited", "Unaudited")}${text("NatureOfReportStandaloneConsolidated", "Consolidated")}
${fact("RevenueFromOperations", "OneD", "203499600000.00")}${fact("RevenueFromOperations", "FourD", "612364200000.00")}
${fact("RevenueFromOperations", "OneReportableSegmentRevenue01D", "1.00")}
${fact("ProfitLossForPeriod", "OneD", "50131800000.00")}${fact("Expenses", "OneD", "144138600000.00")}
${fact("PaidUpValueOfEquityShareCapital", "OneD", "12511700000.00")}
<in-bse-fin:FaceValueOfEquityShareCapital contextRef="OneD" unitRef="INRPerShare" decimals="INF">1</in-bse-fin:FaceValueOfEquityShareCapital>
<in-bse-fin:BasicEarningsLossPerShareFromContinuingOperations contextRef="OneD" unitRef="INRPerShare" decimals="INF">3.79</in-bse-fin:BasicEarningsLossPerShareFromContinuingOperations>
<in-bse-fin:BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations contextRef="OneD" unitRef="INRPerShare" decimals="INF">3.95</in-bse-fin:BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations>
</xbrli:xbrl>`;
  const { company, quarter } = parseAny(xml);
  assert.deepEqual(company, { symbol: "ITC", isin: null, name: "ITC Limited" });
  assert.deepEqual([quarter.basis, quarter.periodStart, quarter.periodEnd, quarter.approvedOn, quarter.audited],
    ["consolidated", "2024-10-01", "2024-12-31", "2025-02-06", false]);
  assert.equal(quarter.revenue, 203_499_600_000);
  assert.equal(quarter.netProfit, 50_131_800_000);
  assert.deepEqual([quarter.faceValue, quarter.epsBasic, quarter.tax], [1, 3.95, null]);
  assert.throws(() => parseXbrl(xml.replaceAll("RevenueFromOperations", "InterestEarned")), FilingFormatError);
  assert.equal(parseAny(filing()).company.symbol, "ACME");
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
