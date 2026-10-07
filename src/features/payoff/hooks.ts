import { useQuery } from "@tanstack/react-query";
import { comparisonRequest, legKey } from "./legSelection";
import { api } from "@/lib/api";
import type { CurveRef, PayoffLeg, PayoffResponse } from "@/types/api";

export const payoffKeys = {
  curves: ["payoff", "curves"] as const,
  // Keyed by connection AND underlying: the same underlying held at two brokers
  // is two distinct curves and must not share a cache entry.
  detail: (connectionId: string, underlying: string, includeHoldings = false, holdingQty?: number) =>
    ["payoff", connectionId, underlying, includeHoldings, holdingQty] as const,
  metadata: ["payoff", "metadata"] as const,
};

/** Every (broker, underlying) pair that currently has plottable positions. */
export function usePayoffCurves() {
  return useQuery({
    queryKey: payoffKeys.curves,
    queryFn: api.payoffCurves,
    staleTime: 30_000,
  });
}

/** Payoff curve for one reference. Disabled until one is selected. */
export function usePayoff(curve: CurveRef | undefined, includeHoldings = false, holdingQty?: number) {
  return useQuery({
    queryKey: payoffKeys.detail(curve?.connectionId ?? "", curve?.underlying ?? "", includeHoldings, holdingQty),
    queryFn: () => api.payoff(curve!.connectionId, curve!.underlying, includeHoldings, holdingQty),
    enabled: !!curve,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

/**
 * Payoff and margin estimate for a chosen set of a live curve's legs, from the compare endpoint
 * (those legs as the baseline, nothing drafted). Keyed by the legs and by the payoff's
 * retrievedAt, so it follows the 30-second refresh. The previous answer is kept during a refresh
 * of the same legs only: after a tick changes, the old figures are hidden until the new ones
 * arrive, so a figure never describes a different set of legs from the one on screen.
 */
export function useLegScenario(data: PayoffResponse | undefined, legs: PayoffLeg[], enabled = true) {
  const ids = data ? legs.map((leg) => legKey(leg, data.legs.indexOf(leg))).join("|") : "";
  return useQuery({
    queryKey: ["payoff", "scenario", data?.connectionId, data?.underlying, ids, data?.retrievedAt] as const,
    queryFn: ({ signal }) => api.comparePayoff(comparisonRequest(data!, legs), signal),
    enabled: enabled && !!data && legs.length > 0,
    retry: false,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[4] === ids ? previous : undefined,
  });
}

/** Strategy Builder metadata (underlyings, strike steps, lot sizes, templates, expiries). */
export function useStrategyMetadata() {
  return useQuery({
    queryKey: payoffKeys.metadata,
    queryFn: api.strategyMetadata,
    staleTime: 5 * 60 * 1000,
  });
}

