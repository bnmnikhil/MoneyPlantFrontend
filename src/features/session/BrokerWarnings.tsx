import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectBroker } from "@/features/session/hooks";
import type { BrokerWarning } from "@/types/api";
import { brokerLabel } from "@/components/BrokerBadge";

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
  const unsupported = warning.code === "UNSUPPORTED_CAPABILITY";

  // login-url takes a brokerId as of 1f, so Reconnect now works for any broker.
  const canReconnect = expired;
  const pending = connect.isPending && connect.variables?.brokerId === warning.brokerId;

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-orange-400" />
        <div className="text-sm">
          <p className="font-medium text-orange-200">
            {expired
              ? `${brokerLabel(warning.brokerId)} session expired`
              : unsupported
                ? `${brokerLabel(warning.brokerId)} does not provide this data`
                : `Couldn't reach ${brokerLabel(warning.brokerId)}`}
          </p>
          <p className="text-orange-200/70">
            {expired
              ? "Data below excludes this broker until you reconnect it."
              : unsupported
                ? "This broker is connected, but the requested capability is not supported."
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
