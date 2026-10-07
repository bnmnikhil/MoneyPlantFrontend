import type { PayoffComparisonRequest, PayoffLeg, PayoffResponse } from "@/types/api";
import { baselineFromPayoff } from "../strategy-builder/scenarioState.ts";

/**
 * Which legs of a live payoff are on the graph, and the figures that follow from that choice.
 *
 * Unticking a leg is a what-if: it never touches the broker, and the page always opens with every
 * leg on. A leg is identified by its legId, or by its position in the list when the backend sent
 * none, so the choice survives the 30-second refetch as long as the same legs come back.
 */

export function legKey(leg: PayoffLeg, index: number): string {
  return leg.legId || `${leg.symbol}:${leg.type}:${leg.strike}:${index}`;
}

/** Open (unrealised) P/L of one leg: (current price - average price) x quantity. Null when unpriced. */
export function legOpenPnl(leg: PayoffLeg): number | null {
  if (!leg.currentMarkKnown || leg.currentMark === null) return null;
  return (leg.currentMark - leg.avgPrice) * leg.qty;
}

/**
 * Sum of the legs' open P/L. A leg with no price is left out, and `partial` says so, so a total
 * that is missing a leg is never shown as if it were complete. Null only when no leg is priced.
 */
export function openPnl(legs: PayoffLeg[]): { value: number | null; partial: boolean } {
  let total = 0, priced = 0;
  for (const leg of legs) {
    const pnl = legOpenPnl(leg);
    if (pnl === null) continue;
    total += pnl;
    priced++;
  }
  return { value: priced ? total : null, partial: priced > 0 && priced < legs.length };
}

/** The legs still ticked, in their original order. */
export function selectedLegs(legs: PayoffLeg[], excluded: ReadonlySet<string>): PayoffLeg[] {
  return legs.filter((leg, index) => !excluded.has(legKey(leg, index)));
}

/**
 * Flip one leg. Unticking the last ticked leg is refused (returns the set unchanged): a graph of
 * nothing has no meaning.
 */
export function toggleLeg(excluded: ReadonlySet<string>, key: string, legs: PayoffLeg[]): Set<string> {
  const next = new Set(excluded);
  if (next.has(key)) {
    next.delete(key);
    return next;
  }
  const ticked = legs.filter((leg, index) => !next.has(legKey(leg, index))).length;
  if (ticked <= 1) return new Set(excluded);
  next.add(key);
  return next;
}

/** Drop exclusions for legs that are no longer in the response. */
export function pruneExcluded(excluded: ReadonlySet<string>, legs: PayoffLeg[]): Set<string> {
  const keys = new Set(legs.map(legKey));
  const next = new Set([...excluded].filter((key) => keys.has(key)));
  return next.size === excluded.size ? (excluded as Set<string>) : next;
}

/**
 * The compare request for a set of live legs: they are the baseline and nothing is drafted, so the
 * answer is that subset's payoff and its margin estimate.
 */
export function comparisonRequest(data: PayoffResponse, legs: PayoffLeg[]): PayoffComparisonRequest {
  const baseline = baselineFromPayoff({ ...data, legs }).map((leg, index) => ({
    ...leg,
    id: legKey(legs[index], data.legs.indexOf(legs[index])),
  }));
  return {
    revision: 0,
    context: {
      underlying: data.underlying,
      exchange: legs[0]?.exchange ?? "NSE",
      positionConnectionId: data.connectionId,
      baselineImportedAt: data.retrievedAt,
      baselineComplete: data.complete,
    },
    spot: data.spot > 0 ? data.spot : null,
    baselineLegs: baseline,
    draftTradeLegs: [],
  };
}
