import { useEffect, useState } from "react";
import {
  Inbox,
  TrendingUp,
  TrendingDown,
  Target,
  Crosshair,
  Wrench,
  BookOpen,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import { BrokerSessionBanner } from "@/features/session/BrokerSessionBanner";
import { PayoffChart } from "@/features/payoff/PayoffChart";
import { LegsTable } from "@/features/payoff/LegsTable";
import { holdingView } from "@/features/payoff/holdingView";
import { StrategyBuilderView } from "@/features/strategy-builder/StrategyBuilderView";
import { usePayoff, usePayoffCurves } from "@/features/payoff/hooks";
import { brokerLabel } from "@/components/BrokerBadge";
import { brokerIdOf, isBrokerSessionError } from "@/lib/api";
import { formatINRWhole } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CurveRef, PayoffLeg } from "@/types/api";

const curveKey = (c: CurveRef) => `${c.connectionId}:${c.underlying}`;

/**
 * One button per (broker, underlying).
 *
 * The broker name is appended only when more than one broker is connected —
 * same rule the positions and holdings tables use. With a single broker it is
 * noise; with two it is the only thing distinguishing two BANKNIFTY curves.
 */
function CurveSelector({
  curves,
  selected,
  onSelect,
}: {
  curves: CurveRef[];
  selected: CurveRef | undefined;
  onSelect: (c: CurveRef) => void;
}) {
  const showBroker = new Set(curves.map((c) => c.brokerId)).size > 1;

  return (
    <div className="flex flex-wrap gap-1.5">
      {curves.map((c) => (
        <button
          key={curveKey(c)}
          type="button"
          onClick={() => onSelect(c)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
            selected && curveKey(c) === curveKey(selected)
              ? "border-primary/40 bg-primary/12 text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {/* Label, not the canonical code — `underlying` is punctuation-stripped
              for grouping and reads MM for Mahindra. The code still keys the
              button and is what gets sent to /api/payoff/{'{'}underlying{'}'}. */}
          {c.underlyingLabel}
          {showBroker && (
            <span className="ml-1.5 font-normal opacity-70">· {brokerLabel(c.brokerId)}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function ModeToggle({ mixedExpiries }: { mixedExpiries: boolean }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
      <span className="rounded-md bg-primary/12 px-3 py-1 font-medium text-primary">
        {mixedExpiries ? "Expiry scenario" : "At Expiry"}
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
  const [tab, setTab] = useState<"live" | "builder">("live");
  const underlyings = usePayoffCurves();
  const [selected, setSelected] = useState<CurveRef>();
  const [builderPrefill, setBuilderPrefill] = useState<{
    underlying: string;
    legs: PayoffLeg[];
  } | null>(null);

  // Auto-select the first curve once the list arrives, and keep the selection
  // valid: a broker disconnecting can remove the curve currently being viewed.
  useEffect(() => {
    const list = underlyings.data;
    if (!list?.length) return;
    setSelected((cur) => {
      const stillThere = cur && list.some((c) => curveKey(c) === curveKey(cur));
      return stillThere ? cur : list[0];
    });
  }, [underlyings.data]);

  const [holdingChoice, setHoldingChoice] = useState<{ key: string; qty?: number } | null>(null);
  const includeHoldings = !!selected && holdingChoice?.key === curveKey(selected);
  const positionsPayoff = usePayoff(selected);
  const combinedPayoff = usePayoff(includeHoldings ? selected : undefined, true, holdingChoice?.qty);
  const payoff = includeHoldings ? combinedPayoff : positionsPayoff;
  const data = payoff.isError ? undefined : payoff.data;
  const holding = holdingView(includeHoldings, positionsPayoff.data?.holding, data?.holding);
  const p = data?.payoff;
  const mixedExpiries = (data?.expiries.length ?? 0) > 1;

  const handleOpenInBuilder = () => {
    if (selected && data?.legs) {
      setBuilderPrefill({
        underlying: selected.underlying,
        legs: data.legs,
      });
      setTab("builder");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Option Payoff & Strategy Builder"
          description={
            tab === "live"
              ? "Expiry payoff curves for your positions, with optional stock holdings from the same account."
              : "Design, simulate, and calculate margin for custom multi-leg options strategies."
          }
        />

        {/* View Mode Tabs */}
        <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTab("live")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3.5 py-1.5 font-medium transition-colors",
              tab === "live"
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpen className="size-4" />
            Live Positions
          </button>
          <button
            type="button"
            onClick={() => setTab("builder")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3.5 py-1.5 font-medium transition-colors",
              tab === "builder"
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Wrench className="size-4" />
            Strategy Builder
          </button>
        </div>
      </div>

      {tab === "builder" ? (
        <StrategyBuilderView
          initialUnderlying={builderPrefill?.underlying}
          initialLegs={builderPrefill?.legs}
          onBackToLive={() => setTab("live")}
        />
      ) : (
        <>
          {underlyings.data && underlyings.data.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/60 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Held Curves:
                </span>
                <CurveSelector
                  curves={underlyings.data}
                  selected={selected}
                  onSelect={setSelected}
                />
              </div>

              {data?.legs && data.legs.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInBuilder}
                  className="text-xs font-medium"
                >
                  <Wrench className="mr-1.5 size-3.5 text-primary" />
                  Open in Strategy Builder
                </Button>
              )}
            </div>
          )}

          {selected && (
            <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" checked={includeHoldings}
                  disabled={!includeHoldings && (!holding?.availableQty || !!holding.warning)}
                  onChange={(e) => setHoldingChoice(e.target.checked ? { key: curveKey(selected) } : null)} />
                Include holdings
              </label>
              {holding?.warning ? (
                <p role="status">{holding.warning} <button className="underline" onClick={() => positionsPayoff.refetch()}>Retry</button></p>
              ) : holding?.availableQty ? (
                <p className="text-muted-foreground">{holding.availableQty} shares available · Average cost {formatINRWhole(holding.avgCost)} · Same account</p>
              ) : <p className="text-muted-foreground">{positionsPayoff.isLoading ? "Checking holdings…" : positionsPayoff.isError ? "Could not check holdings. Retry loading the payoff." : "No matching holdings available."}</p>}
              {includeHoldings && holding && (
                <>
                  <label className="flex items-center gap-2">Shares to include
                    <input type="number" min={1} max={holding.availableQty} step={1}
                      value={holdingChoice?.qty ?? (data && includeHoldings ? holding.includedQty : holding.availableQty)}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        if (Number.isInteger(qty) && qty >= 1 && qty <= holding.availableQty)
                          setHoldingChoice({ key: curveKey(selected), qty });
                      }} className="w-24 rounded border border-border bg-background px-2 py-1" />
                  </label>
                  <p className="text-xs text-muted-foreground">Combined P&amp;L uses purchase cost and assumes these shares remain held until expiry. Pledged shares are included once; this graph does not determine delivery eligibility or margin benefit.</p>
                  {combinedPayoff.isError && <p role="alert" className="text-loss">Could not include holdings. Check the available quantity and retry, or turn off holdings.</p>}
                </>
              )}
            </div>
          )}

          {/* Underlyings list failed */}
          {underlyings.isError && (
            <Card>
              <CardContent className="p-0">
                <ErrorState
                  title="Couldn't load payoff curves"
                  onRetry={() => underlyings.refetch()}
                />
              </CardContent>
            </Card>
          )}

          {/* No positions to plot */}
          {underlyings.data && underlyings.data.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center space-y-4">
                <EmptyState
                  icon={<Inbox />}
                  title="No open F&O positions in connected accounts."
                  description="You don't have open options positions right now. You can use the Strategy Builder to design and simulate hypothetical trades."
                />
                <Button
                  onClick={() => setTab("builder")}
                  className="gap-2"
                >
                  <Wrench className="size-4" />
                  Launch Strategy Builder
                </Button>
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
          {mixedExpiries && data && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm" role="note">
              <p className="font-medium">These positions have different expiries</p>
              <p className="mt-1 text-muted-foreground">
                {data.expiries.map((expiry) => new Date(`${expiry}T00:00:00`).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })).join(" / ")}. This curve assumes the same underlying price at each expiry.
                It does not value later contracts at the first expiry, so the scenario loss is not a guaranteed cap across these dates.
              </p>
            </div>
          )}
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {/*
              "—" rather than ₹0 when no broker can quote spot. Kite's market
              data is a paid add-on and Alice Blue has no in-hours quote
              endpoint, so this is blank unless Paytm is connected.
            */}
            <StatCard
              label="Current spot"
              icon={<Crosshair />}
              loading={payoff.isLoading}
              value={data && data.spot > 0 ? formatINRWhole(data.spot) : "—"}
            />
            <StatCard
              label={mixedExpiries ? "Scenario max profit" : "Max profit"}
              icon={<TrendingUp />}
              loading={payoff.isLoading}
              valueClassName="text-profit"
              value={p?.unboundedProfit ? "Unlimited" : p ? formatINRWhole(p.maxProfit) : "—"}
            />
            <StatCard
              label={mixedExpiries ? "Scenario max loss" : "Max loss"}
              icon={<TrendingDown />}
              loading={payoff.isLoading}
              valueClassName="text-loss"
              value={p?.unboundedLoss ? "Unlimited" : p ? formatINRWhole(p.maxLoss) : "—"}
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
              <CardTitle className="text-base">
                {mixedExpiries ? "Combined expiry scenario" : "Payoff at expiry"}
              </CardTitle>
              <ModeToggle mixedExpiries={mixedExpiries} />
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
                  <PayoffChart key={`${data.connectionId}:${data.underlying}`} payoff={p} spot={data.spot} legs={data.legs} isIndex={data.isIndex} />
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
      </>
      )}
    </div>
  );
}
