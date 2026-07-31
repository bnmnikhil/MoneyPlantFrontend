import type { Holding } from "@/types/api";

/**
 * Holdings grouped by broker.
 *
 * One level only, unlike positions. Holdings are delivered equity — there is no
 * underlying to group by, and grouping by sector or ISIN would need data the
 * API does not return.
 *
 * Identical stock held at two brokers stays two rows, consistent with positions
 * and the payoff: it sits in two different demat accounts and is sold from
 * whichever one holds it.
 */

export interface HoldingGroup {
  key: string;
  brokerId: string;
  connectionId: string;
  holdings: Holding[];
  currentValue: number;
  pnl: number;
  /** Weighted by invested amount, not an average of the per-row percentages. */
  pnlPct: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function groupHoldings(holdings: Holding[]): HoldingGroup[] {
  const byConnection = new Map<string, Holding[]>();

  for (const h of holdings) {
    const list = byConnection.get(h.connectionId);
    if (list) list.push(h);
    else byConnection.set(h.connectionId, [h]);
  }

  return [...byConnection.entries()]
    .map(([connectionId, rows]) => {
      const currentValue = sum(rows.map((h) => h.currentValue));
      const pnl = sum(rows.map((h) => h.pnl));

      // Invested is derived rather than summed: the API gives currentValue and
      // pnl, and invested is exactly their difference. Averaging the per-row
      // pnlPct would weight a ₹500 holding the same as a ₹5,00,000 one.
      const invested = currentValue - pnl;

      return {
        key: connectionId,
        connectionId,
        brokerId: rows[0].broker,
        holdings: [...rows].sort((a, b) => b.currentValue - a.currentValue),
        currentValue,
        pnl,
        pnlPct: invested === 0 ? 0 : (pnl / invested) * 100,
      };
    })
    .sort((a, b) => a.connectionId.localeCompare(b.connectionId));
}
