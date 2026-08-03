import type { Position } from "@/types/api";

/**
 * Positions grouped broker → underlying.
 *
 * Broker is the outer level because that is the level you act at: margin is
 * calculated per account, and exiting a spread means exiting it at the broker
 * that holds it. Seeing net BANKNIFTY exposure across accounts is interesting,
 * but it is not something you can trade on.
 *
 * Identical instruments held at two brokers are never combined into one row,
 * matching the payoff decision — a merged row would hide which account carries
 * the risk.
 */

export interface UnderlyingGroup {
  key: string;
  /** Underlying if the contract master resolved one, else the raw symbol. */
  label: string;
  positions: Position[];
  pnl: number;
  dayChange: number;
}

export interface BrokerGroup {
  key: string;
  brokerId: string;
  connectionId: string;
  groups: UnderlyingGroup[];
  pnl: number;
  dayChange: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function groupPositions(positions: Position[]): BrokerGroup[] {
  const byConnection = new Map<string, Position[]>();

  for (const p of positions) {
    const list = byConnection.get(p.connectionId);
    if (list) list.push(p);
    else byConnection.set(p.connectionId, [p]);
  }

  const brokers: BrokerGroup[] = [];

  for (const [connectionId, rows] of byConnection) {
    const byUnderlying = new Map<string, Position[]>();

    for (const p of rows) {
      // An equity position has no underlying, and neither does a symbol the
      // contract master doesn't know. Falling back to the symbol gives it an
      // honest group of its own rather than dumping it in a vague "Other".
      const label = p.underlying ?? p.symbol;
      const list = byUnderlying.get(label);
      if (list) list.push(p);
      else byUnderlying.set(label, [p]);
    }

    const groups: UnderlyingGroup[] = [...byUnderlying.entries()]
      .map(([label, ps]) => ({
        key: `${connectionId}:${label}`,
        label,
        positions: ps,
        pnl: sum(ps.map((p) => p.pnl)),
        dayChange: sum(ps.map((p) => p.dayChange)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    brokers.push({
      key: connectionId,
      connectionId,
      brokerId: rows[0].broker,
      groups,
      pnl: sum(groups.map((g) => g.pnl)),
      dayChange: sum(groups.map((g) => g.dayChange)),
    });
  }

  // Stable order so the table does not reshuffle on the 30s refetch.
  return brokers.sort((a, b) => a.connectionId.localeCompare(b.connectionId));
}
