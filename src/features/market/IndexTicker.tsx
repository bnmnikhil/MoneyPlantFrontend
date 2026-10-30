import { useQuery } from "@tanstack/react-query";
import { brokerLabel } from "@/components/BrokerBadge";
import { SPOT_QUERY_KEY, useLiveSpots } from "@/features/market/quoteStream";
import { TICKER_INDICES, tickerItems, type TickerItem } from "@/features/market/tickerItems";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * NIFTY and BANKNIFTY spot. Pushed once a second from the user's Paytm socket
 * when there is one (quoteStream.ts, which writes into this same query); otherwise
 * polled every 30s like the other live figures, and the poll resumes whenever the
 * stream stops. One query shared by the header and the mobile strip.
 */
function useIndexSpots() {
  const live = useLiveSpots();
  return useQuery({
    queryKey: SPOT_QUERY_KEY,
    queryFn: () => api.spot(TICKER_INDICES),
    staleTime: 15_000,
    refetchInterval: live ? false : 30_000,
  });
}

const toneClass = { up: "text-profit", down: "text-loss", flat: "text-muted-foreground" } as const;

function Item({ item, stale, compact }: { item: TickerItem; stale: boolean; compact: boolean }) {
  const missing = item.price === "—";
  return (
    <span className="flex items-baseline gap-1.5" title={stale ? `Couldn't refresh · ${item.title}` : item.title}>
      <span className={cn("font-medium text-muted-foreground", compact ? "text-[0.6875rem]" : "text-xs")}>{item.underlying}</span>
      <span className={cn("font-semibold", (missing || stale) && "text-muted-foreground")}>
        {compact ? item.price : <><span className="xl:hidden">{item.priceWhole}</span><span className="hidden xl:inline">{item.price}</span></>}
      </span>
      {item.change && <span className={cn("font-medium", compact ? "text-xs" : "text-[0.8125rem]", stale ? "text-muted-foreground" : toneClass[item.tone])}>{item.change}</span>}
    </span>
  );
}

/** In the top bar, desktop only: plain text, not controls. Whole points below xl. */
export function IndexTicker({ className }: { className?: string }) {
  const { data, isError } = useIndexSpots();
  const items = tickerItems(data, brokerLabel);
  const stale = isError && data !== undefined;
  return (
    <div aria-label="Index prices" className={cn("items-baseline gap-4 whitespace-nowrap text-sm tabular-nums xl:gap-5", className)}>
      {items.map((item) => <Item key={item.underlying} item={item} stale={stale} compact={false} />)}
    </div>
  );
}

/** Under the header on phones and tablets, where the top bar has no room. */
export function IndexStrip({ className }: { className?: string }) {
  const { data, isError } = useIndexSpots();
  const items = tickerItems(data, brokerLabel);
  const stale = isError && data !== undefined;
  return (
    <div aria-label="Index prices" className={cn("grid grid-cols-2 border-b border-border bg-card text-sm tabular-nums", className)}>
      {items.map((item, i) => (
        <div key={item.underlying} className={cn("flex items-baseline px-4 py-2 sm:px-6", i > 0 && "border-l border-border")}>
          <Item item={item} stale={stale} compact />
        </div>
      ))}
    </div>
  );
}
