import {
  ShieldAlert,
  TrendingUp,
  Calendar,
  Percent,
  AlertTriangle,
  Layers,
  Activity,
} from "lucide-react";
import { InstrumentRiskTable } from "@/features/risk/InstrumentRiskTable";
import { ScenarioLadders } from "@/features/risk/ScenarioLadder";
import { MarginUtilisationCard } from "@/features/risk/MarginUtilisationCard";
import { PageHeader } from "@/components/PageHeader";
import { RefreshBar } from "@/components/RefreshBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/TableSkeleton";
import { ErrorState, EmptyState } from "@/components/states";
import { useRiskSummary } from "@/features/risk/hooks";
import type { Concentration, ExpiryBucket, ExpiryTier } from "@/types/api";

const inr = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * The label the backend deliberately does not send. Presentation does not belong
 * in the API, and a tier that arrives as an enum can be styled and sorted.
 */
const TIER_LABEL: Record<ExpiryTier, string> = {
  EXPIRED: "Expired",
  THIS_WEEK: "This week",
  NEXT_WEEK: "Next week",
  THIS_MONTH: "This month",
  FAR: "Far",
  NO_EXPIRY: "Cash / no expiry",
};

function bucketLabel(b: ExpiryBucket) {
  if (!b.expiry) return TIER_LABEL[b.tier];
  const days =
    b.daysToExpiry === null
      ? ""
      : b.daysToExpiry < 0
        ? ` · ${Math.abs(b.daysToExpiry)}d ago`
        : ` · ${b.daysToExpiry}d`;
  return `${TIER_LABEL[b.tier]} (${b.expiry})${days}`;
}

