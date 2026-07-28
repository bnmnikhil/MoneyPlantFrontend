import { Loader2 } from "lucide-react";
import { useKiteStatus, useConnectKite } from "@/features/session/hooks";
import { cn } from "@/lib/utils";

/**
 * Top-bar chip reflecting broker (Kite) connection.
 *  - connected    -> green, static
 *  - disconnected -> amber, clickable (starts the Connect Kite flow)
 *  - loading      -> neutral pulse
 */
export function KiteStatusChip({ className }: { className?: string }) {
  const { data, isLoading } = useKiteStatus();
  const connect = useConnectKite();

  if (isLoading) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground",
          className
        )}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
        Checking Kite…
      </span>
    );
  }

  const connected =  data?.brokers?.find((b) => b.id === "kite")?.connected ?? false;

  if (connected) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-profit/25 bg-profit/10 px-3 py-1.5 text-xs font-medium text-profit",
          className
        )}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-profit/70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-profit" />
        </span>
        Kite connected
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => connect.mutate()}
      disabled={connect.isPending}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-60",
        className
      )}
      title="Click to reconnect your Zerodha account"
    >
      {connect.isPending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      )}
      Kite disconnected
    </button>
  );
}
