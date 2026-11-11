import { useQuery } from "@tanstack/react-query";
import { missingKind, type StockFundamentals } from "@/features/research/fundamentals";
import { api, ApiError } from "@/lib/api";

/**
 * A stock's results, or why there are none. Not loaded and hidden are answers, not errors, so
 * they resolve rather than throw: the page shows each as its own state, and nothing retries.
 */
export type StockResultsState =
  | { status: "loaded"; data: StockFundamentals }
  | { status: "not-loaded" }
  | { status: "hidden" };

async function fetchStockResults(symbol: string): Promise<StockResultsState> {
  try {
    return { status: "loaded", data: await api.stockFundamentals(symbol) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { status: missingKind(error.body) };
    throw error;
  }
}

export function useStockFundamentals(symbol: string) {
  return useQuery({
    queryKey: ["research", "stock", symbol],
    queryFn: () => fetchStockResults(symbol),
    enabled: symbol.length > 0,
    staleTime: 60_000,
    retry: false,
  });
}
