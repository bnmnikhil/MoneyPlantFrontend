import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const positionsKeys = {
  all: ["positions"] as const,
  margins: ["margins"] as const,
};

/** Live positions. Auto-refreshes every 30s (contract-mandated). */
export function usePositions() {
  return useQuery({
    queryKey: positionsKeys.all,
    queryFn: api.positions,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

/** Account margins (available / used / total). */
export function useMargins() {
  return useQuery({
    queryKey: positionsKeys.margins,
    queryFn: api.margins,
    refetchInterval: 30_000,
  });
}
