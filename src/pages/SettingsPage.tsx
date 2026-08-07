import { useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { brokerLabel } from "@/components/BrokerBadge";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { BrokerCredentialCard } from "@/features/credentials/BrokerCredentialCard";
import { useBrokerCredentials } from "@/features/credentials/hooks";
import type { BrokerCredential } from "@/types/api";

/**
 * Where a user supplies their own broker API credentials.
 *
 * Every broker in the stack moved to per-user credentials in 3d, so this screen
 * is now a prerequisite for connecting anything at all — there is no app-level
 * fallback. The cost is real and deliberate: each user registers their own
 * developer app at each broker they want, and pays Kite's monthly fee for
 * theirs. It buys standing on solid ground with the brokers, because each
 * user's API access is then their own subscription rather than a shared
 * registration whose terms are unclear.
 */
export function SettingsPage() {
  const credentials = useBrokerCredentials();

  // Distinct brokers, in the order the backend sent them — it sorts by brokerId
  // then label, so grouping this way keeps a stable order without re-sorting.
  const brokerIds = [...new Set((credentials.data ?? []).map((c) => c.brokerId))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Broker credentials"
        description="Connect your own broker API apps. Your keys, your accounts."
      />

      <Card>
        <CardContent className="flex gap-3 py-4 text-sm text-muted-foreground">
          <KeyRound className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <p>
              Each broker needs a developer app registered in your own name. Paste its
              key and secret here, then press Connect on the dashboard.
            </p>
            <p>
              Secrets are encrypted before they are stored and are never shown again —
              not even to you. To change one, enter it afresh.
            </p>
          </div>
        </CardContent>
      </Card>

      {credentials.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : credentials.isError ? (
        <ErrorState
          title="Couldn't load your credentials"
          onRetry={() => credentials.refetch()}
        />
      ) : (
        <div className="space-y-8">
          {brokerIds.map((brokerId) => (
            <BrokerSection
              key={brokerId}
              brokerId={brokerId}
              rows={(credentials.data ?? []).filter((c) => c.brokerId === brokerId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Every registration at one broker, and the way to add another.
 *
 * Most users will only ever see one card here. The second is for someone who
 * genuinely registered two developer apps at the same broker — it is *not* how
 * you add a second trading account, which needs no new credential at all: press
 * Connect again and sign in as the other account.
 */
function BrokerSection({ brokerId, rows }: { brokerId: string; rows: BrokerCredential[] }) {
  const [addingDraft, setAddingDraft] = useState(false);
  const configuredCount = rows.filter((r) => r.configured).length;

  return (
    <section className="space-y-4">
      {rows.map((c) => (
        <BrokerCredentialCard key={`${c.brokerId}:${c.label}`} credential={c} />
      ))}

      {addingDraft && (
        <BrokerCredentialCard
          credential={{ brokerId, label: "", apiKey: null, configured: false }}
          draft
          onCancel={() => setAddingDraft(false)}
        />
      )}

      {/*
        Offered only once the first registration exists. Before that the card
        above is already an empty form, so a second empty one would just be two
        ways to do the same thing.
      */}
      {configuredCount > 0 && !addingDraft && (
        <Button variant="outline" size="sm" onClick={() => setAddingDraft(true)}>
          <Plus />
          Add another {brokerLabel(brokerId)} registration
        </Button>
      )}
    </section>
  );
}
