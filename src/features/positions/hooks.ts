import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuotes } from "@/features/market/quoteStream";
import { applyLiveMarks } from "@/features/positions/liveMarks";
import { api } from "@/lib/api";
import type { Margins } from "@/types/api";

export const positionsKeys = {
  all: ["positions"] as const,
  margins: ["margins"] as const,
};

/**
 * Live positions across every connected broker. Polled every 30s, which is what
 * finds new and closed legs (and tells the server what to stream); between polls
 * each streamed price moves its row's mark and P&L (liveMarks.ts).
 */
export function usePositions() {
  const query = useQuery({
    queryKey: positionsKeys.all,
    queryFn: api.positions,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const { quotes } = useLiveQuotes();
  const data = useMemo(() => query.data && applyLiveMarks(query.data, quotes), [query.data, quotes]);
  return { ...query, data };
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
