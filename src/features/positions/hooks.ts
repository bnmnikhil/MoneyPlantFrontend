import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Margins } from "@/types/api";

export const positionsKeys = {
  all: ["positions"] as const,
  margins: ["margins"] as const,
};

/** Live positions across every connected broker. Auto-refreshes every 30s. */
export function usePositions() {
  return useQuery({
    queryKey: positionsKeys.all,
    queryFn: api.positions,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

/** Zero-value totals, so callers never have to null-check before formatting. */
const EMPTY_TOTALS = {
  available: 0,
  used: 0,
  total: 0,
  cash: 0,
  collateral: 0,
};

export type MarginTotals = typeof EMPTY_TOTALS;

function sumMargins(rows: Margins[]): MarginTotals {
  return rows.reduce<MarginTotals>(
    (acc, m) => ({
      available: acc.available + m.available,
      used: acc.used + m.used,
      total: acc.total + m.total,
      cash: acc.cash + m.cash,
      collateral: acc.collateral + m.collateral,
    }),
    { ...EMPTY_TOTALS }
  );
}

/**
 * Margins, one row per connected broker.
 *
 * The backend deliberately does not pre-sum, so the per-broker breakdown stays
 * available for debugging. `totals` is the summed view for headline cards.
 */
export function useMargins() {
  const query = useQuery({
    queryKey: positionsKeys.margins,
    queryFn: api.margins,
    refetchInterval: 30_000,
  });

  const totals = useMemo(
    () => sumMargins(query.data?.items ?? []),
    [query.data]
  );

  return { ...query, totals };
}
