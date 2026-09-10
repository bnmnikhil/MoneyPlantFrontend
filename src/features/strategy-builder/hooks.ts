import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useUnderlyingSearch(query: string) {
  const debounced = useDebouncedValue(query.trim());
  return useQuery({
    queryKey: ["instrument-catalogue", debounced],
    queryFn: ({ signal }) => api.searchUnderlyings(debounced, signal),
    enabled: debounced.length > 0,
    staleTime: 5 * 60_000,
  });
}

export function useOptionSources(underlying?: string, exchange = "NSE", positionConnectionId?: string | null) {
  return useQuery({
    queryKey: ["option-sources", underlying, exchange, positionConnectionId],
    queryFn: ({ signal }) => api.optionSources(underlying!, exchange, positionConnectionId, signal),
    enabled: !!underlying,
    staleTime: 30_000,
  });
}

export function useOptionExpiries(underlying?: string, exchange = "NSE", sourceConnectionId?: string) {
  return useQuery({
    queryKey: ["option-expiries", underlying, exchange, sourceConnectionId],
    queryFn: ({ signal }) => api.optionExpiries(underlying!, exchange, sourceConnectionId!, signal),
    enabled: !!underlying && !!sourceConnectionId,
    staleTime: 5 * 60_000,
  });
}

export function useOptionChain(
  underlying?: string,
  expiry?: string,
  exchange = "NSE",
  sourceConnectionId?: string,
  positionConnectionId?: string | null,
  active = true,
  strikeCount = 10
) {
  return useQuery({
    queryKey: ["option-chain", underlying, expiry, exchange, sourceConnectionId, positionConnectionId, strikeCount],
    queryFn: ({ signal }) => api.optionChain(
      underlying!, expiry!, exchange, sourceConnectionId!, positionConnectionId, strikeCount, signal
    ),
    enabled: active && !!underlying && !!expiry && !!sourceConnectionId,
    staleTime: 5_000,
    refetchInterval: active ? 15_000 : false,
    refetchIntervalInBackground: false,
  });
}
