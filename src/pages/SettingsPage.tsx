import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, KeyRound, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { AddRegistrationPanel } from "@/features/credentials/AddRegistrationPanel";
import { BrokerGroup } from "@/features/credentials/BrokerGroup";
import { useBrokerCredentials } from "@/features/credentials/hooks";
import { groupRegistrations } from "@/features/credentials/model";
import { useBrokerDefinitions } from "@/features/brokers/hooks";
import { useBrokerStatus } from "@/features/session/hooks";

/**
 * Where a user supplies their own broker API credentials.
 *
 * Every broker in the stack moved to per-user credentials in 3d, so this screen
 * is now a prerequisite for connecting anything at all — there is no app-level
 * fallback. The cost is real and deliberate: each user registers their own
 * developer app at each broker they want. It buys standing on solid ground with
 * the brokers, because each user's API access is then their own subscription
 * rather than a shared registration whose terms are unclear.
 *
 * The page lists only brokers the user has actually set up. Everything the
 * build supports lives in the Add panel's dropdown instead — a row for a broker
 * you do not use is clutter on a page you open to manage the ones you do.
 */
export function SettingsPage() {
  const credentials = useBrokerCredentials();
  const definitions = useBrokerDefinitions();
  const status = useBrokerStatus();
  const [adding, setAdding] = useState(false);

  const loading = credentials.isLoading || definitions.isLoading;
  const failed = credentials.isError || definitions.isError;

  const rows = useMemo(() => credentials.data ?? [], [credentials.data]);
  const catalogue = useMemo(() => definitions.data ?? [], [definitions.data]);
  const groups = useMemo(() => groupRegistrations(rows, catalogue), [rows, catalogue]);

  // Said in the subtitle rather than as a tile: this page is read to answer
  // "is my setup healthy", and the header's Brokers menu already answers it in
  // the same words. The two must not disagree — they read the same flag.
  const needsReconnect = status.connections.filter((c) => !c.connected).length;
  const registrationCount = groups.reduce((n, g) => n + g.registrations.length, 0);
  const summary = loading || failed
    ? "Connect your own broker API apps. Your keys, your accounts."
    : registrationCount === 0
      ? "Connect your own broker API apps. Your keys, your accounts."
      : [
          `${registrationCount} registration${registrationCount === 1 ? "" : "s"} across ${groups.length} broker${groups.length === 1 ? "" : "s"}`,
          needsReconnect > 0
            ? `${needsReconnect} account${needsReconnect === 1 ? "" : "s"} need${needsReconnect === 1 ? "s" : ""} reconnecting`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/*
        Broker credentials is not in `primaryNavItems`, so no top-nav tab
        highlights while you are here and nothing in the chrome offers a way
        back. Since the shell moved from a sidebar to a top bar, this link is
        the only wayfinding the page has.
      */}
      <Link
        to="/app"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ChevronLeft className="size-4" />
        Overview
      </Link>

      <PageHeader
        title="Broker credentials"
        description={summary}
        actions={
          !loading &&
          !failed && (
            <Button onClick={() => setAdding(true)} disabled={adding}>
              <Plus />
              Add broker
            </Button>
          )
        }
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : failed ? (
        <ErrorState
          title="Couldn't load broker setup"
          onRetry={() => {
            credentials.refetch();
            definitions.refetch();
          }}
        />
      ) : (
        <div className="space-y-5">
          {adding && (
            <AddRegistrationPanel
              definitions={catalogue}
              credentials={rows}
              onClose={() => setAdding(false)}
            />
          )}

          {groups.length > 0 ? (
            groups.map((group) => <BrokerGroup key={group.definition.id} group={group} />)
          ) : (
            !adding && (
              <Card>
                <CardContent>
                  <EmptyState
                    icon={<KeyRound />}
                    title="No broker registrations yet"
                    description="Register a developer app at your broker, then choose Add broker to store its key and secret here."
                    action={
                      <Button onClick={() => setAdding(true)}>
                        <Plus />
                        Add broker
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            )
          )}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <KeyRound className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Each broker needs a developer app registered in your own name. Secrets are
              encrypted before they are stored and are never shown again — not even to you.
              To change one, enter it afresh.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
