import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { BrokerCredentialCard } from "@/features/credentials/BrokerCredentialCard";
import { useBrokerCredentials } from "@/features/credentials/hooks";

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
        <div className="space-y-4">
          {credentials.data?.map((c) => (
            <BrokerCredentialCard key={c.brokerId} credential={c} />
          ))}
        </div>
      )}
    </div>
  );
}
