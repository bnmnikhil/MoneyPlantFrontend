import { Fragment } from "react";
import { Loader2 } from "lucide-react";
import { brokerLabel } from "@/components/BrokerBadge";
import { useConnectBroker } from "@/features/session/hooks";
import { useBrokerConnectState } from "@/features/session/brokerConnectState";
import { cn } from "@/lib/utils";

/**
 * One chip per linked account, plus one per registration not yet connected.
 *
 * Replaces KiteStatusChip, which could only ever show Zerodha. The list is
 * driven by /api/session/status, so Alice Blue appears here on its own.
 *
 * Accounts, not brokers: two Kite accounts are two chips. The account label is
 * appended only when that broker has more than one connection, matching the
 * payoff selector's rule for the broker name — a lone account is unambiguous,
 * and "Zerodha · ZR4821" beside nothing else is just noise.
 *
 * This row is *status*, so an amber chip means "something is not connected" and
 * nothing else. It used to also carry an add-another-account button per
 * registration, which meant a fully connected user still saw a button per
 * registration and read the row as duplicated. Linking a second account through
 * a registration that already has one is a deliberate, rare act and now lives on
 * the broker credentials page, where the registration it belongs to is visible.
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

/**
 * A registration with no live account: the one thing on this row that is an
 * action rather than a status.
 *
 * `label` is what gets sent; `showLabel` is whether it is worth reading. They
 * are separate because a user with a single registration named "personal" still
 * has to connect through it, but has no second one to tell it apart from.
 */
function ConnectChip({
  brokerId,
  label,
  showLabel = false,
}: {
  brokerId: string;
  label?: string;
  showLabel?: boolean;
}) {
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
        showLabel && label
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
      {showLabel && label && <span className="text-amber-300/70">· {label}</span>}
    </button>
  );
}

export function BrokerStatusChips({ className }: { className?: string }) {
  const { state, isLoading } = useBrokerConnectState();

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
        Grouped by broker so each one's accounts stay together and anything left
        to connect sits at the end of its own run. Both the broker order and the
        account order come from the backend sorted, so nothing reorders between
        polls.
      */}
      {state.map(({ brokerId, accounts, pending, named }) => (
        <Fragment key={brokerId}>
          {accounts.map((c) => (
            <ConnectedChip
              key={c.connectionId}
              brokerId={brokerId}
              suffix={accounts.length > 1 ? c.accountLabel : undefined}
            />
          ))}
          {pending.map((label) => (
            <ConnectChip
              key={label}
              brokerId={brokerId}
              // The registration is always sent, never inferred: a user whose
              // only registration is named something other than "default" would
              // otherwise start a flow the backend cannot resolve.
              label={label}
              // …but only shown when there is more than one to tell apart.
              showLabel={named}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
