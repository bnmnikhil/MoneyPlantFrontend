import test from "node:test";
import assert from "node:assert/strict";
import { annualColumns, cagr, growthRows, yearEndMonth, yearEndName } from "../src/features/research/annual.ts";
import { resultRows } from "../src/features/research/fundamentals.ts";

const ends = { 3: "31", 6: "30", 9: "30", 12: "31" };
const quarter = (periodEnd, over = {}) => ({
  basis: "consolidated", periodStart: "", periodEnd, audited: Number(periodEnd.slice(5, 7)) === 3, approvedOn: null,
  revenue: 100e7, otherIncome: 5e7, totalIncome: 105e7, financeCosts: 1e7, depreciation: 4e7, totalExpenses: 65e7,
  exceptionalItems: 0, profitBeforeTax: 40e7, tax: 10e7, profitDiscontinued: 0, netProfit: 30e7, netProfitOwners: 30e7,
  paidUpEquity: 10e7, faceValue: 1, epsBasic: 3, epsDiluted: 3, filing: null, ...over,
});
/** Quarters from (year, month) for n quarters, every value scaled by `grow` a year. */
function run(year, month, n, grow = 1, over = () => ({})) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const m = ((month - 1 + 3 * i) % 12) + 1;
    const y = year + Math.floor((month - 1 + 3 * i) / 12);
    const scale = Math.pow(grow, i / 4);
    out.push(quarter(`${y}-${String(m).padStart(2, "0")}-${ends[m]}`, {
      revenue: 100e7 * scale, netProfit: 30e7 * scale, ...over(y, m),
    }));
  }
  return out;
}

test("a March year sums its four quarters, June to March, and is labelled FY", () => {
  const cols = annualColumns(run(2024, 6, 4));
  assert.equal(cols.length, 1);
  assert.equal(cols[0].label, "FY25");
  assert.equal(cols[0].kind, "year");
  assert.equal(cols[0].result.revenue, 400e7);
  assert.equal(cols[0].result.netProfit, 120e7);
  assert.equal(cols[0].result.epsBasic, 12);
  const rows = Object.fromEntries(resultRows([cols[0].result]).map((r) => [r.label, r.cells[0]]));
  assert.equal(rows["Revenue from operations"], "400");
  assert.equal(rows["Operating margin"], "40%", "the quarterly table's rows apply unchanged");
});

test("a year with a quarter missing is left out rather than stitched together", () => {
  const quarters = run(2023, 6, 8).filter((q) => q.periodEnd !== "2024-09-30");
  assert.deepEqual(annualColumns(quarters).map((c) => c.label), ["FY24"], "FY25 lost its Sep 2024 quarter");
});

test("a line any quarter did not state makes the year's line a dash, not a partial sum", () => {
  const quarters = run(2024, 6, 4, 1, (y, m) => (m === 9 ? { depreciation: null } : {}));
  const rows = Object.fromEntries(resultRows([annualColumns(quarters)[0].result]).map((r) => [r.label, r.cells[0]]));
  assert.equal(rows["Depreciation"], "—");
  assert.equal(rows["Operating profit"], "—");
  assert.equal(rows["Net profit"], "120");
});

test("TTM follows the years when the latest quarter is not a year end", () => {
  const cols = annualColumns(run(2024, 6, 6));
  assert.deepEqual(cols.map((c) => c.label), ["FY25", "TTM"]);
  assert.equal(cols[1].result.periodEnd, "2025-09-30");
  assert.deepEqual(annualColumns(run(2024, 6, 4)).map((c) => c.label), ["FY25"], "no TTM at a year end: it would repeat the year");
});

test("the year end is the company's own: Siemens ends in September", () => {
  const quarters = run(2024, 12, 8).map((q) => ({ ...q, audited: q.periodEnd.slice(5, 7) === "09" }));
  assert.equal(yearEndMonth(quarters), 9);
  assert.equal(yearEndName(quarters), "Sep");
  assert.deepEqual(annualColumns(quarters).map((c) => c.label), ["Sep 2025", "Sep 2026"]);
  assert.deepEqual(annualColumns(quarters.slice(0, 7)).map((c) => c.label), ["Sep 2025", "TTM"], "Jun 2026 latest: TTM");
  assert.equal(yearEndMonth([]), 3, "March when nothing says otherwise");
});

test("at most ten years, the latest", () => {
  const cols = annualColumns(run(2012, 6, 4 * 13));
  assert.equal(cols.length, 10);
  assert.equal(cols[cols.length - 1].label, "FY25");
});

test("growth compounds over 3, 5 and 7 full years and dashes when there are too few or a loss at either end", () => {
  assert.ok(Math.abs(cagr(100, 133.1, 3) - 10) < 1e-9);
  assert.equal(cagr(-5, 100, 3), null);
  assert.equal(cagr(100, null, 3), null);
  const cols = annualColumns(run(2018, 6, 4 * 6, 1.1)); // FY19..FY24, six years growing 10% a year
  const [revenue, profit] = growthRows(cols);
  assert.deepEqual(revenue.cells.map((c) => c.value), ["10.0%", "10.0%", "—"]);
  assert.equal(revenue.cells[0].tone, "up");
  assert.deepEqual(profit.cells.map((c) => c.value), ["10.0%", "10.0%", "—"]);
  const shrinking = growthRows(annualColumns(run(2018, 6, 4 * 4, 0.9)));
  assert.equal(shrinking[0].cells[0].value, "−10.0%");
  assert.equal(shrinking[0].cells[0].tone, "down");
});
