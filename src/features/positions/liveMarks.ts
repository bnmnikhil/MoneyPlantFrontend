/**
 * Streamed prices applied to polled positions, so the table, its group and broker
 * totals, premium left and the Overview all move together, once a second.
 *
 * A live price shifts the broker's own figures by the move since the poll:
 * `pnl += qty × (live − polled ltp)`, and the same for day P&L. It does not
 * recompute them from scratch, because brokers disagree on what they mean (Kite's
 * pnl is lifetime as Kite computes it; Alice Blue's rests on an entry basis the
 * mapper reconstructs), and a shift keeps each exactly as its mapper defined it.
 *
 * A row the poll could not price (`priceKnown` false, Paytm only) has no mark to
 * shift from. Its P&L was realised-only, so it becomes realised plus the open
 * quantity at the live price; its day P&L is left alone, because without the
 * previous close it cannot be told apart from entry-day movement.
 *
 * Rows with no quote key, or no live price for it, keep their polled figures.
 */
import type { LiveQuote } from "@/features/market/tickerItems";
import type { BrokerAggregate, Position } from "@/types/api";

export function applyLiveMarks(
  positions: BrokerAggregate<Position>,
  quotes: ReadonlyMap<string, LiveQuote>,
): BrokerAggregate<Position> {
  if (quotes.size === 0) return positions;
  let changed = false;
  const items = positions.items.map((p) => {
    const q = p.quoteKey ? quotes.get(p.quoteKey) : undefined;
    if (!q || !Number.isFinite(q.price) || q.price <= 0 || p.qty === 0) return p;
    if (p.priceKnown && q.price === p.ltp) return p;
    changed = true;
    if (!p.priceKnown) {
      return { ...p, ltp: q.price, priceKnown: true, pnl: p.realisedPnl + p.qty * (q.price - p.avgPrice) };
    }
    const move = p.qty * (q.price - p.ltp);
    return { ...p, ltp: q.price, pnl: p.pnl + move, dayChange: p.dayChange + move };
  });
  return changed ? { ...positions, items } : positions;
}

/** Hover text for a row's live mark: where its price is streaming from. */
export function liveTitle(q: LiveQuote, nameOf: (brokerId: string) => string): string {
  return q.source === "shared"
    ? "Live price from the shared market feed"
    : `Live price from your ${nameOf(q.source)} connection`;
}
