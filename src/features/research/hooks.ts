import { useQuery } from "@tanstack/react-query";
import { missingKind, type StockFundamentals } from "@/features/research/fundamentals";
import type { StockListing } from "@/features/research/search";
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

/** The loaded companies, or hidden (a bare 404) for an account outside the Research audience. */
export type StockListState = { status: "loaded"; stocks: StockListing[] } | { status: "hidden" };

async function fetchStockList(): Promise<StockListState> {
  try {
    return { status: "loaded", stocks: (await api.researchStocks()).stocks };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { status: "hidden" };
    throw error;
  }
}

/** One query for the search page and the nav tab, so the tab costs no request of its own. */
export function useStockList() {
  return useQuery({
    queryKey: ["research", "stocks"],
    queryFn: fetchStockList,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** True once the list has answered for this account; the Research tab shows only then. */
export function useResearchAvailable(): boolean {
  return useStockList().data?.status === "loaded";
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
