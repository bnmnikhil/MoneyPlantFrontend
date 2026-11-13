import test from "node:test";
import assert from "node:assert/strict";
import {
  dayChangePct, listingRow, matchRank, parseSort, peRatio, searchStocks, sortStocks,
} from "../src/features/research/search.ts";
import { alsoActive, primaryNavItems, visibleNavItems } from "../src/components/layout/nav.ts";

const today = new Date("2026-11-13T10:00:00Z");
const stock = (symbol, name, over = {}) => ({
  symbol, name, basis: "consolidated", latestQuarter: "2026-09-30", quarters: 34,
  ttmRevenue: 1000e7, ttmNetProfit: 100e7, ttmEps: 10, ttmRevenueGrowthPct: 5, ttmProfitGrowthPct: 8,
  operatingMarginPct: 20, priceDate: "2026-11-12", close: 200, prevClose: 190, ...over,
});
const universe = [
  stock("BAJAJ-AUTO", "Bajaj Auto Limited"),
  stock("INFY", "Infosys Limited"),
  stock("ITC", "ITC Limited"),
  stock("M&M", "Mahindra & Mahindra Limited"),
  stock("TATASTEEL", "Tata Steel Limited"),
  stock("TCS", "Tata Consultancy Services Limited"),
];

test("the exact symbol first, then symbols that start with it, then name words, then anywhere", () => {
  assert.deepEqual(searchStocks(universe, "tcs").map((s) => s.symbol), ["TCS"]);
  assert.deepEqual(searchStocks(universe, "tata").map((s) => s.symbol), ["TATASTEEL", "TCS"]);
  assert.deepEqual(searchStocks(universe, "i").map((s) => s.symbol), ["INFY", "ITC", "BAJAJ-AUTO", "M&M", "TATASTEEL", "TCS"]);
  assert.equal(matchRank(universe[1], "infosys"), 2);
  assert.equal(matchRank(universe[5], "consultancy"), 2);
  assert.equal(matchRank(universe[5], "sultan"), 3);
  assert.equal(matchRank(universe[5], "wipro"), null);
});

test("punctuation and spaces do not get in the way", () => {
  assert.deepEqual(searchStocks(universe, "m&m").map((s) => s.symbol), ["M&M"]);
  assert.deepEqual(searchStocks(universe, "MM").map((s) => s.symbol), ["M&M"]);
  assert.deepEqual(searchStocks(universe, "bajaj auto").map((s) => s.symbol), ["BAJAJ-AUTO"]);
  assert.deepEqual(searchStocks(universe, "tata steel").map((s) => s.symbol), ["TATASTEEL"]);
  assert.equal(searchStocks(universe, "  ").length, universe.length, "a blank query lists everything");
  assert.deepEqual(searchStocks(universe, "-&"), universe, "nothing searchable is no filter");
});

test("P/E needs a positive trailing EPS, a close and a quarter that is not stale", () => {
  assert.equal(peRatio(stock("A", "A"), today), 20);
  assert.equal(peRatio(stock("A", "A", { ttmEps: -2 }), today), null, "a loss has no meaningful P/E");
  assert.equal(peRatio(stock("A", "A", { ttmEps: null }), today), null);
  assert.equal(peRatio(stock("A", "A", { close: null }), today), null);
  assert.equal(peRatio(stock("A", "A", { latestQuarter: "2025-12-31" }), today), null, "a later quarter is certainly out");
});

test("the day's change needs both closes", () => {
  assert.ok(Math.abs(dayChangePct(stock("A", "A")) - 5.263) < 0.001);
  assert.equal(dayChangePct(stock("A", "A", { prevClose: null })), null);
  assert.equal(dayChangePct(stock("A", "A", { prevClose: 0 })), null);
});

test("sorting puts a missing figure last whichever way the column runs", () => {
  const rows = [
    stock("A", "A", { ttmRevenue: 300e7 }),
    stock("B", "B", { ttmRevenue: null }),
    stock("C", "C", { ttmRevenue: 100e7 }),
    stock("D", "D", { ttmRevenue: 200e7 }),
  ];
  assert.deepEqual(sortStocks(rows, "revenue", "desc", today).map((s) => s.symbol), ["A", "D", "C", "B"]);
  assert.deepEqual(sortStocks(rows, "revenue", "asc", today).map((s) => s.symbol), ["C", "D", "A", "B"]);
  assert.deepEqual(sortStocks(rows, "symbol", "desc", today).map((s) => s.symbol), ["D", "C", "B", "A"]);
  const pe = [stock("X", "X", { ttmEps: -1 }), stock("Y", "Y", { ttmEps: 20 }), stock("Z", "Z", { ttmEps: 5 })];
  assert.deepEqual(sortStocks(pe, "pe", "asc", today).map((s) => s.symbol), ["Y", "Z", "X"], "a loss-maker has no P/E to rank");
});

test("a row prints dashes, not guesses, and signs with a real minus", () => {
  const row = listingRow(stock("LT", "Larsen", {
    ttmNetProfit: -3591e7, ttmProfitGrowthPct: -12.34, ttmRevenueGrowthPct: null, ttmEps: null, close: null, priceDate: null,
  }), today);
  assert.equal(row.price, "—");
  assert.equal(row.priceNote, "No prices loaded");
  assert.equal(row.change, "—");
  assert.equal(row.pe, "—");
  assert.equal(row.profit, "−3,591");
  assert.equal(row.profitTone, "down");
  assert.equal(row.profitGrowth, "−12.3%");
  assert.equal(row.revenueGrowth, "—");
  assert.equal(row.latest, "Sep 2026");

  const full = listingRow(stock("ITC", "ITC Limited", { ttmRevenue: 7_54_321e7, close: 412.5 }), today);
  assert.equal(full.price, "₹412.50");
  assert.equal(full.change, "+117.11%");
  assert.equal(full.revenue, "7,54,321");
  assert.equal(full.margin, "20.0%");
  assert.equal(full.pe, "41.3");
});

test("the sort in the address bar falls back to symbol order", () => {
  assert.deepEqual(parseSort(null), { key: "symbol", dir: "asc" });
  assert.deepEqual(parseSort("pe.asc"), { key: "pe", dir: "asc" });
  assert.deepEqual(parseSort("revenue"), { key: "revenue", dir: "desc" });
  assert.deepEqual(parseSort("price.desc"), { key: "symbol", dir: "desc" });
});

test("the Research tab shows only where Research answers, and lights up on stock pages", () => {
  const research = primaryNavItems.find((item) => item.label === "Research");
  assert.ok(research, "Research is a primary tab");
  assert.ok(!visibleNavItems(primaryNavItems, false).includes(research));
  assert.ok(visibleNavItems(primaryNavItems, true).includes(research));
  assert.equal(visibleNavItems(primaryNavItems, false).length, primaryNavItems.length - 1);
  assert.equal(alsoActive(research, "/app/stocks/ITC"), true);
  assert.equal(alsoActive(research, "/app/positions"), false);
});
