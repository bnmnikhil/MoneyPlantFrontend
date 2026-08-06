import { Fragment } from "react";
import { Loader2, Plus } from "lucide-react";
import { brokerLabel } from "@/components/BrokerBadge";
import { useBrokerStatus, useConnectBroker } from "@/features/session/hooks";
import { cn } from "@/lib/utils";

/**
 * One chip per linked account, plus one per broker still to link.
 *
 * Replaces KiteStatusChip, which could only ever show Zerodha. The list is
 * driven by /api/session/status, so Alice Blue appears here on its own.
 *
 * Accounts, not brokers: two Kite accounts are two chips. The account label is
 * appended only when that broker has more than one connection, matching the
 * payoff selector's rule for the broker name — a lone account is unambiguous,
 * and "Zerodha · ZR4821" beside nothing else is just noise.
 */
function ConnectedChip({ brokerId, suffix }: { brokerId: string; suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-profit/25 bg-profit/10 px-3 py-1.5 text-xs font-medium text-profit">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-profit/70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-profit" />
      </span>
      {brokerLabel(brokerId)}
      {suffix && <span className="text-profit/70">· {suffix}</span>}
    </span>
  );
}

function ConnectChip({ brokerId }: { brokerId: string }) {
  const connect = useConnectBroker();
  const pending = connect.isPending && connect.variables === brokerId;

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

/**
 * Link a *second* account at a broker that already has one.
 *
 * Same flow as ConnectChip — one Kite Connect app authorises any of that user's
 * logins, so nothing extra is needed beyond going through the login again and
 * picking the other account. What makes it land as a new connection rather than
 * replacing the first is on the backend: the connectionId is keyed by the client
 * code the broker returns, not by a fixed `default`.
 *
 * Icon-only and muted deliberately. It sits immediately beside that broker's
 * live chip, so repeating the name would read as a second account already being
 * connected — which is the exact state it is offering to create.
 */
function AddAccountChip({ brokerId }: { brokerId: string }) {
  const connect = useConnectBroker();
  const pending = connect.isPending && connect.variables === brokerId;

  return (
    <button
      type="button"
      onClick={() => connect.mutate(brokerId)}
      disabled={pending}
      aria-label={`Add another ${brokerLabel(brokerId)} account`}
      title={`Add another ${brokerLabel(brokerId)} account`}
      className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Plus className="size-3" />
      )}
    </button>
  );
}

export function BrokerStatusChips({ className }: { className?: string }) {
  const { connections, disconnected, isLoading } = useBrokerStatus();

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
      {/*
        Grouped by broker so each one's accounts stay together and its "add
        another" sits at the end of its own run. /api/session/status already
        sorts by brokerId then accountLabel, so the Set preserves that order and
        nothing reorders between polls.
      */}
      {[...new Set(connections.map((c) => c.brokerId))].map((brokerId) => {
        const accounts = connections.filter((c) => c.brokerId === brokerId);
        return (
          <Fragment key={brokerId}>
            {accounts.map((c) => (
              <ConnectedChip
                key={c.connectionId}
                brokerId={brokerId}
                suffix={accounts.length > 1 ? c.accountLabel : undefined}
              />
            ))}
            <AddAccountChip brokerId={brokerId} />
          </Fragment>
        );
      })}
      {disconnected.map((id) => (
        <ConnectChip key={id} brokerId={id} />
      ))}
    </div>
  );
}
