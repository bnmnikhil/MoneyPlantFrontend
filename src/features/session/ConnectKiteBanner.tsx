import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectKite } from "@/features/session/hooks";

/** Amber inline banner shown when the Kite session is disconnected or expired. */
export function ConnectKiteBanner() {
  const connect = useConnectKite();
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
        <div className="text-sm">
          <p className="font-medium text-amber-200">Kite session expired</p>
          <p className="text-amber-200/70">
            Your Zerodha connection needs to be re-authorized to load live data.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => connect.mutate()}
        disabled={connect.isPending}
        className="shrink-0"
      >
        {connect.isPending ? <Loader2 className="animate-spin" /> : null}
        Reconnect Kite
      </Button>
    </div>
  );
}
