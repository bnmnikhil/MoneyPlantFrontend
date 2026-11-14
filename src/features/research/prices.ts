/**
 * The stock page's price section (AN-26): close, volume and delivery from NSE's daily files, as
 * stored in `price_eod`. Pure, so ranges, averages and the "dash, not a guess" rules are tested
 * without rendering.
 *
 * Prices are as traded: a split or bonus inside the window shows as a cliff until corporate
 * actions are applied (AN-23). `adjusted` on the response says which.
 */
import type { DailyPrice, StockPrices } from "@/types/api";

export type { DailyPrice, StockPrices };

export type PriceRange = "1M" | "3M" | "6M" | "1Y";
export const PRICE_RANGES: readonly PriceRange[] = ["1M", "3M", "6M", "1Y"];
const RANGE_DAYS: Record<PriceRange, number> = { "1M": 30, "3M": 91, "6M": 182, "1Y": 365 };

const DASH = "—";
const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const twoDp = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const oneDp = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** The days within the range, counted back in calendar days from the latest stored day. */
export function daysInRange(days: DailyPrice[], range: PriceRange): DailyPrice[] {
  const last = days[days.length - 1];
  if (!last) return [];
  const from = Date.parse(last.date) - RANGE_DAYS[range] * DAY_MS;
  return days.filter((d) => Date.parse(d.date) > from);
}

/** One point of both panels: the close above, the volume split below. */
export interface PricePoint {
  date: string;
  close: number;
  /** The close before, from the file itself; null for the first day of a listing. */
  prevClose: number | null;
  volume: number | null;
  /** Shares taken as delivery; null when the file printed none, and then the whole bar is `notDelivered`. */
  delivered: number | null;
  notDelivered: number | null;
  deliveryPct: number | null;
}

export function pricePoints(days: DailyPrice[]): PricePoint[] {
  return days.map((d) => {
    const delivered = d.deliveryQty !== null && d.volume !== null ? Math.min(d.deliveryQty, d.volume) : null;
    return {
      date: d.date,
      close: d.close,
      prevClose: d.prevClose,
      volume: d.volume,
      delivered,
      notDelivered: d.volume === null ? null : d.volume - (delivered ?? 0),
      deliveryPct: d.deliveryPct,
    };
  });
}

function mean(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v));
  return known.length ? known.reduce((sum, v) => sum + v, 0) / known.length : null;
}

/** Delivery % averaged as traders quote it: a plain mean of the days, not weighted by volume. */
export function averageDelivery(days: DailyPrice[], lastN?: number): number | null {
  return mean((lastN ? days.slice(-lastN) : days).map((d) => d.deliveryPct));
}

export interface PriceFigures {
  /** The latest close and its date. */
  close: string;
  asOf: string;
  /** Change over the shown range, first close to last. */
  change: string;
  changeTone: "up" | "down" | "flat";
  high: string;
  low: string;
  /** Latest day's delivery %, then the 20-day and whole-range averages. */
  deliveryToday: string;
  delivery20: string;
  deliveryRange: string;
  /** Set when the stored days begin inside the range, so the range is shorter than it says. */
  shortNote: string | null;
}

function pct(value: number | null, format = oneDp): string {
  return value === null ? DASH : `${format.format(value)}%`;
}

function signed(value: number): string {
  const text = `${twoDp.format(Math.abs(value))}%`;
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text;
}

export function priceFigures(days: DailyPrice[], range: PriceRange): PriceFigures | null {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return null;
  const change = first.close > 0 ? ((last.close - first.close) / first.close) * 100 : null;
  const spanDays = (Date.parse(last.date) - Date.parse(first.date)) / DAY_MS;
  return {
    close: `₹${twoDp.format(last.close)}`,
    asOf: dateLabel(last.date),
    change: change === null ? DASH : signed(change),
    changeTone: change === null || change === 0 ? "flat" : change > 0 ? "up" : "down",
    high: `₹${twoDp.format(Math.max(...days.map((d) => d.high)))}`,
    low: `₹${twoDp.format(Math.min(...days.map((d) => d.low)))}`,
    deliveryToday: pct(last.deliveryPct),
    delivery20: pct(averageDelivery(days, 20)),
    deliveryRange: pct(averageDelivery(days)),
    // A month either side of slack: a 1Y window always starts a few days after its nominal start.
    shortNote: spanDays < RANGE_DAYS[range] - 10 ? `From ${dateLabel(first.date)}, the first day stored` : null,
  };
}

/** "2026-11-09" → "9 Nov 2026". */
export function dateLabel(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? "?"} ${year}`;
}

/** Axis ticks: "9 Nov" inside three months, "Nov 26" beyond. */
export function tickLabel(iso: string, range: PriceRange): string {
  const [year, month, day] = iso.split("-");
  const name = MONTHS[Number(month) - 1] ?? "?";
  return range === "1M" || range === "3M" ? `${Number(day)} ${name}` : `${name} ${year.slice(2)}`;
}

/**
 * Where the date axis puts its labels: the first trading day of each month for six months and a
 * year (one label per month, never two "Dec 25"s), and about six evenly spaced days below that.
 */
export function axisTicks(points: Pick<PricePoint, "date">[], range: PriceRange): string[] {
  if (range === "6M" || range === "1Y") {
    // Skip the first day: a partial month's label would sit hard against the next one.
    return points.filter((p, i) => i > 0 && p.date.slice(0, 7) !== points[i - 1].date.slice(0, 7)).map((p) => p.date);
  }
  const step = Math.max(1, Math.ceil(points.length / 6));
  return points.filter((_, i) => i % step === 0).map((p) => p.date);
}

/** The volume axis: whole crores or lakhs, as short as it can be. */
export function sharesAxisLabel(shares: number): string {
  if (shares >= 1e7) return `${whole.format(Math.round(shares / 1e7))} cr`;
  if (shares >= 1e5) return `${whole.format(Math.round(shares / 1e5))} L`;
  return whole.format(shares);
}

/** Shares in Indian units: 1,86,77,205 → "1.87 cr", 45,21,000 → "45.2 L", 9,876 → "9,876". */
export function sharesLabel(shares: number | null): string {
  if (shares === null || !Number.isFinite(shares)) return DASH;
  if (shares >= 1e7) return `${twoDp.format(shares / 1e7)} cr`;
  if (shares >= 1e5) return `${oneDp.format(shares / 1e5)} L`;
  return whole.format(shares);
}

/** The day's move against the close before it, signed; a dash without one. */
export function dayMove(point: Pick<PricePoint, "close" | "prevClose">): string {
  const { close, prevClose } = point;
  if (prevClose === null || prevClose <= 0) return DASH;
  return signed(((close - prevClose) / prevClose) * 100);
}

export function rupees(value: number): string {
  return `₹${twoDp.format(value)}`;
}
