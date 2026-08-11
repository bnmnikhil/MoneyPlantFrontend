import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const riskKeys = {
  summary: ["risk", "summary"] as const,
};

export function useRiskSummary() {
  return useQuery({
    queryKey: riskKeys.summary,
    queryFn: api.riskSummary,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
