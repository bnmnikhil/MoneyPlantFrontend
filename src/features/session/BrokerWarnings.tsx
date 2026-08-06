import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectBroker } from "@/features/session/hooks";
import type { BrokerWarning } from "@/types/api";

const BROKER_LABELS: Record<string, string> = {
  kite: "Zerodha Kite",
  aliceblue: "Alice Blue",
  paytm: "Paytm Money",
};

function label(brokerId: string) {
  return BROKER_LABELS[brokerId] ?? brokerId;
}

/**
 * Per-broker failure notice shown above still-useful data.
 *
 * Distinct from BrokerSessionBanner: that one means the entire request failed,
 * this one means some brokers responded and some did not. The table below it
 * is real data, just incomplete — which is why this never replaces the content.
 */
function WarningRow({ warning }: { warning: BrokerWarning }) {
  const connect = useConnectBroker();
  const expired = warning.code === "SESSION_EXPIRED";

  // login-url takes a brokerId as of 1f, so Reconnect now works for any broker.
  const canReconnect = expired;
  const pending = connect.isPending && connect.variables?.brokerId === warning.brokerId;

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
        <div className="text-sm">
          <p className="font-medium text-amber-200">
            {expired
              ? `${label(warning.brokerId)} session expired`
              : `Couldn't reach ${label(warning.brokerId)}`}
          </p>
          <p className="text-amber-200/70">
            {expired
              ? "Data below excludes this broker until you reconnect it."
              : "Data below excludes this broker. This is usually temporary — the next refresh may succeed."}
          </p>
        </div>
      </div>

      {canReconnect ? (
        <Button
          size="sm"
          onClick={() => connect.mutate({ brokerId: warning.brokerId })}
          disabled={pending}
          className="shrink-0"
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          Reconnect
        </Button>
      ) : null}
    </div>
  );
}

export function BrokerWarnings({ warnings }: { warnings: BrokerWarning[] }) {
  if (!warnings.length) return null;

  return (
    <div className="space-y-2">
      {warnings.map((w) => (
        <WarningRow key={`${w.connectionId}-${w.code}`} warning={w} />
      ))}
    </div>
  );
}
