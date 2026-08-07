import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brokerLabel } from "@/components/BrokerBadge";
import { useConnectBroker } from "@/features/session/hooks";
import type { BrokerErrorCode } from "@/types/api";

/**
 * Full-width banner for when a request failed outright because a broker is not
 * authorised. Replaces the old ConnectKiteBanner, which hardcoded Zerodha and
 * would have shown "Reconnect Kite" when Alice Blue was the broker that died.
 *
 * Distinct from BrokerWarnings: that one sits above data that is still usable.
 * This one means there is nothing to show.
 */
export function BrokerSessionBanner({
  brokerId,
  code = "BROKER_SESSION_EXPIRED",
}: {
  brokerId?: string | null;
  code?: BrokerErrorCode;
}) {
  const connect = useConnectBroker();

  const name = brokerId ? brokerLabel(brokerId) : "Your broker";
  const firstTime = code === "BROKER_NOT_CONNECTED";

  // login-url needs a brokerId as of 1f. When the failure happened before a
  // broker was resolved we have none, so there is nothing to send them to.
  const canConnect = Boolean(brokerId);
  const pending = connect.isPending && connect.variables?.brokerId === brokerId;

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
        <div className="text-sm">
          <p className="font-medium text-amber-200">
            {firstTime ? `${name} not connected` : `${name} session expired`}
          </p>
          <p className="text-amber-200/70">
            {firstTime
              ? "Link your account to start loading live data."
              : "Your connection needs to be re-authorised to load live data."}
          </p>
        </div>
      </div>

      {canConnect ? (
        <Button
          size="sm"
          onClick={() => connect.mutate({ brokerId: brokerId as string })}
          disabled={pending}
          className="shrink-0"
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          {firstTime ? "Connect" : "Reconnect"}
        </Button>
      ) : null}
    </div>
  );
}
