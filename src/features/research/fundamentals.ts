/**
 * A stock's quarterly results as the stock page shows them. Pure, so the arithmetic and the
 * "dash, not a guess" rules are tested without rendering.
 *
 * The data is `GET /api/research/stocks/{symbol}`, read by the backend from the company's own
 * filings with NSE. Amounts are rupees; per-share figures are rupees per share.
 */
import type { Basis, PriceSummary, QuarterResult, StockFundamentals } from "@/types/api";

export type { Basis, PriceSummary, QuarterResult, StockFundamentals };

/** A window this full counts as a year of trading; fewer days and the tile says how many. */
const FULL_YEAR_DAYS = 240;

/** The 52-week tile from stored daily prices; a dash with the reason when there are none. */
export function rangeFigure(range: PriceSummary | null | undefined): { value: string; note: string } {
  if (!range) return { value: DASH, note: "Needs price history" };
  const value = `₹${twoDp.format(range.low52w)} – ₹${twoDp.format(range.high52w)}`;
  return range.days >= FULL_YEAR_DAYS
    ? { value, note: `To the close of ${dateLabel(range.lastDate)}` }
    : { value, note: `From ${range.days} trading day${range.days === 1 ? "" : "s"} since ${dateLabel(range.since)}` };
}

/**
 * What a 404 from the results endpoint means. Outside the page's audience the answer is a bare
 * 404 (the endpoint does not announce itself); inside it, `STOCK_NOT_LOADED` means the stock
 * simply has no results yet.
 */
export function missingKind(body: unknown): "not-loaded" | "hidden" {
  return typeof body === "object" && body !== null && (body as { error?: unknown }).error === "STOCK_NOT_LOADED"
    ? "not-loaded"
    : "hidden";
}

/** True when any shown quarter carries a non-zero figure: an empty row would only be noise. */
function anyNonZero(quarters: QuarterResult[], pick: (q: QuarterResult) => number | null | undefined): boolean {
  return quarters.some((q) => {
    const value = pick(q);
    return value !== null && value !== undefined && value !== 0;
  });
}

const CRORE = 1e7;
const DASH = "—";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const crore = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const twoDp = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "2025-09-30" → "Sep 2025". */
export function quarterLabel(periodEnd: string): string {
  const [year, month] = periodEnd.split("-");
  return `${MONTHS[Number(month) - 1] ?? "?"} ${year}`;
}

