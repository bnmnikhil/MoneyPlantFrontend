import { Check, KeyRound, Loader2, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { brokerLabel } from "@/components/BrokerBadge";
import { useBrokerDefinitions } from "@/features/brokers/hooks";
import { useConnectBroker } from "@/features/session/hooks";
import { useBrokerConnectState } from "@/features/session/brokerConnectState";
import { loginRows, todayInIndia } from "@/features/session/dailyLogin";
import { ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

/**
 * The Overview before any broker is logged in today (N16).
 *
 * For a returning user this is the daily login, not setup: broker logins end every
 * night. One even row per registration, every button alike, so no broker reads as
 * preferred. The rows come from the same join as the status chips
 * (brokerConnectState), so the two can never disagree.
 */
export function ConnectBrokerCard({ className }: { className?: string }) {
  const { state } = useBrokerConnectState();
  const connect = useConnectBroker();

  // No credentials at all: there is nothing to log in to yet, and a Log in button
  // would start a broker round trip that fails at the last step.
  if (state.length === 0) {
    return <FirstRunChecklist className={className} />;
  }

  const rows = loginRows(state, brokerLabel);

  return (
    <div className={cn("mx-auto flex w-full max-w-2xl flex-col gap-7 py-6 sm:py-10", className)}>
      <div className="space-y-2.5">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">{todayInIndia(new Date())}</p>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Log in to your brokers for today</h2>
        <p className="max-w-xl text-muted-foreground text-pretty">
          Broker logins end every night, so each account needs one login a day. Your Overview fills
          in as each one connects; you don't have to log in to all of them.
        </p>
      </div>

      <section aria-label="Your brokers" className="overflow-hidden rounded-lg border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows.map(({ brokerId, label, title, note }) => {
            const busy =
              connect.isPending &&
              connect.variables?.brokerId === brokerId &&
              connect.variables?.label === label;
            return (
              <li key={`${brokerId}:${label}`} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-secondary text-sm font-semibold">
                  {monogram(title)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{note}</p>
                </div>
                <Button variant="outline" className="min-h-11 shrink-0" disabled={busy}
                  aria-label={`Log in to ${title}`}
                  onClick={() => connect.mutate({ brokerId, label })}>
                  {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
                  {busy ? "Redirecting…" : "Log in"}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      {connect.isError && (
        <ErrorState
          className="py-4"
          title="Couldn't start the login"
          description="We couldn't reach the broker just now. Please try again."
        />
      )}

      <p className="text-sm text-muted-foreground">
        Each login opens the broker's own page and comes back here. To add a broker, change a key or
        remove one you no longer use, go to{" "}
        <Link to="/app/settings" className="text-primary underline-offset-4 hover:underline">Broker settings</Link>.
      </p>
    </div>
  );
}

/** "Zerodha Kite" → "ZK"; "Upstox" → "UP". */
function monogram(title: string) {
  const words = title.split(" · ")[0].split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0]?.slice(0, 2) ?? "").toUpperCase();
}

/**
 * Signed in, no broker credentials stored. A checklist rather than a disabled Log in
 * button, because the step needed is genuinely different: create a key at the
 * broker and paste it in. Settings opens with the add form, which carries N14's
 * per-broker steps.
 */
function FirstRunChecklist({ className }: { className?: string }) {
  const brokers = useBrokerDefinitions().data ?? [];
  return (
    <div className={cn("mx-auto flex w-full max-w-2xl flex-col gap-7 py-6 sm:py-10", className)}>
      <div className="space-y-2.5">
        <h2 className="font-serif text-3xl font-semibold sm:text-4xl">Welcome to GoldenBook</h2>
        <p className="max-w-xl text-muted-foreground text-pretty">
          GoldenBook reads your positions and holdings through each broker's own API, using a key
          you create at the broker. Set up one broker to begin; add the others any time.
        </p>
      </div>

      <ol aria-label="Getting started" className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        <li className="flex gap-4 p-5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-profit text-background">
            <Check className="size-4" aria-label="Done" />
          </span>
          <div className="pt-1">
            <p className="font-medium text-muted-foreground">Sign in with Google</p>
            <p className="text-sm text-muted-foreground">Done.</p>
          </div>
        </li>
        <li className="flex gap-4 bg-secondary/60 p-5" aria-current="step">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-primary text-sm font-semibold text-primary">2</span>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <p className="font-semibold">Add a broker's API key and secret</p>
              <p className="text-sm text-muted-foreground text-pretty">
                Pick your broker and the steps to create the key appear with the form. About ten
                minutes the first time; you only do it once per broker.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/app/settings?add=1"><KeyRound />Add a broker</Link>
            </Button>
          </div>
        </li>
        <li className="flex gap-4 p-5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-sm font-semibold text-muted-foreground">3</span>
          <div className="pt-1">
            <p className="font-medium">Log in to that broker for today</p>
            <p className="text-sm text-muted-foreground text-pretty">
              Broker logins end every night, so this is one click each trading day. Your figures
              appear as soon as it connects.
            </p>
          </div>
        </li>
      </ol>

      <div className="space-y-2.5">
        {brokers.length > 0 && <>
          <p className="text-sm text-muted-foreground">Brokers you can add</p>
          <ul className="flex flex-wrap gap-2" aria-label="Brokers you can add">
            {brokers.map((broker) => (
              <li key={broker.id} className="rounded-full border border-border px-3 py-1 text-sm">{broker.displayName}</li>
            ))}
          </ul>
        </>}
        <p className="text-sm text-muted-foreground">Read-only: GoldenBook never places orders.</p>
      </div>
    </div>
  );
}
