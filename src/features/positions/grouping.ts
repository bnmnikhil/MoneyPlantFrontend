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

const isOption = (p: Position) => p.instrumentType === "CE" || p.instrumentType === "PE";

/**
 * Current net option premium, in rupees. Positive is a net credit.
 *
 * `qty` is signed and already includes the lot — a two-lot short of a 75-lot
 * contract arrives as -150, so multiplying by a lot size again would overstate
 * every figure by that lot size. A short leg (`qty < 0`) therefore yields a
 * positive credit: what you keep if it expires worthless. A long leg yields a
 * negative debit: what you would recover by closing, and what you lose if it
 * expires worthless.
 *
 * **Unlike margin, this is additive at every level.** Margin is modelled per
 * expiry group and only within-group figures may be summed; premium is plain
 * arithmetic on the rows themselves, which is why it appears on the leg rows
 * where margin is deliberately blank. Futures and equity have no option
 * premium. An unknown instrument type or missing quote returns null.
 */
export function premiumLeft(p: Position): number | null {
  if (!isOption(p)) return null;
  if (p.qty === 0) return 0;
  if (!p.priceKnown || !Number.isFinite(p.ltp) || p.ltp < 0) return null;
  return -(p.qty * p.ltp);
}

const unpriced = (ps: Position[]) => ps.filter((p) =>
  p.qty !== 0 && (p.instrumentType == null || (isOption(p) && premiumLeft(p) === null))
).length;

/**
 * The same figure at entry: what was originally collected (positive) or paid
 * (negative) for the quantity still open. Entry minus {@link premiumLeft} is
 * unrealised P&L; realised P&L from closed quantity is separate.
 */
export function premiumAtEntry(p: Position): number | null {
  if (!isOption(p)) return null;
  return p.qty === 0 ? 0 : -(p.qty * p.avgPrice);
}

interface PremiumTotals {
  /** Sum of known option values; null when none can be valued. */
  premiumLeft: number | null;
  premiumAtEntry: number | null;
  /** Open legs with an unknown type or option price. The subtotal can move either way. */
  unpricedLegs: number;
}

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
export interface RightGroup extends PremiumTotals {
  key: string;
  right: OptionRight;
  positions: Position[];
  pnl: number;
  dayChange: number;
}

export interface UnderlyingGroup extends PremiumTotals {
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
  pnl: number;
  dayChange: number;
}

export interface BrokerGroup extends PremiumTotals {
  key: string;
  brokerId: string;
  connectionId: string;
  groups: UnderlyingGroup[];
  pnl: number;
  dayChange: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function sumKnown(xs: (number | null)[]): number | null {
  const known = xs.filter((value): value is number => value !== null);
  return known.length > 0 ? sum(known) : null;
}

function premiumTotals(positions: Position[]): PremiumTotals {
  return {
    premiumLeft: sumKnown(positions.map(premiumLeft)),
    premiumAtEntry: sumKnown(positions.map(premiumAtEntry)),
    unpricedLegs: unpriced(positions),
  };
}

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
      ...premiumTotals(ps),
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
          ...premiumTotals(ps),
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
      ...premiumTotals(rows),
      pnl: sum(groups.map((g) => g.pnl)),
      dayChange: sum(groups.map((g) => g.dayChange)),
    });
  }

  // Stable order so the table does not reshuffle on the 30s refetch.
  return brokers.sort((a, b) => a.connectionId.localeCompare(b.connectionId));
}