/** "2025-11-11" → "11 Nov 2025". */
export function dateLabel(iso: string | null): string {
  if (!iso) return DASH;
  const [year, month, day] = iso.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? "?"} ${year}`;
}

/** Whole crores, Indian grouping; negatives with a real minus. */
export function inCrore(rupees: number | null): string {
  if (rupees === null || !Number.isFinite(rupees)) return DASH;
  const value = Math.round(rupees / CRORE);
  return value < 0 ? `−${crore.format(-value)}` : crore.format(value);
}

/** The bases the file holds, consolidated first: what the switch offers. */
export function basesOf(data: StockFundamentals): Basis[] {
  return (["consolidated", "standalone"] as const).filter((basis) => data.quarters.some((q) => q.basis === basis));
}

/** One basis, oldest first, at most the latest `count` quarters. */
export function quartersFor(data: StockFundamentals, basis: Basis, count = 8): QuarterResult[] {
  return data.quarters
    .filter((q) => q.basis === basis)
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))
    .slice(-count);
}

/**
 * Operating profit as Screener-style pages define it: revenue less expenses other than
 * interest and depreciation. Null when a part is missing, never a partial sum.
 */
export function operatingProfit(q: QuarterResult): number | null {
  if (q.totalExpenses === null || q.financeCosts === null || q.depreciation === null) return null;
  return q.revenue - (q.totalExpenses - q.financeCosts - q.depreciation);
}

export interface ResultRow {
  label: string;
  strong: boolean;
  cells: string[];
}

export function resultRows(quarters: QuarterResult[]): ResultRow[] {
  const row = (label: string, strong: boolean, cell: (q: QuarterResult) => string): ResultRow =>
    ({ label, strong, cells: quarters.map(cell) });
  return [
    row("Revenue from operations", true, (q) => inCrore(q.revenue)),
    row("Expenses", false, (q) => {
      const profit = operatingProfit(q);
      return profit === null ? DASH : inCrore(q.revenue - profit);
    }),
    row("Operating profit", true, (q) => inCrore(operatingProfit(q))),
    row("Operating margin", false, (q) => {
      const profit = operatingProfit(q);
      return profit === null || q.revenue <= 0 ? DASH : `${Math.round((profit / q.revenue) * 100)}%`;
    }),
    row("Other income", false, (q) => inCrore(q.otherIncome)),
    row("Interest", false, (q) => inCrore(q.financeCosts)),
    row("Depreciation", false, (q) => inCrore(q.depreciation)),
    // One-offs get a row only when a shown quarter has one, so a quarter like ITC's Mar 2025
    // (the hotels demerger) explains itself without an empty line everywhere else.
    ...(anyNonZero(quarters, (q) => q.exceptionalItems)
      ? [row("Exceptional items", false, (q) => inCrore(q.exceptionalItems ?? null))] : []),
    row("Profit before tax", false, (q) => inCrore(q.profitBeforeTax)),
    row("Tax", false, (q) => inCrore(q.tax)),
    ...(anyNonZero(quarters, (q) => q.profitDiscontinued)
      ? [row("Profit from discontinued operations", false, (q) => inCrore(q.profitDiscontinued ?? null))] : []),
    row("Net profit", true, (q) => inCrore(q.netProfit)),
    row("EPS (₹)", false, (q) => (q.epsBasic === null ? DASH : twoDp.format(q.epsBasic))),
  ];
}

/** True when the four quarters are consecutive: each ends about three months after the last. */
function consecutive(quarters: QuarterResult[]): boolean {
  return quarters.every((q, index) => {
    if (index === 0) return true;
    const days = (Date.parse(q.periodEnd) - Date.parse(quarters[index - 1].periodEnd)) / 86_400_000;
    return days > 80 && days < 100;
  });
}

/** EPS over the latest four consecutive quarters; null with fewer, or with a gap. */
export function trailingEps(quarters: QuarterResult[]): number | null {
  const last = quarters.slice(-4);
  if (last.length < 4 || !consecutive(last) || last.some((q) => q.epsBasic === null)) return null;
  return last.reduce((sum, q) => sum + (q.epsBasic as number), 0);
}

/**
 * True when the newest quarter loaded ended more than about seven months ago: a later result
 * has certainly been published, so anything pairing these figures with today's price is off.
 */
export function resultsAreStale(latestPeriodEnd: string, today = new Date()): boolean {
  return (today.getTime() - Date.parse(latestPeriodEnd)) / 86_400_000 > 215;
}

export interface KeyFigure {
  label: string;
  value: string;
  note: string;
}

/**
 * The tiles above the table. `price` is the live spot, or null when nothing could quote it.
 * A figure whose inputs are incomplete is a dash with the reason, never an estimate.
 */
export function keyFigures(quarters: QuarterResult[], price: number | null, today = new Date(),
  range: PriceSummary | null = null): KeyFigure[] {
  const latest = quarters.at(-1);
  const stale = !!latest && resultsAreStale(latest.periodEnd, today);
  const upTo = latest ? quarterLabel(latest.periodEnd) : "";
  const shares = latest?.paidUpEquity && latest.faceValue ? latest.paidUpEquity / latest.faceValue : null;
  const eps = trailingEps(quarters);
  const margin = latest ? operatingProfit(latest) : null;
  const priced = price !== null && Number.isFinite(price) && price > 0;

  const lakhCrore = shares !== null && priced ? (price * shares) / 1e12 : null;
  return [
    {
      label: "Market cap",
      value: lakhCrore === null ? DASH
        : lakhCrore >= 1 ? `₹${lakhCrore.toFixed(2)} lakh cr` : `₹${inCrore((price as number) * (shares as number))} cr`,
      note: lakhCrore === null ? (priced ? "Share count not in the filing" : "Needs a live price")
        : stale ? `Price × shares as of ${upTo}` : "Price × shares outstanding",
    },
    {
      // Today's price over old earnings is not a P/E anyone should read.
      label: "P/E",
      value: eps !== null && eps > 0 && priced && !stale ? (price / eps).toFixed(1) : DASH,
      note: eps === null ? "Needs four consecutive quarters" : eps <= 0 ? "No earnings over four quarters"
        : stale ? `Latest results loaded are ${upTo}` : priced ? "Price ÷ last four quarters' EPS" : "Needs a live price",
    },
    {
      label: "EPS, last four quarters",
      value: eps === null ? DASH : `₹${twoDp.format(eps)}`,
      note: eps === null ? "Needs four consecutive quarters" : `Four quarters to ${upTo}`,
    },
    {
      label: "Operating margin",
      value: latest && margin !== null && latest.revenue > 0 ? `${Math.round((margin / latest.revenue) * 100)}%` : DASH,
      note: latest ? `Quarter ended ${quarterLabel(latest.periodEnd)}` : "No results loaded",
    },
    { label: "Dividend yield", value: DASH, note: "Needs dividend data" },
    { label: "52-week range", ...rangeFigure(range) },
  ];
}

export interface ChartBar {
  label: string;
  revenue: string;
  /** Bar heights as a share of the tallest revenue bar, 0 to 100. A loss draws no profit bar. */
  revenuePct: number;
  profitPct: number;
}

export function chartBars(quarters: QuarterResult[]): ChartBar[] {
  const top = Math.max(0, ...quarters.map((q) => q.revenue));
  return quarters.map((q) => ({
    label: quarterLabel(q.periodEnd),
    revenue: inCrore(q.revenue),
    revenuePct: top > 0 ? Math.max(0, (q.revenue / top) * 100) : 0,
    profitPct: top > 0 ? Math.max(0, (q.netProfit / top) * 100) : 0,
  }));
}

/** The user's own book in this stock, one block per broker account. */
export interface ExposureAccount {
  connectionId: string;
  broker: string;
  lines: { text: string; pnl: number }[];
  pnl: number;
}

interface PositionLike {
  connectionId: string;
  broker: string;
  symbol: string;
  underlying: string | null;
  qty: number;
  pnl: number;
}

interface HoldingLike {
  connectionId: string;
  broker: string;
  underlying: string;
  qty: number;
  avgCost: number;
  pnl: number;
}

export function exposureIn(symbol: string, positions: PositionLike[], holdings: HoldingLike[]): ExposureAccount[] {
  const accounts = new Map<string, ExposureAccount>();
  const account = (connectionId: string, broker: string) => {
    let found = accounts.get(connectionId);
    if (!found) accounts.set(connectionId, (found = { connectionId, broker, lines: [], pnl: 0 }));
    return found;
  };
  for (const p of positions) {
    if (p.underlying !== symbol || p.qty === 0) continue;
    const entry = account(p.connectionId, p.broker);
    entry.lines.push({ text: `${p.qty > 0 ? "Long" : "Short"} ${Math.abs(p.qty)} · ${p.symbol}`, pnl: p.pnl });
    entry.pnl += p.pnl;
  }
  for (const h of holdings) {
    if (h.underlying !== symbol || h.qty === 0) continue;
    const entry = account(h.connectionId, h.broker);
    entry.lines.push({ text: `${h.qty} shares · avg ₹${twoDp.format(h.avgCost)}`, pnl: h.pnl });
    entry.pnl += h.pnl;
  }
  return [...accounts.values()].sort((a, b) => a.connectionId.localeCompare(b.connectionId));
}
