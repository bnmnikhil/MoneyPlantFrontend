import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const holdingsKeys = {
  all: ["holdings"] as const,
};

/** Long-term holdings. */
export function useHoldings() {
  return useQuery({
    queryKey: holdingsKeys.all,
    queryFn: api.holdings,
    refetchInterval: 60_000,
  });
}
