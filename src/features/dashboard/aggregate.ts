import type { Holding, Margins, Position } from "@/types/api";

/**
 * The dashboard's per-connection view, joined from the three read endpoints.
 *
 * Keyed on `connectionId`, never on `brokerId`. `/api/margins` returns one row
 * per *connection* despite its javadoc saying per broker, so a user with two
 * Kite accounts gets two rows both labelled `kite`. Folding on the broker id
 * would sum two accounts into one and silently misreport both.
 */

export interface BrokerRow {
  /** connectionId — the only stable identity across the three endpoints. */
  key: string;
  brokerId: string;
  connectionId: string;
  /** Lifetime, since entry. */
  positionsPnl: number;
  /** Lifetime, since entry. */
  holdingsPnl: number;
  totalPnl: number;
  /**
   * Today's move, positions only — HoldingDto carries no dayChange field.
   *
   * Paytm contributes 0 for any leg it could not quote (PaytmMapper), so this
   * can under-report rather than being wrong in a visible way.
   */
  dayPnl: number;
  positionCount: number;
  holdingCount: number;
  /** Null when the margins call warned for this connection. Never coerce to 0. */
  margin: Margins | null;
}

export interface DashboardTotals {
  positionsPnl: number;
  holdingsPnl: number;
  totalPnl: number;
  dayPnl: number;
  positionCount: number;
  holdingCount: number;
  available: number;
  used: number;
  /** available + used. A MoneyPlant convention — no broker supplies it. */
  total: number;
  collateral: number;
  /** used / total, as a percentage. 0 when nothing is funded. */
  utilisationPct: number;
}

/**
 * The label segment of `{userId}:{brokerId}:{label}`.
 *
 * Same fallback the backend uses when a broker gives no account name, so the
 * two agree on what a connection is called.
 */
export function accountLabel(connectionId: string): string {
  const at = connectionId.lastIndexOf(":");
  return at === -1 ? connectionId : connectionId.slice(at + 1);
}

/** True when this broker holds more than one connection, so rows need an account label. */
export function needsAccountLabel(rows: BrokerRow[], brokerId: string): boolean {
  return rows.filter((r) => r.brokerId === brokerId).length > 1;
}

function blank(brokerId: string, connectionId: string): BrokerRow {
  return {
    key: connectionId,
    brokerId,
    connectionId,
    positionsPnl: 0,
    holdingsPnl: 0,
    totalPnl: 0,
    dayPnl: 0,
    positionCount: 0,
    holdingCount: 0,
    margin: null,
  };
}

/**
 * Outer join across positions, holdings and margins.
 *
 * A connection may appear in any one of the three and not the others — a dead
 * margin call leaves positions intact, and a cash-only account has margins but
 * no positions. Every connection seen anywhere gets a row.
 */
export function buildBrokerRows(
  positions: Position[],
  holdings: Holding[],
  margins: Margins[]
): { rows: BrokerRow[]; totals: DashboardTotals } {
  const byConnection = new Map<string, BrokerRow>();

  const rowFor = (brokerId: string, connectionId: string) => {
    let row = byConnection.get(connectionId);
    if (!row) {
      row = blank(brokerId, connectionId);
      byConnection.set(connectionId, row);
    }
    return row;
  };

  for (const p of positions) {
    const row = rowFor(p.broker, p.connectionId);
    row.positionsPnl += p.pnl;
    row.dayPnl += p.dayChange;
    row.positionCount += 1;
  }

  for (const h of holdings) {
    const row = rowFor(h.broker, h.connectionId);
    row.holdingsPnl += h.pnl;
    row.holdingCount += 1;
  }

  for (const m of margins) {
    rowFor(m.broker, m.connectionId).margin = m;
  }

  const rows = [...byConnection.values()]
    .map((r) => ({ ...r, totalPnl: r.positionsPnl + r.holdingsPnl }))
    .sort((a, b) => a.connectionId.localeCompare(b.connectionId));

  const sum = (pick: (r: BrokerRow) => number) =>
    rows.reduce((acc, r) => acc + pick(r), 0);

  const available = sum((r) => r.margin?.available ?? 0);
  const used = sum((r) => r.margin?.used ?? 0);
  const total = available + used;

  return {
    rows,
    totals: {
      positionsPnl: sum((r) => r.positionsPnl),
      holdingsPnl: sum((r) => r.holdingsPnl),
      totalPnl: sum((r) => r.totalPnl),
      dayPnl: sum((r) => r.dayPnl),
      positionCount: sum((r) => r.positionCount),
      holdingCount: sum((r) => r.holdingCount),
      available,
      used,
      total,
      collateral: sum((r) => r.margin?.collateral ?? 0),
      utilisationPct: total === 0 ? 0 : (used / total) * 100,
    },
  };
}
