import { Link2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useConnectKite } from "@/features/session/hooks";
import { ErrorState } from "@/components/states";
import { cn } from "@/lib/utils";

/** Large centered card prompting the user to link their Zerodha (Kite) account. */
export function ConnectKiteCard({
  className,
  title = "Connect your Zerodha account",
  description = "Link your Kite account to sync live positions, holdings and margins. You'll be redirected to Zerodha to authorize access.",
}: {
  className?: string;
  title?: string;
  description?: string;
}) {
  const connect = useConnectKite();

  return (
    <Card className={cn("mx-auto max-w-lg", className)}>
      <CardContent className="flex flex-col items-center gap-5 px-6 py-12 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/25 [&_svg]:size-6">
          <Link2 />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">
            {description}
          </p>
        </div>

        <Button size="lg" onClick={() => connect.mutate()} disabled={connect.isPending}>
          {connect.isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Redirecting…
            </>
          ) : (
            <>
              <Link2 />
              Connect Kite
            </>
          )}
        </Button>

        {connect.isError && (
          <ErrorState
            className="py-4"
            title="Couldn't start the connect flow"
            description="We couldn't reach Zerodha just now. Please try again."
            onRetry={() => connect.mutate()}
          />
        )}
      </CardContent>
    </Card>
  );
}
