import { useEffect, useState } from "react";
import { Inbox, TrendingUp, TrendingDown, Target, Crosshair } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import { BrokerSessionBanner } from "@/features/session/BrokerSessionBanner";
import { PayoffChart } from "@/features/payoff/PayoffChart";
import { LegsTable } from "@/features/payoff/LegsTable";
import { usePayoff, usePayoffUnderlyings } from "@/features/payoff/hooks";
import { brokerIdOf, isBrokerSessionError } from "@/lib/api";
import { formatINRWhole } from "@/lib/format";
import { cn } from "@/lib/utils";

function UnderlyingSelector({
  underlyings,
  selected,
  onSelect,
}: {
  underlyings: string[];
  selected: string | undefined;
  onSelect: (u: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {underlyings.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onSelect(u)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
            u === selected
              ? "border-primary/40 bg-primary/12 text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {u}
        </button>
      ))}
    </div>
  );
}

function ModeToggle() {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
      <span className="rounded-md bg-primary/12 px-3 py-1 font-medium text-primary">
        At Expiry
      </span>
      <span
        className="cursor-not-allowed px-3 py-1 font-medium text-muted-foreground/50"
        title="Intraday curve coming soon"
      >
        T+0
        <span className="ml-1.5 text-[10px] uppercase tracking-wide">Soon</span>
      </span>
    </div>
  );
}

export function PayoffPage() {
  const underlyings = usePayoffUnderlyings();
  const [selected, setSelected] = useState<string>();

  // Auto-select the first underlying once the list arrives; keep selection valid.
  useEffect(() => {
    const list = underlyings.data;
    if (!list?.length) return;
    setSelected((cur) => (cur && list.includes(cur) ? cur : list[0]));
  }, [underlyings.data]);

  const payoff = usePayoff(selected);
  const data = payoff.data;
  const p = data?.payoff;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Option Payoff"
        description="Expiry payoff curve for your open F&O positions."
        actions={
          underlyings.data && underlyings.data.length > 0 ? (
            <UnderlyingSelector
              underlyings={underlyings.data}
              selected={selected}
              onSelect={setSelected}
            />
          ) : undefined
        }
      />

      {/* Underlyings list failed */}
      {underlyings.isError && (
        <Card>
          <CardContent className="p-0">
            <ErrorState
              title="Couldn't load underlyings"
              onRetry={() => underlyings.refetch()}
            />
          </CardContent>
        </Card>
      )}

      {/* No positions to plot */}
      {underlyings.data && underlyings.data.length === 0 && (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Inbox />}
              title="No open F&O positions to plot."
              description="Once you hold options positions, their payoff curve will appear here."
            />
          </CardContent>
        </Card>
      )}

      {/* Broker needs authorising → nothing to plot */}
      {isBrokerSessionError(payoff.error) && (
        <BrokerSessionBanner brokerId={brokerIdOf(payoff.error)} />
      )}

      {/* Main body: only when we have (or are loading) a selected underlying */}
      {selected && !isBrokerSessionError(payoff.error) && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Current spot"
              icon={<Crosshair />}
              loading={payoff.isLoading}
              value={formatINRWhole(data?.spot ?? 0)}
            />
            <StatCard
              label="Max profit"
              icon={<TrendingUp />}
              loading={payoff.isLoading}
              valueClassName="text-profit"
              value={p?.unboundedProfit ? "Unlimited" : formatINRWhole(p?.maxProfit ?? 0)}
            />
            <StatCard
              label="Max loss"
              icon={<TrendingDown />}
              loading={payoff.isLoading}
              valueClassName="text-loss"
              value={p?.unboundedLoss ? "Unlimited" : formatINRWhole(p?.maxLoss ?? 0)}
            />
            <StatCard
              label="Breakevens"
              icon={<Target />}
              loading={payoff.isLoading}
              value={
                p?.breakevens.length
                  ? p.breakevens.map((b) => formatINRWhole(b)).join(" / ")
                  : "—"
              }
              valueClassName="text-lg"
            />
          </div>

          {/* Chart */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Payoff at expiry</CardTitle>
              <ModeToggle />
            </CardHeader>
            <CardContent>
              {payoff.isLoading ? (
                <Skeleton className="h-[380px] w-full" />
              ) : payoff.isError ? (
                <ErrorState
                  title="Couldn't load payoff"
                  onRetry={() => payoff.refetch()}
                />
              ) : p && data ? (
                <>
                  <PayoffChart payoff={p} spot={data.spot} />
                  {(p.unboundedLoss || p.unboundedProfit) && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {p.unboundedLoss && (
                        <span className="text-loss">
                          ⚠ Loss is unlimited beyond the plotted range.
                        </span>
                      )}
                      {p.unboundedLoss && p.unboundedProfit && " "}
                      {p.unboundedProfit && (
                        <span>Profit continues beyond the plotted range.</span>
                      )}
                    </p>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* Legs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Position legs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {payoff.isLoading ? (
                <div className="space-y-3 p-6">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-3/4" />
                </div>
              ) : data?.legs?.length ? (
                <LegsTable legs={data.legs} />
              ) : (
                <EmptyState
                  icon={<Inbox />}
                  title="No legs"
                  description="This underlying has no plottable legs."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Initial load of underlyings */}
      {underlyings.isLoading && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCard key={i} label="" value="" loading />
          ))}
        </div>
      )}
    </div>
  );
}
