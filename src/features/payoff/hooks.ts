import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CurveRef } from "@/types/api";

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

/** Strategy Builder metadata (underlyings, strike steps, lot sizes, templates, expiries). */
export function useStrategyMetadata() {
  return useQuery({
    queryKey: payoffKeys.metadata,
    queryFn: api.strategyMetadata,
    staleTime: 5 * 60 * 1000,
  });
}

