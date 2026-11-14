/**
 * Yearly profit and loss for the stock page (AN-28), built from the quarters already stored: a
 * financial year is the sum of its four quarters, shown only when all four are there and follow on
 * from each other. Pure, so the grouping and the "dash, not a guess" rules are tested without
 * rendering.
 *
 * The year end is the company's own: the month its audited (year-end) quarters fall in, March for
 * most, September for Siemens. A year that does not line up with it, such as the calendar years a
 * company filed before changing its year end, is left out rather than stitched from other quarters.
 */
import type { QuarterResult } from "@/types/api";
import { quarterLabel } from "./fundamentals.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function month(periodEnd: string): number {
  return Number(periodEnd.slice(5, 7));
}

/** The month the company's year ends: the commonest month among its audited quarters, else March. */
export function yearEndMonth(quarters: QuarterResult[]): number {
  const counts = new Map<number, number>();
  for (const q of quarters) if (q.audited) counts.set(month(q.periodEnd), (counts.get(month(q.periodEnd)) ?? 0) + 1);
  let best = 3;
  let most = 0;
  for (const [m, n] of counts) if (n > most || (n === most && m === 3)) { best = m; most = n; }
  return best;
}

function consecutive(quarters: QuarterResult[]): boolean {
  return quarters.every((q, i) => {
    if (i === 0) return true;
    const days = (Date.parse(q.periodEnd) - Date.parse(quarters[i - 1].periodEnd)) / 86_400_000;
    return days > 80 && days < 100;
  });
}

/** A sum over the four quarters, or null when any of them did not state the line. */
function sum(quarters: QuarterResult[], pick: (q: QuarterResult) => number | null | undefined): number | null {
  let total = 0;
  for (const q of quarters) {
    const value = pick(q);
    if (value === null || value === undefined) return null;
    total += value;
  }
  return total;
}

/** Four quarters folded into one result, in the quarterly table's shape so its rows apply unchanged. */
function fold(quarters: QuarterResult[]): QuarterResult {
  const first = quarters[0];
  const last = quarters[quarters.length - 1];
  return {
    basis: last.basis,
    periodStart: first.periodStart,
    periodEnd: last.periodEnd,
    audited: last.audited,
    approvedOn: last.approvedOn,
    revenue: quarters.reduce((total, q) => total + q.revenue, 0),
    otherIncome: sum(quarters, (q) => q.otherIncome),
    totalIncome: sum(quarters, (q) => q.totalIncome),
    financeCosts: sum(quarters, (q) => q.financeCosts),
    depreciation: sum(quarters, (q) => q.depreciation),
    totalExpenses: sum(quarters, (q) => q.totalExpenses),
    // An older filing without the line means none was reported, as the quarterly table reads it.
    exceptionalItems: sum(quarters, (q) => q.exceptionalItems ?? 0),
    profitBeforeTax: sum(quarters, (q) => q.profitBeforeTax),
    tax: sum(quarters, (q) => q.tax),
    profitDiscontinued: sum(quarters, (q) => q.profitDiscontinued ?? 0),
    netProfit: quarters.reduce((total, q) => total + q.netProfit, 0),
    netProfitOwners: sum(quarters, (q) => q.netProfitOwners),
    paidUpEquity: last.paidUpEquity,
    faceValue: last.faceValue,
    epsBasic: sum(quarters, (q) => q.epsBasic),
    epsDiluted: sum(quarters, (q) => q.epsDiluted),
    filing: null,
  };
}

export interface AnnualColumn {
  /** "FY26" for a March year end, "Sep 2026" otherwise, "TTM" for the trailing four quarters. */
  label: string;
  kind: "year" | "ttm";
  result: QuarterResult;
}

function yearLabel(periodEnd: string, endMonth: number): string {
  return endMonth === 3 ? `FY${periodEnd.slice(2, 4)}` : quarterLabel(periodEnd);
}

/**
 * The financial years that have all four quarters, oldest first, at most the latest `count`, then
 * a TTM column when the latest quarter is not a year end and the four before it follow on.
 * `quarters` is one basis, oldest first.
 */
export function annualColumns(quarters: QuarterResult[], count = 10): AnnualColumn[] {
  const endMonth = yearEndMonth(quarters);
  const years: AnnualColumn[] = [];
  quarters.forEach((q, i) => {
    if (month(q.periodEnd) !== endMonth || i < 3) return;
    const four = quarters.slice(i - 3, i + 1);
    if (consecutive(four)) years.push({ label: yearLabel(q.periodEnd, endMonth), kind: "year", result: fold(four) });
  });
  const shown = years.slice(-count);
  const last = quarters[quarters.length - 1];
  const trailing = quarters.slice(-4);
  if (last && month(last.periodEnd) !== endMonth && trailing.length === 4 && consecutive(trailing)) {
    shown.push({ label: "TTM", kind: "ttm", result: fold(trailing) });
  }
  return shown;
}

/** Yearly growth compounded over `years`, in percent; null without both ends, or when either is not positive. */
export function cagr(first: number | null, last: number | null, years: number): number | null {
  if (first === null || last === null || first <= 0 || last <= 0 || years <= 0) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

export interface GrowthRow {
  label: string;
  /** One cell per span, 3, 5 and 7 years: "12.4%", or a dash with too few years or a loss at either end. */
  cells: { span: number; value: string; tone: "up" | "down" | "flat" }[];
}

const oneDp = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Revenue and net profit growth over 3, 5 and 7 full years, ending with the latest full year. The
 * start is the year ending exactly `span` years earlier, found by date: counting back along the list
 * would silently stretch the span across a year that is missing.
 */
export function growthRows(columns: AnnualColumn[], spans = [3, 5, 7]): GrowthRow[] {
  const years = columns.filter((c) => c.kind === "year").map((c) => c.result);
  const end = years[years.length - 1];
  const yearsBefore = (span: number) => {
    if (!end) return undefined;
    const target = `${Number(end.periodEnd.slice(0, 4)) - span}${end.periodEnd.slice(4, 7)}`;
    return years.find((q) => q.periodEnd.slice(0, 7) === target);
  };
  const row = (label: string, pick: (q: QuarterResult) => number): GrowthRow => ({
    label,
    cells: spans.map((span) => {
      const start = yearsBefore(span);
      const value = start && end ? cagr(pick(start), pick(end), span) : null;
      if (value === null) return { span, value: "—", tone: "flat" as const };
      const text = `${oneDp.format(Math.abs(value))}%`;
      return { span, value: value < 0 ? `−${text}` : text, tone: value > 0 ? "up" as const : value < 0 ? "down" as const : "flat" as const };
    }),
  });
  return [row("Revenue", (q) => q.revenue), row("Net profit", (q) => q.netProfit)];
}

/** "Mar" for the note under the table. */
export function yearEndName(quarters: QuarterResult[]): string {
  return MONTHS[yearEndMonth(quarters) - 1] ?? "Mar";
}
