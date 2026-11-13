/**
 * The Research search page: find a loaded company by symbol or name, and sort the list by the
 * figures the backend derives from its filings. Pure, so the matching and the "dash, not a guess"
 * rules are tested without rendering.
 *
 * The data is `GET /api/research/stocks`, one row per company with results loaded. The list is
 * small (tens of companies, a few thousand at most), so it is filtered here, not on the server.
 */
import type { StockListing } from "@/types/api";
import { dateLabel, inCrore, quarterLabel, resultsAreStale } from "./fundamentals.ts";

export type { StockListing };

const DASH = "—";
const twoDp = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const oneDp = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Letters and digits only, upper-cased: "m&m" and "MM" both find M&M, "bajaj auto" finds BAJAJ-AUTO. */
function compact(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * How well a company matches the query, lower is better; null when it does not match.
 * 0 the exact symbol, 1 the symbol's start, 2 the start of a word in the name, 3 anywhere.
 */
export function matchRank(stock: Pick<StockListing, "symbol" | "name">, query: string): number | null {
  const q = compact(query);
  if (!q) return 3;
  const symbol = compact(stock.symbol);
  if (symbol === q) return 0;
  if (symbol.startsWith(q)) return 1;
  const words = stock.name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  // A query typed with spaces ("tata steel") is matched against the words run together.
  for (let i = 0; i < words.length; i++) {
    if (words.slice(i).join("").startsWith(q)) return 2;
  }
  return symbol.includes(q) || compact(stock.name).includes(q) ? 3 : null;
}

/** The companies matching the query, best match first; ties keep the order they came in. */
export function searchStocks<T extends Pick<StockListing, "symbol" | "name">>(stocks: T[], query: string): T[] {
  if (!compact(query)) return stocks;
  return stocks
    .map((stock, index) => ({ stock, index, rank: matchRank(stock, query) }))
    .filter((entry): entry is { stock: T; index: number; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.stock);
}

/** The latest close over the one before it, in percent; null without both. */
export function dayChangePct(stock: Pick<StockListing, "close" | "prevClose">): number | null {
  const { close, prevClose } = stock;
  if (close === null || prevClose === null || prevClose <= 0) return null;
  return ((close - prevClose) / prevClose) * 100;
}

/**
 * Price over trailing EPS, from the latest stored close. None for a loss (no meaningful P/E), when
 * trailing EPS is incomplete, or when the latest quarter is so old that a later one is certainly out.
 */
export function peRatio(stock: Pick<StockListing, "close" | "ttmEps" | "latestQuarter">, today = new Date()): number | null {
  const { close, ttmEps } = stock;
  if (close === null || ttmEps === null || ttmEps <= 0) return null;
  if (resultsAreStale(stock.latestQuarter, today)) return null;
  return close / ttmEps;
}

export type SortKey = "symbol" | "change" | "pe" | "revenue" | "profit" | "margin" | "revenueGrowth" | "profitGrowth";
export type SortDir = "asc" | "desc";

export const SORT_KEYS: readonly SortKey[] = ["symbol", "change", "pe", "revenue", "profit", "margin", "revenueGrowth", "profitGrowth"];

function sortValue(stock: StockListing, key: Exclude<SortKey, "symbol">, today: Date): number | null {
  switch (key) {
    case "change": return dayChangePct(stock);
    case "pe": return peRatio(stock, today);
    case "revenue": return stock.ttmRevenue;
    case "profit": return stock.ttmNetProfit;
    case "margin": return stock.operatingMarginPct;
    case "revenueGrowth": return stock.ttmRevenueGrowthPct;
    case "profitGrowth": return stock.ttmProfitGrowthPct;
  }
}

/** Sorted copy. A missing figure always sorts last, whichever way the column runs. */
export function sortStocks(stocks: StockListing[], key: SortKey, dir: SortDir, today = new Date()): StockListing[] {
  const sign = dir === "asc" ? 1 : -1;
  if (key === "symbol") return [...stocks].sort((a, b) => sign * a.symbol.localeCompare(b.symbol));
  return [...stocks].sort((a, b) => {
    const x = sortValue(a, key, today);
    const y = sortValue(b, key, today);
    if (x === null || y === null) return x === null ? (y === null ? a.symbol.localeCompare(b.symbol) : 1) : -1;
    return sign * (x - y) || a.symbol.localeCompare(b.symbol);
  });
}

function signedPct(value: number | null, format: Intl.NumberFormat): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  const text = format.format(Math.abs(value));
  return value > 0 ? `+${text}%` : value < 0 ? `−${text}%` : `${text}%`;
}

export type Tone = "up" | "down" | "flat";

function toneOf(value: number | null): Tone {
  return value === null || value === 0 ? "flat" : value > 0 ? "up" : "down";
}

/** One row as the table prints it. */
export interface ListingRow {
  symbol: string;
  name: string;
  price: string;
  priceNote: string;
  change: string;
  changeTone: Tone;
  pe: string;
  revenue: string;
  profit: string;
  profitTone: Tone;
  margin: string;
  revenueGrowth: string;
  revenueGrowthTone: Tone;
  profitGrowth: string;
  profitGrowthTone: Tone;
  latest: string;
  basis: string;
}

export function listingRow(stock: StockListing, today = new Date()): ListingRow {
  const change = dayChangePct(stock);
  const pe = peRatio(stock, today);
  return {
    symbol: stock.symbol,
    name: stock.name,
    price: stock.close === null ? DASH : `₹${twoDp.format(stock.close)}`,
    priceNote: stock.priceDate ? `Close of ${dateLabel(stock.priceDate)}` : "No prices loaded",
    change: signedPct(change, twoDp),
    changeTone: toneOf(change),
    pe: pe === null ? DASH : oneDp.format(pe),
    revenue: inCrore(stock.ttmRevenue),
    profit: inCrore(stock.ttmNetProfit),
    profitTone: stock.ttmNetProfit !== null && stock.ttmNetProfit < 0 ? "down" : "flat",
    margin: stock.operatingMarginPct === null ? DASH : `${oneDp.format(stock.operatingMarginPct)}%`,
    revenueGrowth: signedPct(stock.ttmRevenueGrowthPct, oneDp),
    revenueGrowthTone: toneOf(stock.ttmRevenueGrowthPct),
    profitGrowth: signedPct(stock.ttmProfitGrowthPct, oneDp),
    profitGrowthTone: toneOf(stock.ttmProfitGrowthPct),
    latest: quarterLabel(stock.latestQuarter),
    basis: stock.basis === "consolidated" ? "Consolidated" : "Standalone",
  };
}

/** Reads `?sort=` from the address bar, falling back to symbol order for anything unknown. */
export function parseSort(value: string | null): { key: SortKey; dir: SortDir } {
  const [key, dir] = (value ?? "").split(".");
  const known = (SORT_KEYS as readonly string[]).includes(key) ? (key as SortKey) : "symbol";
  return { key: known, dir: dir === "desc" ? "desc" : dir === "asc" ? "asc" : known === "symbol" ? "asc" : "desc" };
}
