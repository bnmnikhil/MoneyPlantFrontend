import { Fragment } from "react";
import { Loader2, Plus } from "lucide-react";
import { brokerLabel } from "@/components/BrokerBadge";
import { useBrokerStatus, useConnectBroker } from "@/features/session/hooks";
import { useBrokerCredentials } from "@/features/credentials/hooks";
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

function ConnectChip({ brokerId, label }: { brokerId: string; label?: string }) {
  const connect = useConnectBroker();
  const pending =
    connect.isPending &&
    connect.variables?.brokerId === brokerId &&
    connect.variables?.label === label;

  return (
    <button
      type="button"
      onClick={() => connect.mutate({ brokerId, label })}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-60"
      title={
        label
          ? `Connect ${brokerLabel(brokerId)} using your "${label}" registration`
          : `Connect your ${brokerLabel(brokerId)} account`
      }
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      )}
      {brokerLabel(brokerId)}
      {label && <span className="text-amber-300/70">· {label}</span>}
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
function AddAccountChip({ brokerId, label }: { brokerId: string; label?: string }) {
  const connect = useConnectBroker();
  const pending =
    connect.isPending &&
    connect.variables?.brokerId === brokerId &&
    connect.variables?.label === label;

  const what = label
    ? `Add another ${brokerLabel(brokerId)} account via your "${label}" registration`
    : `Add another ${brokerLabel(brokerId)} account`;

  return (
    <button
      type="button"
      onClick={() => connect.mutate({ brokerId, label })}
      disabled={pending}
      aria-label={what}
      title={what}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Plus className="size-3" />
      )}
      {/* Named only when there is a choice to make. */}
      {label && <span>{label}</span>}
    </button>
  );
}

export function BrokerStatusChips({ className }: { className?: string }) {
  const { connections, disconnected, isLoading } = useBrokerStatus();

  // Which registrations exist per broker. Only consulted to decide whether the
  // user has a *choice* — with one registration the chips stay unlabelled and
  // send no label, and the backend resolves `default`. Reuses the settings
  // screen's query, so this costs no extra request on the dashboard.
  const credentials = useBrokerCredentials();
  const registrations = (brokerId: string): (string | undefined)[] => {
    const labels = (credentials.data ?? [])
      .filter((c) => c.brokerId === brokerId && c.configured)
      .map((c) => c.label);
    return labels.length > 1 ? labels : [undefined];
  };

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
            {registrations(brokerId).map((label) => (
              <AddAccountChip key={label ?? "-"} brokerId={brokerId} label={label} />
            ))}
          </Fragment>
        );
      })}
      {disconnected.map((id) => (
        <Fragment key={id}>
          {registrations(id).map((label) => (
            <ConnectChip key={label ?? "-"} brokerId={id} label={label} />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
