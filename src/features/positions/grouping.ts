import type { InstrumentType, Position } from "@/types/api";

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

/**
 * Premium still on the table, in rupees. Positive is a net credit.
 *
 * `qty` is signed and already includes the lot — a two-lot short of a 75-lot
 * contract arrives as -150, so multiplying by a lot size again would overstate
 * every figure by that lot size. A short leg (`qty < 0`) therefore yields a
 * positive credit: what you keep if it expires worthless. A long leg yields a
 * negative debit: what you would recover by closing, and what you lose if it
 * expires worthless.
 *
 * **Unlike margin, this is additive at every level.** Margin is allocated from a
 * bill and only its shares may be summed; premium is plain arithmetic on the
 * rows themselves, which is why it appears on the leg rows where margin is
 * deliberately blank.
 */
export const premiumLeft = (p: Position) => -(p.qty * p.ltp);

/**
 * The same figure at entry: what was originally collected (positive) or paid
 * (negative). The gap between this and {@link premiumLeft} is exactly the
 * position's lifetime P&L, so the two are shown as a pair and never summed
 * together.
 */
export const premiumAtEntry = (p: Position) => -(p.qty * p.avgPrice);

/** The option right, with a bucket for rows the contract master could not resolve. */
export type OptionRight = InstrumentType | "OTHER";

/** Calls before puts, then the non-option tails. Fixed, so the order never depends on the data. */
const RIGHT_ORDER: OptionRight[] = ["CE", "PE", "FUT", "EQ", "OTHER"];

/**
 * One right within one underlying, within one account — the CE and PE halves of
 * a spread.
 *
 * A tier rather than a flag on each leg because the whole point is the subtotal:
 * "how much of this group's credit is on the call side" is the question a
 * strangle raises, and it cannot be answered by reading legs one at a time.
 */
export interface RightGroup {
  key: string;
  right: OptionRight;
  positions: Position[];
  premiumLeft: number;
  premiumAtEntry: number;
  pnl: number;
  dayChange: number;
}

export interface UnderlyingGroup {
  key: string;
  /** Underlying if the contract master resolved one, else the raw symbol. */
  label: string;
  positions: Position[];
  /**
   * The same positions, split by right, in `RIGHT_ORDER`.
   *
   * Length 1 whenever the group is all one right, which is the signal for the
   * table to skip the tier entirely — a sub-header separating nothing is a row
   * that costs scrolling and says nothing.
   */
  rights: RightGroup[];
  premiumLeft: number;
  premiumAtEntry: number;
  pnl: number;
  dayChange: number;
}

export interface BrokerGroup {
  key: string;
  brokerId: string;
  connectionId: string;
  groups: UnderlyingGroup[];
  premiumLeft: number;
  premiumAtEntry: number;
  pnl: number;
  dayChange: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function byRight(positions: Position[], groupKey: string): RightGroup[] {
  const buckets = new Map<OptionRight, Position[]>();

  for (const p of positions) {
    // Null is its own bucket, never folded into CE. An unresolved row is a gap
    // in what we know, and putting it under a right we guessed would make a
    // subtotal quietly wrong rather than visibly incomplete.
    const right: OptionRight = p.instrumentType ?? "OTHER";
    const list = buckets.get(right);
    if (list) list.push(p);
    else buckets.set(right, [p]);
  }

  return RIGHT_ORDER.filter((r) => buckets.has(r)).map((right) => {
    const ps = buckets.get(right)!;
    return {
      key: `${groupKey}:${right}`,
      right,
      positions: ps,
      premiumLeft: sum(ps.map(premiumLeft)),
      premiumAtEntry: sum(ps.map(premiumAtEntry)),
      pnl: sum(ps.map((p) => p.pnl)),
      dayChange: sum(ps.map((p) => p.dayChange)),
    };
  });
}

/**
 * The key identifying one underlying group inside one account.
 *
 * Exported because a second dataset has to line up with these groups: the
 * per-contract margin from `/api/risk/summary` is joined onto them by key. Both
 * sides must derive the key the same way or the join silently misses, so the
 * expression lives here once rather than being spelled twice.
 *
 * `underlying` is the canonical code and falls back to the symbol for equity and
 * for anything the contract master doesn't know — see `groupPositions`.
 */
export function groupKey(
  connectionId: string,
  underlying: string | null,
  symbol: string
): string {
  return `${connectionId}:${underlying ?? symbol}`;
}

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
      // Group on the CANONICAL code, never the label. Three brokers spell the
      // same underlying three ways; the code is what collapses them onto one
      // group, and the label is only ever rendered.
      //
      // An equity position has no underlying, and neither does a symbol the
      // contract master doesn't know. Falling back to the symbol gives it an
      // honest group of its own rather than dumping it in a vague "Other".
      const code = p.underlying ?? p.symbol;
      const list = byUnderlying.get(code);
      if (list) list.push(p);
      else byUnderlying.set(code, [p]);
    }

    const groups: UnderlyingGroup[] = [...byUnderlying.entries()]
      .map(([code, ps]) => {
        const key = groupKey(connectionId, ps[0].underlying, ps[0].symbol);
        return {
          key,
          // Every position in this group shares an underlying, so any row's
          // label is the group's label. Falls back through the code to the
          // symbol so a group always has something printable.
          label: ps[0].underlyingLabel ?? code,
          positions: ps,
          rights: byRight(ps, key),
          premiumLeft: sum(ps.map(premiumLeft)),
          premiumAtEntry: sum(ps.map(premiumAtEntry)),
          pnl: sum(ps.map((p) => p.pnl)),
          dayChange: sum(ps.map((p) => p.dayChange)),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    brokers.push({
      key: connectionId,
      connectionId,
      brokerId: rows[0].broker,
      groups,
      premiumLeft: sum(groups.map((g) => g.premiumLeft)),
      premiumAtEntry: sum(groups.map((g) => g.premiumAtEntry)),
      pnl: sum(groups.map((g) => g.pnl)),
      dayChange: sum(groups.map((g) => g.dayChange)),
    });
  }

  // Stable order so the table does not reshuffle on the 30s refetch.
  return brokers.sort((a, b) => a.connectionId.localeCompare(b.connectionId));
}
