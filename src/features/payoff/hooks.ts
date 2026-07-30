import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CurveRef } from "@/types/api";

export const payoffKeys = {
  curves: ["payoff", "curves"] as const,
  // Keyed by connection AND underlying: the same underlying held at two brokers
  // is two distinct curves and must not share a cache entry.
  detail: (connectionId: string, underlying: string) =>
    ["payoff", connectionId, underlying] as const,
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
export function usePayoff(curve: CurveRef | undefined) {
  return useQuery({
    queryKey: payoffKeys.detail(curve?.connectionId ?? "", curve?.underlying ?? ""),
    queryFn: () => api.payoff(curve!.connectionId, curve!.underlying),
    enabled: !!curve,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
