import type { BrokerWarning, Freshness, Position, SessionStatus } from "@/types/api";
import type { BrokerRow } from "./aggregate.ts";
import { capitalUtilisation } from "./overview.ts";

/**
 * What on the Overview needs the user's attention (OVERVIEW-REDESIGN.md OV-1).
 *
 * Pure: everything is derived from data the page already loads, so the band adds no request. Four
 * kinds of finding, each of which the page hides when empty:
 *
 * - margin pressure: an account using at least MARGIN_PRESSURE_PCT of its capital. Per account,
 *   because capital is held per account: a comfortable combined figure can hide one that is close
 *   to a margin call.
 * - expiring soon: open legs whose expiry falls in the next EXPIRY_WINDOW_DAYS IST calendar days.
 * - biggest moves: the legs with the largest Day P&L today.
 * - to fix: things the user can act on that make the numbers incomplete.
 */

export const MARGIN_PRESSURE_PCT = 75;
/** Today plus the next six days. */
export const EXPIRY_WINDOW_DAYS = 7;
export const MOVES_SHOWN = 3;
/** A move smaller than this is not worth a line on the Overview. */
export const MOVE_MIN_ABS = 100;

const DAY_MS = 86_400_000;
/** IST is a fixed UTC+5:30 with no DST; adding the offset avoids depending on tzdata. */
const IST_OFFSET_MS = 19_800_000;

export interface AccountMargin {
  connectionId: string;
  brokerId: string;
  pct: number;
  used: number;
  free: number;
}

/** Every account with a known margin, as utilisation. A null margin is skipped, never read as 0%. */
function accountMargins(rows: BrokerRow[]): AccountMargin[] {
  const out: AccountMargin[] = [];
  for (const row of rows) {
    if (!row.margin) continue;
    const pct = capitalUtilisation(row.margin.available, row.margin.used);
    if (pct === null) continue;
    out.push({ connectionId: row.connectionId, brokerId: row.brokerId, pct, used: row.margin.used, free: row.margin.available });
  }
  return out.sort((a, b) => b.pct - a.pct || a.connectionId.localeCompare(b.connectionId));
}

/** Accounts at or over the threshold, most used first. */
export function marginPressure(rows: BrokerRow[], threshold = MARGIN_PRESSURE_PCT): AccountMargin[] {
  return accountMargins(rows).filter((account) => account.pct >= threshold);
}

/**
 * The account using the largest share of its capital, for the strip's "Tightest" line (OV-2).
 * Null with fewer than two accounts: with one, it would only repeat the combined figure.
 */
export function tightestAccount(rows: BrokerRow[]): AccountMargin | null {
  const accounts = accountMargins(rows);
  return accounts.length >= 2 ? accounts[0] : null;
}

