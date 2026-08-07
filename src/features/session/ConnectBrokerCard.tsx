import { KeyRound, Link2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brokerLabel } from "@/components/BrokerBadge";
import { useConnectBroker } from "@/features/session/hooks";
import { useBrokerConnectState } from "@/features/session/brokerConnectState";
import { ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

/**
 * Empty state when no broker is linked yet.
 *
 * Replaces ConnectKiteCard, which offered Zerodha and nothing else. Renders a
 * button per unconnected broker straight from /api/session/status.
 */
export function ConnectBrokerCard({ className }: { className?: string }) {
  const { state } = useBrokerConnectState();
  const connect = useConnectBroker();

  // No credentials at all: there is nothing to connect yet, and offering a
  // Connect button would start a broker round trip that fails at the last step.
  // `brokers` became user-scoped in 3d, so an empty state means exactly this.
  if (state.length === 0) {
    return <ConfigureBrokersCard className={className} />;
  }

  // One button per registration with no account behind it. This card only shows
  // when nothing at all is connected, so that is normally every registration the
  // user has — but it is derived the same way as the status chips rather than
  // assumed, so the two can never disagree.
  const targets = state.flatMap(({ brokerId, pending, named }) =>
    pending.map((label) => ({ brokerId, label, named }))
  );

  return (
    <Card className={cn("mx-auto max-w-lg", className)}>
      <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/25 [&_svg]:size-6">
          <Link2 />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">
            Connect a broker
          </h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">
            Link an account to sync live positions, holdings and margins. You'll
            be redirected to the broker to authorise access. Connect more than
            one and everything below is aggregated.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {targets.map(({ brokerId, label, named }) => {
            const busy =
              connect.isPending &&
              connect.variables?.brokerId === brokerId &&
              connect.variables?.label === label;
            return (
              <Button
                key={`${brokerId}:${label}`}
                size="lg"
                variant={brokerId === "kite" ? "default" : "outline"}
                onClick={() => connect.mutate({ brokerId, label })}
                disabled={busy}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Link2 />}
                {busy
                  ? "Redirecting…"
                  : `Connect ${brokerLabel(brokerId)}${named ? ` · ${label}` : ""}`}
              </Button>
            );
          })}
        </div>

        {connect.isError && (
          <ErrorState
            className="py-4"
            title="Couldn't start the connect flow"
            description="We couldn't reach the broker just now. Please try again."
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The first-run state as of 3d: signed in, but no broker credentials stored.
 *
 * A separate card rather than a disabled Connect button, because the action
 * needed is genuinely different — register a developer app at the broker and
 * paste two values — and a greyed-out button would suggest the app is merely
 * busy or broken.
 */
function ConfigureBrokersCard({ className }: { className?: string }) {
  return (
    <Card className={cn("mx-auto max-w-lg", className)}>
      <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/25 [&_svg]:size-6">
          <KeyRound />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">
            Add your broker credentials
          </h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">
            MoneyPlant connects through your own broker API app, so your account
            access stays yours. Register one at each broker you use, then paste its
            key and secret.
          </p>
        </div>

        <Button asChild size="lg">
          <Link to="/app/settings">
            <KeyRound />
            Go to broker credentials
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
