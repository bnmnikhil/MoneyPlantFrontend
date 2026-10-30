import { useEffect, useSyncExternalStore } from "react";
import { queryClient } from "@/lib/queryClient";
import { applySpotQuotes, TICKER_INDICES, type LiveQuote } from "@/features/market/tickerItems";
import type { SpotQuote } from "@/types/api";

/**
 * Live prices pushed from the user's own streaming broker (Paytm today): the
 * ticker's spots, and every contract in the user's book, whichever broker holds
 * it. At most one batch a second, holding only what moved.
 *
 * Spots are written into the ticker's polled query, so it renders one source
 * either way. Contract prices land in a store keyed by `Position.quoteKey`.
 *
 * One EventSource for the whole page however many consumers are mounted. Live
 * only once a batch has arrived: a stream that opens and stays silent leaves
 * polling on. Closed while the tab is hidden, so a background tab holds no broker
 * socket. No streaming broker ("unavailable") or a feed that gave up ("ended"):
 * close and poll, and try again later, in case the user connects one meanwhile.
 */
export const SPOT_QUERY_KEY = ["market-data", "spot", ...TICKER_INDICES] as const;

const STREAM_URL = `/api/market-data/quotes/stream?spots=${TICKER_INDICES.join(",")}`;
const RETRY_AFTER_UNAVAILABLE_MS = 5 * 60_000;
const RETRY_AFTER_END_MS = 60_000;

let source: EventSource | null = null;
let users = 0;
let live = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
/** Latest price per quote key; replaced, never mutated, so a consumer can compare by reference. */
let quotes: ReadonlyMap<string, LiveQuote> = new Map();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setLive(next: boolean) {
  if (live === next) return;
  live = next;
  notify();
}

function close() {
  source?.close();
  source = null;
  setLive(false);
}

function retryLater(ms: number) {
  close();
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { retryTimer = undefined; sync(); }, ms);
}

function open() {
  const es = new EventSource(STREAM_URL);
  source = es;
  es.addEventListener("quotes", (event) => {
    const batch = JSON.parse((event as MessageEvent<string>).data) as Record<string, LiveQuote>;
    queryClient.setQueryData<SpotQuote[]>(SPOT_QUERY_KEY, (old) => applySpotQuotes(old, batch));
    const next = new Map(quotes);
    for (const [key, q] of Object.entries(batch)) next.set(key, q);
    quotes = next;
    live = true;
    notify();
  });
  es.addEventListener("unavailable", () => retryLater(RETRY_AFTER_UNAVAILABLE_MS));
  es.addEventListener("ended", () => retryLater(RETRY_AFTER_END_MS));
  es.onerror = () => {
    // CONNECTING: the browser is already retrying, so poll until batches resume.
    // CLOSED: it gave up (a non-200 such as a 401), so we decide when to retry.
    if (es.readyState === EventSource.CLOSED) retryLater(RETRY_AFTER_END_MS);
    else setLive(false);
  };
}

/** Opens or closes the one stream to match: someone wants it, the tab is visible, no retry pending. */
function sync() {
  const wanted = users > 0 && document.visibilityState === "visible" && retryTimer === undefined;
  if (wanted && !source) open();
  else if (!wanted && source) close();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Keeps the stream open while mounted. */
function useStream() {
  useEffect(() => {
    users += 1;
    if (users === 1) document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      users -= 1;
      if (users === 0) document.removeEventListener("visibilitychange", sync);
      sync();
    };
  }, []);
}

/** True while batches are arriving; the caller stops polling then. */
export function useLiveSpots(): boolean {
  useStream();
  return useSyncExternalStore(subscribe, () => live, () => false);
}

/**
 * Every streamed price by quote key, and whether the stream is live. A row whose
 * key is absent keeps its polled price.
 */
export function useLiveQuotes(): { live: boolean; quotes: ReadonlyMap<string, LiveQuote> } {
  useStream();
  const isLive = useSyncExternalStore(subscribe, () => live, () => false);
  const latest = useSyncExternalStore(subscribe, () => quotes, () => quotes);
  return { live: isLive, quotes: latest };
}