/** The IST calendar date of an instant, as YYYY-MM-DD. */
export function istDate(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whole IST calendar days from today to `expiry` (YYYY-MM-DD): 0 on expiry day, negative after it. */
export function daysUntil(expiry: string, now: Date): number {
  return Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${istDate(now)}T00:00:00Z`)) / DAY_MS);
}

export interface ExpiryGroup {
  connectionId: string;
  brokerId: string;
  expiry: string;
  daysLeft: number;
  legs: Position[];
  /** Summed P&L of the priced legs. */
  pnl: number;
  /** True when a leg in the group has no current price, so `pnl` is incomplete. */
  partial: boolean;
}

export interface NextExpiry {
  expiry: string;
  daysLeft: number;
  legCount: number;
}

function openWithExpiry(positions: Position[]): (Position & { contract: { expiry: string } })[] {
  return positions.filter((p): p is Position & { contract: { expiry: string } } =>
    p.qty !== 0 && !!p.contract?.expiry);
}

/**
 * Open legs expiring inside the window, grouped by account and expiry, soonest first; and the
 * nearest expiry after the window, so a quiet week can still say when the next one is. Legs past
 * their expiry and legs the contract master could not resolve (no `contract`) are left out.
 */
export function expiringSoon(positions: Position[], now: Date, days = EXPIRY_WINDOW_DAYS): { soon: ExpiryGroup[]; next: NextExpiry | null } {
  const groups = new Map<string, ExpiryGroup>();
  const later = new Map<string, NextExpiry>();
  for (const leg of openWithExpiry(positions)) {
    const daysLeft = daysUntil(leg.contract.expiry, now);
    if (daysLeft < 0) continue;
    if (daysLeft >= days) {
      const entry = later.get(leg.contract.expiry) ?? { expiry: leg.contract.expiry, daysLeft, legCount: 0 };
      entry.legCount++;
      later.set(leg.contract.expiry, entry);
      continue;
    }
    const key = `${leg.connectionId}|${leg.contract.expiry}`;
    let group = groups.get(key);
    if (!group) {
      group = { connectionId: leg.connectionId, brokerId: leg.broker, expiry: leg.contract.expiry, daysLeft, legs: [], pnl: 0, partial: false };
      groups.set(key, group);
    }
    group.legs.push(leg);
    if (leg.priceKnown) group.pnl += leg.pnl;
    else group.partial = true;
  }
  const soon = [...groups.values()].sort((a, b) => a.daysLeft - b.daysLeft || a.connectionId.localeCompare(b.connectionId));
  const next = [...later.values()].sort((a, b) => a.daysLeft - b.daysLeft)[0] ?? null;
  return { soon, next };
}

/**
 * The open legs with the largest Day P&L, either way. An unpriced leg is excluded: its day change
 * is a missing price, not a move.
 */
export function biggestMoves(positions: Position[], n = MOVES_SHOWN, minAbs = MOVE_MIN_ABS): Position[] {
  return positions
    .filter((p) => p.qty !== 0 && p.priceKnown && Math.abs(p.dayChange) >= minAbs)
    .sort((a, b) => Math.abs(b.dayChange) - Math.abs(a.dayChange))
    .slice(0, n);
}

export type FixItem =
  /** Credentials saved, no live account: everything from this broker is missing. */
  | { kind: "not-connected"; brokerId: string }
  /** The broker refused the token: reconnecting fixes it. */
  | { kind: "session-expired"; brokerId: string; connectionId: string }
  /** The broker call failed: transient. Never offer reconnect for this. */
  | { kind: "load-failed"; brokerId: string; connectionId: string }
  /** Open legs with no current price: P&L and premium totals leave them out. */
  | { kind: "unpriced"; count: number }
  /** Margin estimates come from a snapshot, not the live positions. */
  | { kind: "stale-estimates"; asOf: string | null; freshness: Freshness };

export interface FixInput {
  status: SessionStatus | undefined;
  warnings: BrokerWarning[];
  positions: Position[];
  /** The risk report's freshness; undefined while it has not loaded. */
  risk?: { freshness: Freshness; asOf: string | null };
}

export function toFix({ status, warnings, positions, risk }: FixInput): FixItem[] {
  const items: FixItem[] = [];
  if (status) {
    const live = new Set(status.connections.filter((c) => c.connected).map((c) => c.brokerId));
    for (const brokerId of status.brokers) if (!live.has(brokerId)) items.push({ kind: "not-connected", brokerId });
  }
  const seen = new Set<string>();
  for (const warning of warnings) {
    const key = `${warning.connectionId}|${warning.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // UNSUPPORTED_CAPABILITY (a broker with no margins call, say) is a fact about the broker, not
    // something the user can fix.
    if (warning.code === "SESSION_EXPIRED") items.push({ kind: "session-expired", brokerId: warning.brokerId, connectionId: warning.connectionId });
    else if (warning.code === "CALL_FAILED") items.push({ kind: "load-failed", brokerId: warning.brokerId, connectionId: warning.connectionId });
  }
  const unpriced = positions.filter((p) => p.qty !== 0 && !p.priceKnown).length;
  if (unpriced > 0) items.push({ kind: "unpriced", count: unpriced });
  // NONE means there was nothing to estimate, which is not a problem.
  if (risk && risk.freshness !== "LIVE" && risk.freshness !== "NONE") {
    items.push({ kind: "stale-estimates", asOf: risk.asOf, freshness: risk.freshness });
  }
  return items;
}

export interface Attention {
  margin: AccountMargin[];
  expiring: { soon: ExpiryGroup[]; next: NextExpiry | null };
  moves: Position[];
  fixes: FixItem[];
  /** True when nothing needs attention; `checks` then says what was checked. */
  allClear: boolean;
  checks: string[];
}

export function attention(input: FixInput & { rows: BrokerRow[]; now: Date }): Attention {
  const margin = marginPressure(input.rows);
  const expiring = expiringSoon(input.positions, input.now);
  const moves = biggestMoves(input.positions);
  const fixes = toFix(input);
  const checks = [
    `All accounts under ${MARGIN_PRESSURE_PCT}% margin`,
    `No expiry in the next ${EXPIRY_WINDOW_DAYS} days`,
    "Every broker connected",
    "Every leg priced",
  ];
  // Biggest moves are information, not a problem: they do not stop the day being all clear.
  const allClear = margin.length === 0 && expiring.soon.length === 0 && fixes.length === 0;
  return { margin, expiring, moves, fixes, allClear, checks };
}
