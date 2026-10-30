import { useEffect, useSyncExternalStore } from "react";
import { queryClient } from "@/lib/queryClient";
import { mergeSpot, TICKER_INDICES } from "@/features/market/tickerItems";
import type { SpotQuote } from "@/types/api";

/**
 * NIFTY and BANKNIFTY pushed from the user's Paytm socket, written into the same
 * query the poll fills, so the ticker renders one source either way.
 *
 * One EventSource for the whole page however many tickers are mounted (the header
 * and the phone strip both are). Live only once a tick has arrived: a stream that
 * opens and stays silent leaves polling on. Closed while the tab is hidden, so a
 * background tab holds no broker socket.
 *
 * No streaming broker ("unavailable") or a feed that gave up ("ended"): close and
 * poll, and try again later, in case the user connects Paytm meanwhile.
 */
export const SPOT_QUERY_KEY = ["market-data", "spot", ...TICKER_INDICES] as const;

const STREAM_URL = `/api/market-data/spot/stream?underlyings=${TICKER_INDICES.join(",")}`;
const RETRY_AFTER_UNAVAILABLE_MS = 5 * 60_000;
const RETRY_AFTER_END_MS = 60_000;

let source: EventSource | null = null;
let users = 0;
let live = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function setLive(next: boolean) {
  if (live === next) return;
  live = next;
  listeners.forEach((listener) => listener());
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
  es.addEventListener("spot", (event) => {
    const tick = JSON.parse((event as MessageEvent<string>).data) as SpotQuote;
    queryClient.setQueryData<SpotQuote[]>(SPOT_QUERY_KEY, (old) => mergeSpot(old, tick));
    setLive(true);
  });
  es.addEventListener("unavailable", () => retryLater(RETRY_AFTER_UNAVAILABLE_MS));
  es.addEventListener("ended", () => retryLater(RETRY_AFTER_END_MS));
  es.onerror = () => {
    // CONNECTING: the browser is already retrying, so poll until ticks resume.
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

/** True while ticks are arriving; the caller stops polling then. */
export function useLiveSpots(): boolean {
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
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => live,
    () => false,
  );
}
