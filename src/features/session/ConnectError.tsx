import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brokerLabel } from "@/components/BrokerBadge";
import { useConnectBroker } from "@/features/session/hooks";

/**
 * Broker ids the callbacks can name in ?error=. Kept as a set rather than
 * trusted from the URL: the parameter is user-editable, so an unrecognised
 * value renders nothing at all instead of being echoed back onto the page.
 */
const BROKER_CODES: ReadonlySet<string> = new Set(["kite", "aliceblue", "paytm"]);

type ConnectFailure = {
  /** null when the failure is not attributable to one broker. */
  brokerId: string | null;
  title: string;
  detail: string;
  /**
   * What the user can do about it. "retry" offers Connect again; "settings"
   * sends them to the credentials screen — retrying would fail identically.
   */
  action: "retry" | "settings" | "none";
};

function describe(code: string): ConnectFailure | null {
  // PendingConnect dropped the flow before the callback arrived, so the backend
  // never learned which broker it was — hence no retry button on this one.
  if (code === "connect_expired") {
    return {
      brokerId: null,
      action: "none",
      title: "The connect attempt timed out",
      detail:
        "Too much time passed between starting the connection and returning from the broker, so the attempt was discarded. Press Connect again to start over.",
    };
  }

  // 3d: the credentials were removed between pressing Connect and the broker
  // answering. Rare, but retrying cannot fix it, so this gets Settings instead.
  const missing = code.endsWith("_not_configured")
    ? code.slice(0, -"_not_configured".length)
    : null;
  if (missing && BROKER_CODES.has(missing)) {
    return {
      brokerId: missing,
      action: "settings",
      title: `${brokerLabel(missing)} has no credentials stored`,
      detail:
        "The API key and secret for this broker were removed while the connection was in progress, so it could not be completed. Add them again to connect.",
    };
  }

  if (!BROKER_CODES.has(code)) return null;

  return {
    brokerId: code,
    action: "retry",
    title: `Couldn't connect ${brokerLabel(code)}`,
    detail:
      "The broker didn't complete the connection, so no account was linked. This is usually transient — trying again normally works.",
  };
}

/**
 * Renders the `?error=` a broker callback redirects back with.
 *
 * The callbacks at /{broker}/callback are public by necessity and cannot render
 * anything themselves, so they signal failure by redirecting to /app?error=…
 * Without this the user lands on the dashboard and a failed connect looks
 * exactly like a successful one that returned no data.
 *
 * Mount this on both dashboard branches — a failed connect usually leaves
 * nothing connected, so the ConnectBrokerCard path is the likelier landing.
 */
export function ConnectError() {
  const [params, setParams] = useSearchParams();
  const connect = useConnectBroker();
  const [failure, setFailure] = useState<ConnectFailure | null>(null);

  const code = params.get("error");

  // Held in state and stripped from the URL, so a refresh or a shared link does
  // not resurrect an error the user has already read and acted on.
  useEffect(() => {
    if (!code) return;
    setFailure(describe(code));
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("error");
        return next;
      },
      { replace: true }
    );
  }, [code, setParams]);

  if (!failure) return null;

  const { brokerId } = failure;
  const pending = connect.isPending && connect.variables === brokerId;

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="text-sm">
          <p className="font-medium text-foreground">{failure.title}</p>
          <p className="text-muted-foreground text-pretty">{failure.detail}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {failure.action === "retry" && brokerId && (
          <Button
            size="sm"
            onClick={() => connect.mutate(brokerId)}
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Try again
          </Button>
        )}
        {failure.action === "settings" && (
          <Button asChild size="sm">
            <Link to="/app/settings">Add credentials</Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          aria-label="Dismiss"
          onClick={() => setFailure(null)}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
