import { useQuery } from "@tanstack/react-query";
import type { StockFundamentals } from "@/features/research/fundamentals";

/**
 * A stock's results file. A static file shipped with the app, not an API call, so it is
 * fetched directly: `lib/api.ts` would treat a miss as a broker or sign-in problem.
 * Resolves to null when no file exists for the symbol (the dev server and Caddy both answer
 * a missing path with the app's HTML, so "not JSON" also means "not there").
 */
async function fetchFundamentals(symbol: string): Promise<StockFundamentals | null> {
  const response = await fetch(`/fundamentals/${encodeURIComponent(symbol)}.json`, { headers: { Accept: "application/json" } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Results file answered ${response.status}`);
  if (!(response.headers.get("content-type") ?? "").includes("json")) return null;
  return (await response.json()) as StockFundamentals;
}

export function useStockFundamentals(symbol: string) {
  return useQuery({
    queryKey: ["fundamentals", symbol],
    queryFn: () => fetchFundamentals(symbol),
    staleTime: 60 * 60_000,
    retry: false,
  });
}
