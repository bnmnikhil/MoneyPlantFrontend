import { useEffect, useState } from "react";
import { Inbox, Info, SlidersHorizontal, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import { BrokerSessionBanner } from "@/features/session/BrokerSessionBanner";
import { PayoffChart } from "@/features/payoff/PayoffChart";
import { LegsTable } from "@/features/payoff/LegsTable";
import { HoldingsToggle } from "@/features/payoff/HoldingsToggle";
import { CurveSelector } from "@/features/payoff/CurveSelector";
import { PayoffSummary, expiryLabel } from "@/features/payoff/PayoffSummary";
import { curveKey, resolveSelectedCurve } from "@/features/payoff/curveSelection";
import { holdingView } from "@/features/payoff/holdingView";
import { StrategyBuilderView } from "@/features/strategy-builder/StrategyBuilderView";
import { usePayoff, usePayoffCurves } from "@/features/payoff/hooks";
import { brokerLabel } from "@/components/BrokerBadge";
import { brokerIdOf, isBrokerSessionError } from "@/lib/api";
import type { CurveRef, PayoffResponse } from "@/types/api";

export function PayoffPage() {
  const [tab, setTab] = useState<"live" | "builder">("live");
  const underlyings = usePayoffCurves();
  const [selected, setSelected] = useState<CurveRef>();
  const [builderPrefill, setBuilderPrefill] = useState<PayoffResponse | null>(null);
  useEffect(() => {
    if (underlyings.data) setSelected((previous) => resolveSelectedCurve(underlyings.data!, previous));
  }, [underlyings.data]);
  // Scope every data request and share choice to a still-present curve. The
  // effect above updates the selector; this guard also handles the render before it.
  const activeCurve = underlyings.data?.find((curve) => selected && curveKey(curve) === curveKey(selected));
  const [holdingChoice, setHoldingChoice] = useState<{ key: string; qty?: number } | null>(null);
  const includeHoldings = !!activeCurve && holdingChoice?.key === curveKey(activeCurve);
  const positionsPayoff = usePayoff(activeCurve);
  const combinedPayoff = usePayoff(includeHoldings ? activeCurve : undefined, true, holdingChoice?.qty);
  const payoff = includeHoldings ? combinedPayoff : positionsPayoff;
  const data = payoff.isError ? undefined : payoff.data;
  const holding = holdingView(includeHoldings, positionsPayoff.data?.holding, data?.holding);
  const p = data?.payoff;
  const mixedExpiries = (data?.expiries.length ?? 0) > 1;
  const handleOpenInBuilder = () => {
    if (activeCurve && data?.legs.length) { setBuilderPrefill(data); setTab("builder"); }
  };
  const positionIndex = underlyings.data?.findIndex((curve) => activeCurve && curveKey(curve) === curveKey(activeCurve)) ?? -1;

  return <div className="payoff-page">
    <h1 className="sr-only">Payoff and strategy builder</h1>
    <div className="payoff-toolbar">
      <div className="payoff-tabs" role="group" aria-label="Payoff view">
        <button type="button" aria-pressed={tab === "live"} onClick={() => setTab("live")}>Live positions</button>
        <button type="button" aria-pressed={tab === "builder"} onClick={() => setTab("builder")}>Strategy builder</button>
      </div>
      {tab === "live" && !!underlyings.data?.length && <>
        <div className="payoff-curve-control">
          <span className="text-sm">Curve</span><CurveSelector curves={underlyings.data} selected={activeCurve} onSelect={setSelected} />
          <span className="whitespace-nowrap text-sm text-muted-foreground">{positionIndex >= 0 ? positionIndex + 1 : "—"} of {underlyings.data.length} curves</span>
        </div>
        <Button variant="outline" onClick={handleOpenInBuilder} disabled={!activeCurve || !data?.legs.length} className="payoff-adjust-button"><SlidersHorizontal className="size-5" />Adjust strategy</Button>
      </>}
      {tab === "builder" && <div className="flex flex-wrap items-center gap-4 text-sm"><span className="font-semibold">Build &amp; test strategy</span><span className="text-muted-foreground">Hypothetical · no orders</span></div>}
    </div>

    {/* Keep the builder mounted so changing views does not discard draft trades. */}
    <div className={tab === "builder" ? "block" : "hidden"}>
      <StrategyBuilderView initialBaseline={builderPrefill} onBackToLive={() => setTab("live")} active={tab === "builder"} />
    </div>
    <div className={tab === "live" ? "payoff-live-view" : "hidden"}>
      {underlyings.isError && <div className="payoff-panel"><ErrorState title="Couldn't load payoff curves" onRetry={() => { void underlyings.refetch(); }} /></div>}
      {underlyings.data?.length === 0 && <div className="payoff-panel p-6 text-center">
        <EmptyState icon={<Inbox />} title="No open F&O positions in connected accounts." description="Use Strategy Builder to design and simulate hypothetical trades." />
        <Button onClick={() => setTab("builder")}><Wrench className="size-4" />Launch Strategy Builder</Button>
      </div>}
      {underlyings.isLoading && <PayoffSummary loading />}
      {activeCurve && isBrokerSessionError(payoff.error) && <BrokerSessionBanner brokerId={brokerIdOf(payoff.error)} />}
      {activeCurve && !isBrokerSessionError(payoff.error) && <>
        <PayoffSummary data={data} loading={payoff.isLoading} />
        {mixedExpiries && data && <div className="payoff-warning" role="note">
          <p className="font-medium">These positions have different expiries</p>
          <p className="mt-1 text-muted-foreground">{data.expiries.map(expiryLabel).join(" / ")}. This curve assumes the same underlying price at each expiry. It does not value later contracts at the first expiry, so the scenario loss is not a guaranteed cap across these dates.</p>
        </div>}
        {data && (!data.complete || data.warnings.length > 0) && <div className="payoff-warning" role="status">
          {!data.complete && <p>Some positions could not be included. This payoff is incomplete.</p>}
          {data.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
        </div>}
        <div className="payoff-live-grid">
          <section className="payoff-panel payoff-chart-panel" aria-labelledby="live-payoff-title">
            <div className="payoff-chart-header">
              <h2 id="live-payoff-title">{mixedExpiries ? "Combined expiry scenario" : "Payoff at expiry"}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <HoldingsToggle holding={holding} included={includeHoldings} qty={holdingChoice?.qty} loading={positionsPayoff.isLoading} errored={positionsPayoff.isError}
                  onToggle={(on) => setHoldingChoice(on ? { key: curveKey(activeCurve) } : null)}
                  onQty={(qty) => setHoldingChoice({ key: curveKey(activeCurve), qty })} onRetry={() => { void positionsPayoff.refetch(); }} />
                <div className="payoff-expiry-mode" aria-label="Payoff timing">
                  <span>{mixedExpiries ? "Expiry scenario" : "At expiry"}</span>
                  <button type="button" disabled title="Intraday curve coming soon">T+0 <span>Soon</span></button>
                </div>
              </div>
            </div>
            {payoff.isLoading ? <Skeleton className="m-4 h-[430px]" />
              : payoff.isError ? <ErrorState title={includeHoldings ? "Couldn't include holdings in payoff" : "Couldn't load payoff"} description={includeHoldings ? "Check the share quantity and retry, or turn off Holdings to view positions only." : undefined} onRetry={() => { void payoff.refetch(); }} />
              : p && data ? <PayoffChart variant="live" key={curveKey(activeCurve)} payoff={p} spot={data.spot} legs={data.legs} isIndex={data.isIndex} /> : null}
            {data && <div className="payoff-chart-notes">
              <p className="flex items-start gap-2"><Info className="mt-0.5 size-4 shrink-0" /><span>{includeHoldings ? `Includes ${data.holding.includedQty} ${activeCurve.underlyingLabel} shares at purchase cost. ` : ""}Zoom changes the view only.</span></p>
              {includeHoldings && <p>Shares are assumed held until expiry; pledged shares are counted once. This graph does not determine delivery eligibility or margin benefit.</p>}
              {p?.unboundedLoss && <p className="text-loss">Loss is unlimited beyond the plotted range.</p>}
              {p?.unboundedProfit && <p>Profit continues beyond the plotted range.</p>}
            </div>}
          </section>
          <section className="payoff-panel payoff-legs-panel" aria-labelledby="live-legs-title">
            <div className="payoff-legs-header"><h2 id="live-legs-title">Position legs</h2><p>{brokerLabel(activeCurve.brokerId)} · {activeCurve.accountLabel}</p></div>
            {payoff.isLoading ? <div className="space-y-4 p-5"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
              : payoff.isError ? <p className="p-5 text-sm text-muted-foreground">Legs are unavailable until this payoff loads.</p>
              : data?.legs.length ? <LegsTable legs={data.legs} /> : <EmptyState icon={<Inbox />} title="No legs" description="This underlying has no plottable legs." />}
            {data && <p className="payoff-legs-footer">{data.legs.length} legs · scroll for all</p>}
          </section>
        </div>
      </>}
    </div>
  </div>;
}
