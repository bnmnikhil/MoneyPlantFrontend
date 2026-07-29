import { Loader2 } from "lucide-react";
import { brokerLabel } from "@/components/BrokerBadge";
import { useBrokerStatus, useConnectBroker } from "@/features/session/hooks";
import { cn } from "@/lib/utils";

/**
 * One chip per broker the backend knows about.
 *
 * Replaces KiteStatusChip, which could only ever show Zerodha. The list is
 * driven by /api/session/status, so Alice Blue appears here on its own.
 */
function Chip({ brokerId, connected }: { brokerId: string; connected: boolean }) {
  const connect = useConnectBroker();
  const pending = connect.isPending && connect.variables === brokerId;

  if (connected) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-profit/25 bg-profit/10 px-3 py-1.5 text-xs font-medium text-profit">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-profit/70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-profit" />
        </span>
        {brokerLabel(brokerId)}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => connect.mutate(brokerId)}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-60"
      title={`Connect your ${brokerLabel(brokerId)} account`}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      )}
      {brokerLabel(brokerId)}
    </button>
  );
}

export function BrokerStatusChips({ className }: { className?: string }) {
  const { brokers, isLoading } = useBrokerStatus();

  if (isLoading) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground",
          className
        )}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
        Checking brokers…
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {brokers.map((b) => (
        <Chip key={b.id} brokerId={b.id} connected={b.connected} />
      ))}
    </div>
  );
}
