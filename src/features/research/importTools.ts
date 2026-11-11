/**
 * The owner import page's arithmetic (ANALYTICS-PLAN.md AN-25). Pure, so it is tested without
 * rendering.
 */

const ADDRESS = /https?:\/\/[^\s",]+/;
const FILE = /\.(xml|html?)$/i;

/** NSE symbols: letters, digits, "&" and "-" (M&M, BAJAJ-AUTO). The backend checks the same. */
export const SYMBOL = /^[A-Z0-9&-]{1,20}$/;

/** Files bigger than this are not NSE's results lists; refused before they are read. */
export const MAX_LIST_BYTES = 1024 * 1024;

/** Most filings one import accepts (the backend refuses more). */
export const MAX_FILINGS = 200;

/** Longest date range one price load accepts (the backend refuses more). */
export const MAX_PRICE_DAYS = 62;

export interface ListPreview {
  /** The filing addresses that will be imported: the first file address of each row, no repeats. */
  addresses: string[];
  /** Rows whose address names no file (NSE prints ".../xbrl/-" for quarters it has none for). */
  withoutFile: number;
}

/**
 * What an import will see in NSE's exported tables: the same rules as the backend's
 * FilingSources, so the preview matches the result.
 */
export function previewList(text: string): ListPreview {
  const addresses: string[] = [];
  let withoutFile = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = ADDRESS.exec(line);
    if (!match) continue;
    if (FILE.test(match[0])) {
      if (!addresses.includes(match[0])) addresses.push(match[0]);
    } else {
      withoutFile++;
    }
  }
  return { addresses, withoutFile };
}

/** "itc " → "ITC"; null when it is not an NSE symbol. */
export function normaliseSymbol(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  return SYMBOL.test(value) ? value : null;
}

const DAY_MS = 86_400_000;

function toDate(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Calendar days from `from` to `to`, both included; 0 when `to` is before `from`. */
export function daysBetween(from: string, to: string): number {
  const span = Math.round((toDate(to) - toDate(from)) / DAY_MS) + 1;
  return span > 0 ? span : 0;
}

/**
 * A date range cut into pieces of at most `maxDays`, in order, both ends included: one price
 * load request per piece, since one request may cover at most 62 days.
 */
export function splitRange(from: string, to: string, maxDays = MAX_PRICE_DAYS): Array<[string, string]> {
  const pieces: Array<[string, string]> = [];
  const end = toDate(to);
  for (let start = toDate(from); start <= end; start += maxDays * DAY_MS) {
    pieces.push([toIso(start), toIso(Math.min(start + (maxDays - 1) * DAY_MS, end))]);
  }
  return pieces;
}

/** The price form's default: the last seven days through `today` (already-loaded days are skipped cheaply). */
export function defaultPriceRange(today: string): { from: string; to: string } {
  return { from: toIso(toDate(today) - 6 * DAY_MS), to: today };
}

/** Today in India, as YYYY-MM-DD: the date NSE's files are named by. */
export function todayInIndia(now = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

/** Outcome counts for a report table's caption: { PARSED: 64, FAILED: 1 }. */
export function countOutcomes<T extends { outcome: string }>(items: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.outcome] = (counts[item.outcome] ?? 0) + 1;
  return counts;
}