function ConcentrationBars({ slices }: { slices: Concentration[] }) {
  if (slices.length === 0) {
    return <p className="text-xs text-muted-foreground">No open positions to analyse.</p>;
  }
  // Already sorted by share, descending. Do not re-sort.
  return (
    <div className="space-y-3">
      {slices.map((s) => (
        <div key={s.code} className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            {/* label, never code — `code` is punctuation-stripped ("MM" for M&M) */}
            <span>{s.label}</span>
            <span className="text-muted-foreground">
              {inr(s.marketValue)} · {s.percent}%
            </span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(s.percent, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RiskPage() {
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } =
    useRiskSummary();

  const exposure = data?.exposure;
  const instruments = data?.instruments ?? [];
  const scenarios = data?.scenarios ?? [];
  const expiryBuckets = data?.expiryBuckets ?? [];
  const warnings = data?.warnings ?? [];
  const freshness = data?.freshness ?? "NONE";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk & Portfolio Analytics"
        description="Deterministic risk analysis, concentration, and contract expiry bucketing."
        actions={
          <RefreshBar
            updatedAt={dataUpdatedAt}
            isFetching={isFetching}
            onRefresh={() => refetch()}
          />
        }
      />

      {data?.asOf && (
        <div className="text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded border flex items-center justify-between">
          <span>
            Risk data calculated as of:{" "}
            <strong className="text-foreground">{new Date(data.asOf).toLocaleString()}</strong>
          </span>
          <span className="font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
            {freshness}
          </span>
        </div>
      )}

      {/*
        A partial book has to say so. A concentration percentage computed over
        two of three brokers is not slightly wrong, it is unanswerable — the
        missing broker could hold anything.
      */}
      {warnings.length > 0 && (
        <div className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-2 rounded border border-amber-500/30 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              These numbers cover only part of your book.
            </p>
            <p className="mt-0.5 opacity-90">
              {warnings.map((w) => `${w.brokerId} (${w.code})`).join(", ")} did not
              respond, so percentages and totals exclude whatever is held there.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton headers={["Metric", "Value"]} rows={4} />
      ) : isError ? (
        <ErrorState title="Couldn't load risk analysis" onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Portfolio market value</CardTitle>
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <div className="text-2xl font-bold">
                  {inr(exposure?.netMarketValue ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Net · longs and shorts cancel
                </p>
              </div>
              <div className="border-t pt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Gross (size of book):</span>
                <span className="font-semibold">{inr(exposure?.grossMarketValue ?? 0)}</span>
              </div>
              {/*
                The honest caveat. This is qty x ltp — for an option that is the
                premium value, not the risk. Saying so here is what stops the
                number being read as a loss bound.
              */}
              <p className="text-xs text-muted-foreground border-t pt-3">
                Mark-to-market value, not exposure. For options this is premium
                value — a short option's true risk is not bounded by it.
              </p>
            </CardContent>
          </Card>

          {data?.margin && <MarginUtilisationCard margin={data.margin} />}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concentration</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  By underlying
                </p>
                <ConcentrationBars slices={exposure?.concentrationByUnderlying ?? []} />
              </div>
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  By instrument type
                </p>
                <ConcentrationBars slices={exposure?.concentrationByInstrumentType ?? []} />
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Risk by instrument</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-4">
              {instruments.length === 0 ? (
                <EmptyState
                  icon={<Layers />}
                  title="No open positions"
                  description="Each contract you hold will appear here, netted per account."
                />
              ) : (
                <>
                  <InstrumentRiskTable rows={instruments} />
                  {/*
                    Two things the column cannot say for itself.

                    The netting unit, because the obvious reading of one contract
                    appearing twice is that something is duplicated.

                    And that max loss is STANDALONE. On the real HAL bear put
                    spread in raw_capture, the short 4600 PE reads ₹685,717 on its
                    own while the structure's true worst case is ₹34,462 — the long
                    4350 PE caps it. Reading down this column, or totalling it,
                    overstates any spread by an order of magnitude. The group
                    figure needs the legs evaluated together.
                  */}
                  <p className="border-t mt-3 pt-3 text-xs text-muted-foreground">
                    Netted per account, across product buckets (NRML/MIS) but never
                    across brokers — a spread only earns margin benefit inside one
                    account.{" "}
                    <strong className="text-foreground">
                      Max loss is per contract, standalone, held to expiry.
                    </strong>{" "}
                    Offsetting legs cap each other, so these figures do not add up
                    and overstate a spread — the combined worst case needs the legs
                    valued together.
                  </p>
                  {/*
                    Margin stopped being a division of the bill on 17 Aug 2026.
                    It is now computed per contract — SEBI SPAN scanned across
                    the expiry group, plus exposure per leg — so it no longer
                    totals to what the broker charges, and the caption must say
                    so rather than let the old promise stand. Measured 8.6% over
                    a real Zerodha bill; see KiteMarginCalibrationTest.
                  */}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Margin is estimated per contract — exchange SPAN scanned across
                    each expiry, plus exposure on every short leg — so it does{" "}
                    <strong className="text-foreground">not</strong> total to your
                    broker&rsquo;s bill, which is shown unaltered under Capital. It
                    runs a few percent over on a real account, and it holds still
                    when the rest of the book changes. A{" "}
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />{" "}
                    marks a figure from the broker&rsquo;s own calculator; a{" "}
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50 align-middle" />{" "}
                    marks our estimate.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/*
            Placed directly under the instrument table, because it answers the
            question that table raises: the per-contract max loss is standalone
            and overstates a spread, and this is where the legs are valued
            together and the honest combined number appears.
          */}
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">If the underlying moves</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-4">
              {scenarios.length === 0 ? (
                <EmptyState
                  icon={<Activity />}
                  title="No scenarios to run"
                  description="Dated F&O positions get a spot ladder here, one per expiry."
                />
              ) : (
                <ScenarioLadders groups={scenarios} />
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiry & time bucketing</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-4">
              {expiryBuckets.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp />}
                  title="No contract expiry buckets"
                  description="Open F&O positions will automatically group here by expiry date."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 px-3">Expiry</th>
                        <th className="py-2 px-3">Positions</th>
                        <th className="py-2 px-3 text-right">Net value</th>
                        <th className="py-2 px-3 text-right">Gross value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiryBuckets.map((bucket) => (
                        <tr
                          key={bucket.expiry ?? bucket.tier}
                          className="border-b hover:bg-muted/50"
                        >
                          <td className="py-2.5 px-3 font-medium">
                            <span
                              className={
                                bucket.tier === "EXPIRED"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : undefined
                              }
                            >
                              {bucketLabel(bucket)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">{bucket.positionCount}</td>
                          <td className="py-2.5 px-3 text-right font-semibold">
                            {inr(bucket.netMarketValue)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">
                            {inr(bucket.grossMarketValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
