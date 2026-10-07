import { useEffect, useMemo, useState } from "react";
import { Inbox, Info, SlidersHorizontal, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import { BrokerSessionBanner } from "@/features/session/BrokerSessionBanner";
import { PayoffChart } from "@/features/payoff/PayoffChart";
import { LegsRail } from "@/features/payoff/LegsRail";
import { HoldingsToggle } from "@/features/payoff/HoldingsToggle";
import { CurveSelector } from "@/features/payoff/CurveSelector";
import { PositionFigures, type FigureSet } from "@/features/payoff/PositionFigures";
import { expiryLabel } from "@/features/payoff/expiry";
import { curveKey, resolveSelectedCurve } from "@/features/payoff/curveSelection";
import { holdingView } from "@/features/payoff/holdingView";
import { openPnl, pruneExcluded, selectedLegs, toggleLeg } from "@/features/payoff/legSelection";
import { useLegScenario, usePayoff, usePayoffCurves } from "@/features/payoff/hooks";
import { useBuilderHost } from "@/features/strategy-builder/builderHost";
import { brokerLabel } from "@/components/BrokerBadge";
import { brokerIdOf, isBrokerSessionError } from "@/lib/api";
import type { CurveRef } from "@/types/api";

export function PayoffPage() {
  const underlyings = usePayoffCurves();
  const { openInBuilder } = useBuilderHost();
  const [selected, setSelected] = useState<CurveRef>();
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
  const mixedExpiries = (data?.expiries.length ?? 0) > 1;

  // Unticked legs (a what-if). Cleared whenever the curve or the holdings choice changes, so the
  // page never opens on a what-if; kept across the 30-second refresh while the same legs return.
  const viewKey = activeCurve ? `${curveKey(activeCurve)}|${includeHoldings}` : "";
  const [excludedState, setExcludedState] = useState<{ view: string; keys: Set<string> }>({ view: "", keys: new Set() });
  const excluded = useMemo(() => {
    if (excludedState.view !== viewKey || !data) return new Set<string>();
    return pruneExcluded(excludedState.keys, data.legs);
  }, [excludedState, viewKey, data]);
  const legs = useMemo(() => (data ? selectedLegs(data.legs, excluded) : []), [data, excluded]);
  const whatIf = !!data && excluded.size > 0;

  // Margin needs the compare endpoint for the real position too; the what-if query runs only
  // while legs are unticked.
  const realScenario = useLegScenario(data, data?.legs ?? []);
  const whatIfScenario = useLegScenario(data, legs, whatIf);

  const real: FigureSet | undefined = data && {
    openPnl: openPnl(data.legs),
    payoff: data.payoff,
    margin: realScenario.isError ? { status: "UNAVAILABLE_MARKS", baseline: null, combined: null } : realScenario.data?.margin,
  };
  const shown: FigureSet | undefined = !data ? undefined : !whatIf ? real : {
    openPnl: openPnl(legs),
    payoff: whatIfScenario.data?.baseline,
    margin: whatIfScenario.isError ? { status: "UNAVAILABLE_MARKS", baseline: null, combined: null } : whatIfScenario.data?.margin,
  };
  // The what-if curve draws from the ticked legs at once; its breakevens and limits wait for the
  // server so they never belong to a different selection.
  const chartPayoff = !data ? undefined : !whatIf ? data.payoff
    : whatIfScenario.data?.baseline ?? { ...data.payoff, breakevens: [] };

  const onToggle = (key: string) => {
    if (!data) return;
    setExcludedState({ view: viewKey, keys: toggleLeg(excluded, key, data.legs) });
  };
  const showAll = () => setExcludedState({ view: viewKey, keys: new Set() });
  const handleOpenInBuilder = () => {
    if (activeCurve && data && legs.length) openInBuilder({ ...data, legs });
  };

  return <div className="payoff-page payoff-fit">
    <h1 className="sr-only">Payoff</h1>
    {underlyings.isError && <div className="payoff-panel"><ErrorState title="Couldn't load payoff curves" onRetry={() => { void underlyings.refetch(); }} /></div>}
    {underlyings.data?.length === 0 && <div className="payoff-panel p-6 text-center">
      <EmptyState icon={<Inbox />} title="No open F&O positions in connected accounts." description="Use Strategy builder to design and simulate hypothetical trades." />
      <Button asChild><Link to="/app/builder"><Wrench className="size-4" />Open Strategy builder</Link></Button>
    </div>}
    {underlyings.isLoading && <Skeleton className="h-14 w-full" />}

    {!!underlyings.data?.length && <div className="payoff-toolbar">
      <div className="payoff-curve-control">
        <CurveSelector curves={underlyings.data} selected={activeCurve} onSelect={setSelected} />
        {activeCurve && <HoldingsToggle holding={holding} included={includeHoldings} qty={holdingChoice?.qty} loading={positionsPayoff.isLoading} errored={positionsPayoff.isError}
          onToggle={(on) => setHoldingChoice(on ? { key: curveKey(activeCurve) } : null)}
          onQty={(qty) => setHoldingChoice({ key: curveKey(activeCurve), qty })} onRetry={() => { void positionsPayoff.refetch(); }} />}
      </div>
      <Button variant="outline" onClick={handleOpenInBuilder} disabled={!activeCurve || !legs.length} className="payoff-adjust-button"
        title={whatIf ? "Opens the builder with the ticked legs only" : undefined}>
        <SlidersHorizontal className="size-5" />Adjust strategy
      </Button>
    </div>}

    {activeCurve && isBrokerSessionError(payoff.error) && <BrokerSessionBanner brokerId={brokerIdOf(payoff.error)} />}
    {activeCurve && !isBrokerSessionError(payoff.error) && <>
      {whatIf && <div className="payoff-whatif" role="status">
        <span><b>What-if:</b> showing {legs.length} of {data!.legs.length} legs. This is not your real position.</span>
        <button type="button" className="payoff-link" onClick={showAll}>Show all legs</button>
      </div>}
      {data && (mixedExpiries || !data.complete || data.warnings.length > 0) && <details className="payoff-warning">
        <summary>
          {[mixedExpiries && "These legs have different expiries", !data.complete && "Some positions could not be included; this payoff is incomplete",
            data.warnings.length > 0 && `${data.warnings.length} warning${data.warnings.length > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
          <span className="payoff-link"> Details</span>
        </summary>
        {mixedExpiries && <p>{data.expiries.map(expiryLabel).join(" / ")}. This curve assumes the same underlying price at each expiry. It does not value later contracts at the first expiry, so the scenario loss is not a guaranteed cap across these dates.</p>}
        {data.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
      </details>}
      <div className="payoff-live-grid">
        <section className="payoff-panel payoff-chart-panel" aria-labelledby="live-payoff-title">
          <div className="payoff-chart-header">
            <div className="payoff-chart-title">
              <h2 id="live-payoff-title">{mixedExpiries ? "Combined expiry scenario" : "Payoff at expiry"}</h2>
              {data && <span>{data.expiries.map(expiryLabel).join(" / ")}{whatIf ? ` · ${legs.length} of ${data.legs.length} legs` : ""}</span>}
            </div>
            {shown ? <PositionFigures shown={shown} real={whatIf ? real : undefined} mixedExpiries={mixedExpiries} />
              : payoff.isLoading ? <Skeleton className="h-10 w-72" /> : null}
          </div>
          {payoff.isLoading ? <Skeleton className="m-4 h-[26.875rem]" />
            : payoff.isError ? <ErrorState title={includeHoldings ? "Couldn't include holdings in payoff" : "Couldn't load payoff"} description={includeHoldings ? "Check the share quantity and retry, or turn off Holdings to view positions only." : undefined} onRetry={() => { void payoff.refetch(); }} />
            : chartPayoff && data ? <PayoffChart variant="live" key={viewKey} payoff={chartPayoff} spot={data.spot} legs={legs} isIndex={data.isIndex}
                baseline={whatIf ? { payoff: data.payoff, legs: data.legs } : undefined}
                labels={{ baseline: "Your real position", current: "Ticked legs" }} /> : null}
          {data && <div className="payoff-chart-notes">
            {includeHoldings && <p className="flex items-start gap-2"><Info className="mt-0.5 size-4 shrink-0" /><span>Includes {data.holding.includedQty} {activeCurve.underlyingLabel} shares at purchase cost, assumed held until expiry; pledged shares are counted once. This graph does not determine delivery eligibility or margin benefit.</span></p>}
            {chartPayoff?.unboundedLoss && <p className="text-loss">Loss is unlimited beyond the plotted range.</p>}
            {chartPayoff?.unboundedProfit && <p>Profit continues beyond the plotted range.</p>}
            {whatIfScenario.isError && whatIf && <p className="text-loss">Couldn't recalculate the what-if limits and margin. The curve is drawn from the ticked legs.</p>}
          </div>}
        </section>
        <section className="payoff-panel payoff-legs-panel" aria-label={`Legs, ${brokerLabel(activeCurve.brokerId)} · ${activeCurve.accountLabel}`}>
          {payoff.isLoading ? <div className="space-y-4 p-5"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
            : payoff.isError ? <p className="p-5 text-sm text-muted-foreground">Legs are unavailable until this payoff loads.</p>
            : data?.legs.length ? <LegsRail legs={data.legs} excluded={excluded} onToggle={onToggle} onShowAll={showAll} showExpiry={mixedExpiries} />
            : <EmptyState icon={<Inbox />} title="No legs" description="This underlying has no plottable legs." />}
        </section>
      </div>
    </>}
  </div>;
}
