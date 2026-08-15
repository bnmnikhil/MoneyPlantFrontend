import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brokerLabel } from "@/components/BrokerBadge";
import { accountLabel } from "@/features/dashboard/aggregate";
import { formatINRWhole } from "@/lib/format";
import type { MarginUtilisationReport } from "@/types/api";

/** Amber past two thirds, red past 90% — the point where a bad day forces a trade. */
function barColour(pct: number) {
  if (pct >= 90) return "bg-destructive";
  if (pct >= 66) return "bg-amber-500";
  return "bg-primary";
}

export function MarginUtilisationCard({ margin }: { margin: MarginUtilisationReport }) {
  const empty = margin.accounts.length === 0;

  // Only label the account when a broker holds more than one.
  const multi = new Set(
    margin.accounts
      .filter(
        (a, _i, all) => all.filter((o) => o.brokerId === a.brokerId).length > 1
      )
      .map((a) => a.brokerId)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Capital utilisation</CardTitle>
        <Wallet className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {empty ? (
          /*
            NONE, not 0%. A page showing "0% committed" on a book that failed to
            load is making a claim; this says the question went unanswered.
          */
          <p className="text-xs text-muted-foreground">
            No margin data yet. Margins are archived on each fetch and appear
            here once migrated.
          </p>
        ) : (
          <>
            <div>
              <div className="text-2xl font-bold">
                {margin.utilisationPct.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {formatINRWhole(margin.used)} used of {formatINRWhole(margin.total)}
              </p>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full transition-all ${barColour(margin.utilisationPct)}`}
                style={{ width: `${Math.min(Math.max(margin.utilisationPct, 0), 100)}%` }}
              />
            </div>

            <div className="space-y-2 border-t pt-3">
              {margin.accounts.map((a) => (
                <div key={a.connectionId} className="flex justify-between text-xs">
                  <span>
                    {brokerLabel(a.brokerId)}
                    {multi.has(a.brokerId) && (
                      <span className="ml-1.5 text-muted-foreground">
                        {accountLabel(a.connectionId)}
                      </span>
                    )}
                  </span>
                  <span className="tnum text-muted-foreground">
                    {formatINRWhole(a.used)} · {a.utilisationPct.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Collateral</span>
              <span className="tnum font-semibold">{formatINRWhole(margin.collateral)}</span>
            </div>

            {/*
              Margins are migrated from different archive rows than positions, so
              they can be materially older. Stamping them with the page-level
              asOf would overstate their freshness.
            */}
            {margin.asOf && (
              <p className="border-t pt-3 text-xs text-muted-foreground">
                Margins as of {new Date(margin.asOf).toLocaleString()} · {margin.freshness}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Cash is not totalled — Alice Blue reports an opening balance while
              the others report live, so a sum would mix different moments.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
