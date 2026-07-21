import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const payoffKeys = {
  underlyings: ["payoff", "underlyings"] as const,
  detail: (underlying: string) => ["payoff", underlying] as const,
};

/** Underlyings that currently have open F&O positions worth plotting. */
export function usePayoffUnderlyings() {
  return useQuery({
    queryKey: payoffKeys.underlyings,
    queryFn: api.payoffUnderlyings,
    staleTime: 30_000,
  });
}

/** Payoff curve for one underlying. Disabled until an underlying is selected. */
export function usePayoff(underlying: string | undefined) {
  return useQuery({
    queryKey: payoffKeys.detail(underlying ?? ""),
    queryFn: () => api.payoff(underlying as string),
    enabled: !!underlying,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
