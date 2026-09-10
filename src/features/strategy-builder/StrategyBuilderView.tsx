import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, RotateCcw, ShieldCheck, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { PayoffChart } from "@/features/payoff/PayoffChart";
import { useStrategyMetadata } from "@/features/payoff/hooks";
import { api, ApiError } from "@/lib/api";
import { formatINR, formatINRWhole, formatSignedINR } from "@/lib/format";
import type {
  OptionChainRow,
  PayoffComparisonResponse,
  PayoffResponse,
  ScenarioLeg,
  UnderlyingSearchItem,
} from "@/types/api";
import { OptionChainPicker } from "./OptionChainPicker";
import { StrategyLegEditor } from "./StrategyLegEditor";
import { UnderlyingSearch } from "./UnderlyingSearch";
import { useOptionChain, useOptionExpiries, useOptionSources } from "./hooks";
import {
  applyRecipe,
  baselineFromPayoff,
  changeDraftContract,
  chartLeg,
  closeDraft,
  draftFromChain,
  draftKey,
  useLatestPrice,
  validDraft,
  withManualPrice,
} from "./scenarioState";
import { legPnlAtSpot } from "./payoffMath";

interface StrategyBuilderProps {
  initialBaseline?: PayoffResponse | null;
  onBackToLive?: () => void;
  active?: boolean;
}

interface DraftContext {
  selection: UnderlyingSearchItem;
  baseline: ScenarioLeg[];
  baselineResponse: PayoffResponse | null;
  positionConnectionId: string | null;
  drafts: ScenarioLeg[];
}

export function StrategyBuilderView({ initialBaseline, onBackToLive, active = true }: StrategyBuilderProps) {
  const metadata = useStrategyMetadata();
  const [contexts, setContexts] = useState<Record<string, DraftContext>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [sourceConnectionId, setSourceConnectionId] = useState("");
  const [pickerExpiry, setPickerExpiry] = useState("");
  const [strikeCount, setStrikeCount] = useState(10);
  const [comparison, setComparison] = useState<PayoffComparisonResponse | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [targetSpot, setTargetSpot] = useState<number | null>(null);
  const [recipeMessage, setRecipeMessage] = useState<string | null>(null);
  const revision = useRef(0);
  const importedRevision = useRef<string | null>(null);

  const context = activeKey ? contexts[activeKey] : undefined;
  const selection = context?.selection ?? null;
  const baseline = context?.baseline ?? [];
  const drafts = context?.drafts ?? [];
  const positionConnectionId = context?.positionConnectionId ?? null;

  useEffect(() => {
    if (!initialBaseline) return;
    const importId = `${initialBaseline.connectionId}:${initialBaseline.underlying}:${initialBaseline.retrievedAt}`;
    if (importedRevision.current === importId) return;
    importedRevision.current = importId;
    const key = draftKey(initialBaseline.underlying, initialBaseline.connectionId);
    const importedSelection: UnderlyingSearchItem = {
      code: initialBaseline.underlying,
      symbol: initialBaseline.underlying,
      name: initialBaseline.underlying,
      exchange: initialBaseline.legs[0]?.exchange ?? "NSE",
      isIndex: initialBaseline.isIndex,
      hasOptions: true,
      aliases: [],
    };
    setContexts((current) => ({
      ...current,
      [key]: {
        selection: importedSelection,
        baseline: baselineFromPayoff(initialBaseline),
        baselineResponse: initialBaseline,
        positionConnectionId: initialBaseline.connectionId,
        drafts: current[key]?.drafts ?? [],
      },
    }));
    setActiveKey(key);
  }, [initialBaseline]);

  const sources = useOptionSources(selection?.hasOptions === false ? undefined : selection?.code,
    selection?.exchange, positionConnectionId);
  const availableSources = sources.data?.sources.filter((source) => source.available) ?? [];

  useEffect(() => {
    if (!availableSources.length) { setSourceConnectionId(""); return; }
    setSourceConnectionId((current) => availableSources.some((source) => source.connectionId === current)
      ? current : availableSources[0].connectionId);
  }, [activeKey, sources.data]);

  const expiries = useOptionExpiries(selection?.code, selection?.exchange, sourceConnectionId || undefined);
  useEffect(() => {
    const values = expiries.data?.expiries ?? [];
    if (!values.length) { setPickerExpiry(""); return; }
    setPickerExpiry((current) => values.includes(current) ? current : values[0]);
  }, [activeKey, expiries.data]);

  const chain = useOptionChain(selection?.code, pickerExpiry, selection?.exchange,
    sourceConnectionId || undefined, positionConnectionId, active, strikeCount);
  const spot = context?.baselineResponse?.spot && context.baselineResponse.spot > 0
    ? context.baselineResponse.spot : chain.data?.spot ?? null;

  const updateDrafts = useCallback((change: (current: ScenarioLeg[]) => ScenarioLeg[]) => {
    if (!activeKey) return;
    setContexts((current) => ({
      ...current,
      [activeKey]: { ...current[activeKey], drafts: change(current[activeKey].drafts) },
    }));
  }, [activeKey]);

  const updateDraft = useCallback((id: string, change: (leg: ScenarioLeg) => ScenarioLeg) => {
    updateDrafts((current) => current.map((leg) => leg.id === id ? change(leg) : leg));
  }, [updateDrafts]);

  useEffect(() => {
    if (!selection || baseline.length + drafts.length === 0) {
      setComparison(null);
      setCompareError(null);
      return;
    }
    if (drafts.some((leg) => !validDraft(leg))) {
      setCompareError("Complete every enabled draft leg before recalculating.");
      return;
    }
    const controller = new AbortController();
    const requestRevision = ++revision.current;
    const timer = window.setTimeout(() => {
      setIsComparing(true);
      setCompareError(null);
      api.comparePayoff({
        revision: requestRevision,
        context: {
          underlying: selection.code,
          exchange: selection.exchange,
          positionConnectionId,
          baselineImportedAt: context?.baselineResponse?.retrievedAt ?? null,
          baselineComplete: context?.baselineResponse?.complete ?? true,
        },
        spot,
        baselineLegs: baseline,
        draftTradeLegs: drafts,
      }, controller.signal).then((result) => {
        if (result.revision === revision.current) setComparison(result);
      }).catch((error) => {
        if (error?.name !== "AbortError") setCompareError(error instanceof ApiError ? error.message : "Could not calculate this scenario.");
      }).finally(() => {
        if (requestRevision === revision.current) setIsComparing(false);
      });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [selection, baseline, drafts, spot, positionConnectionId, context?.baselineResponse]);

  useEffect(() => {
    if (targetSpot === null && spot !== null) setTargetSpot(spot);
  }, [spot, targetSpot]);

  const chooseUnderlying = (item: UnderlyingSearchItem) => {
    const key = draftKey(item.code, null);
    setContexts((current) => current[key] ? current : {
      ...current,
      [key]: { selection: item, baseline: [], baselineResponse: null, positionConnectionId: null, drafts: [] },
    });
    setActiveKey(key);
    setStrikeCount(10);
    setRecipeMessage(null);
    setTargetSpot(null);
  };

  const addFromChain = (row: OptionChainRow, type: "CE" | "PE", direction: "BUY" | "SELL") => {
    if (!chain.data) return;
    const draft = draftFromChain(chain.data, row, type, direction);
    if (draft) updateDrafts((current) => [...current, draft]);
  };

  const setContract = (id: string, row: OptionChainRow, type: "CE" | "PE") => {
    if (!chain.data) return;
    updateDraft(id, (leg) => {
      const replacement = draftFromChain(chain.data!, row, type, leg.qty < 0 ? "SELL" : "BUY", leg.id);
      if (!replacement) return changeDraftContract(leg,
        { strike: row.strike, type, expiry: chain.data!.expiry }, row.lotSize);
      const oldLots = leg.lotSize ? Math.max(1, Math.round(Math.abs(leg.qty) / leg.lotSize)) : 1;
      return { ...replacement, qty: Math.sign(leg.qty) * oldLots * replacement.lotSize!, closesLegId: null };
    });
  };

  const setLegExpiry = async (id: string, expiry: string) => {
    const original = drafts.find((leg) => leg.id === id);
    if (!original || !selection || !sourceConnectionId) return;
    updateDraft(id, (leg) => changeDraftContract(leg, { expiry }, null));
    setPickerExpiry(expiry);
    try {
      const [contracts, nextChain] = await Promise.all([
        api.optionContracts(selection.code, expiry, selection.exchange, sourceConnectionId, positionConnectionId),
        api.optionChain(selection.code, expiry, selection.exchange, sourceConnectionId, positionConnectionId, 50),
      ]);
      const listed = contracts.contracts.find((contract) => contract.key.strike === original.contract.strike
        && contract.key.type === original.contract.type);
      if (!listed) return;
      const row = nextChain.rows.find((candidate) => candidate.strike === original.contract.strike);
      updateDraft(id, (leg) => {
        if (leg.contract.expiry !== expiry) return leg;
        const quote = original.contract.type === "CE" ? row?.call : row?.put;
        return {
          ...leg,
          lotSize: listed.lotSize,
          entryPrice: quote?.priceKnown ? quote.value : null,
          priceBasis: quote?.priceKnown ? "QUOTE_SNAPSHOT" : "MANUAL",
          entryQuote: quote?.priceKnown ? quote : null,
          currentMark: quote?.priceKnown ? quote : null,
        };
      });
    } catch {
      // The cleared manual-price row stays visible; a failed quote never deletes the draft.
    }
  };

  const addRecipe = (id: string) => {
    const template = metadata.data?.templates.find((item) => item.id === id);
    if (!template || !chain.data) return;
    const result = applyRecipe(template, chain.data);
    updateDrafts((current) => [...current, ...result.legs]);
    setRecipeMessage(result.missing ? `${result.missing} recipe leg(s) need a wider or usable quoted chain.` : `${template.label} added from the displayed quote snapshot.`);
  };

  const quantityFor = (row: OptionChainRow, type: "CE" | "PE") => {
    const same = (leg: ScenarioLeg) => leg.contract.expiry === pickerExpiry && leg.contract.strike === row.strike && leg.contract.type === type;
    return {
      existing: baseline.filter(same).reduce((sum, leg) => sum + leg.qty, 0),
      draft: drafts.filter((leg) => leg.enabled && same(leg)).reduce((sum, leg) => sum + leg.qty, 0),
    };
  };

  const enabledCombined = useMemo(() => [...baseline, ...drafts.filter((leg) => leg.enabled && validDraft(leg))], [baseline, drafts]);
  const target = targetSpot ?? spot;
  const targetMetrics = useMemo(() => {
    if (target === null) return null;
    const pnl = (legs: ScenarioLeg[]) => Math.round(100 * legs.reduce((sum, leg) => sum + legPnlAtSpot({
      type: leg.contract.type, strike: leg.contract.strike, price: leg.entryPrice ?? 0, qty: leg.qty,
    }, target), 0)) / 100;
    const existing = pnl(baseline), combinedPnl = pnl(enabledCombined);
    return { existing, combined: combinedPnl, change: combinedPnl - existing };
  }, [target, baseline, enabledCombined]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <UnderlyingSearch selected={selection} onSelect={chooseUnderlying} />
          {selection && <Badge variant="outline">{selection.exchange} · {selection.isIndex ? "Index" : "Stock"}</Badge>}
          <Button variant="outline" onClick={() => { setActiveKey(null); setComparison(null); }}>New strategy</Button>
          {onBackToLive && <Button variant="outline" onClick={onBackToLive}>Back to live</Button>}
        </div>
        {Object.keys(contexts).length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground">Page-session drafts:</span>
            {Object.entries(contexts).map(([key, saved]) => <button key={key} type="button" onClick={() => setActiveKey(key)}
              className={`rounded border px-2 py-1 ${key === activeKey ? "border-primary text-primary" : "border-border"}`}>
              {saved.selection.symbol}{saved.positionConnectionId ? " · positions" : " · new"} ({saved.drafts.length})
            </button>)}
          </div>
        )}
      </div>

      {!selection && <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Search the exchange catalogue to start a strategy, or choose Adjust strategy from a live payoff.</CardContent></Card>}
      {selection?.hasOptions === false && <Card><CardContent className="p-6"><strong>No listed options</strong><p className="mt-1 text-sm text-muted-foreground">{selection.name} remains selectable, but the current catalogue has no listed option contracts.</p></CardContent></Card>}

      {selection && selection.hasOptions !== false && (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
            <label className="text-xs text-muted-foreground">Quote source
              <select value={sourceConnectionId} onChange={(event) => setSourceConnectionId(event.target.value)} className="mt-1 block rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
                {!availableSources.length && <option value="">No usable source</option>}
                {sources.data?.sources.map((source) => <option key={source.connectionId} value={source.connectionId} disabled={!source.available}>
                  {source.brokerId} · {source.accountLabel}{source.policyRestricted ? " (restricted)" : ""}
                </option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Expiry for picker
              <select value={pickerExpiry} onChange={(event) => setPickerExpiry(event.target.value)} className="mt-1 block rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
                {!expiries.data?.expiries.length && <option value="">No expiry available</option>}
                {expiries.data?.expiries.map((expiry) => <option key={expiry} value={expiry}>{expiry}</option>)}
              </select>
            </label>
            <div className="rounded bg-muted/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Spot </span><strong>{spot !== null ? formatINR(spot) : "Unavailable"}</strong>
            </div>
            <Badge variant="outline">Hypothetical · no orders</Badge>
          </div>
          {!availableSources.length && <p role="status" className="text-sm text-amber-600">Option data unavailable. Imported positions and manual assumptions remain available; connect an Alice Blue source for chain quotes.</p>}

          {chain.data || chain.isLoading || chain.error ? (
            <Card><CardContent className="p-4">
              <OptionChainPicker chain={chain.data} isLoading={chain.isLoading || chain.isFetching} error={chain.error}
                onRetry={() => chain.refetch()} onExpand={() => setStrikeCount((value) => Math.min(50, value + 10))}
                onAdd={addFromChain} quantityFor={quantityFor} />
            </CardContent></Card>
          ) : null}

          {chain.data && metadata.data?.templates.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Recipes from actual chain rows:</span>
              {metadata.data.templates.map((template) => <button key={template.id} type="button" title={template.description}
                onClick={() => addRecipe(template.id)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary">{template.label}</button>)}
              {recipeMessage && <span role="status" className="text-xs text-muted-foreground">{recipeMessage}</span>}
            </div>
          ) : null}

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div><CardTitle className="text-base">Positions and adjustments</CardTitle><p className="text-xs text-muted-foreground">Existing rows stay immutable; a close is an opposite hypothetical trade.</p></div>
              <Button variant="outline" size="sm" disabled={!drafts.length} onClick={() => updateDrafts(() => [])}><RotateCcw className="mr-1 size-3.5" /> Reset adjustments</Button>
            </CardHeader>
            <CardContent>
              <StrategyLegEditor baseline={baseline} drafts={drafts} expiries={expiries.data?.expiries ?? []} chain={chain.data}
                onToggle={(id) => updateDraft(id, (leg) => ({ ...leg, enabled: !leg.enabled }))}
                onRemove={(id) => updateDrafts((current) => current.filter((leg) => leg.id !== id))}
                onDirection={(id) => updateDraft(id, (leg) => ({ ...leg, qty: -leg.qty, closesLegId: null }))}
                onLots={(id, lots) => updateDraft(id, (leg) => ({ ...leg, qty: Math.sign(leg.qty) * lots * (leg.lotSize ?? 1), closesLegId: null }))}
                onPrice={(id, price) => updateDraft(id, (leg) => withManualPrice(leg, price))}
                onLatest={(id) => updateDraft(id, (leg) => useLatestPrice(leg, leg.currentMark))}
                onExpiry={setLegExpiry} onContract={setContract}
                onClose={(leg) => updateDrafts((current) => [...current, closeDraft(leg, leg.currentMark?.value ?? null)])} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-8">
              <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Payoff comparison</CardTitle>{isComparing && <span className="text-xs text-muted-foreground">Updating…</span>}</CardHeader>
              <CardContent>
                {compareError && <p role="alert" className="mb-3 text-sm text-loss">{compareError}</p>}
                {comparison ? <PayoffChart payoff={comparison.combined} spot={comparison.spot ?? 0}
                  legs={enabledCombined.map(chartLeg)} isIndex={selection.isIndex}
                  baseline={baseline.length ? { payoff: comparison.baseline, legs: baseline.map(chartLeg) } : undefined} />
                  : <div className="p-12 text-center text-sm text-muted-foreground">Add a priced option leg to calculate the expiry payoff.</div>}
              </CardContent>
            </Card>
            <div className="space-y-4 lg:col-span-4">
              {comparison && <div className="grid grid-cols-2 gap-3">
                <StatCard label="Max profit" icon={<TrendingUp />} value={comparison.combined.unboundedProfit ? "Unlimited" : formatSignedINR(comparison.combined.maxProfit)} valueClassName="text-profit" />
                <StatCard label="Max loss" icon={<TrendingDown />} value={comparison.combined.unboundedLoss ? "Unlimited" : formatSignedINR(comparison.combined.maxLoss)} valueClassName="text-loss" />
                <StatCard label="Breakevens" icon={<Target />} value={comparison.combined.breakevens.length ? comparison.combined.breakevens.map(formatINRWhole).join(" / ") : "—"} />
                <StatCard label="New premium" icon={<Crosshair />} value={formatSignedINR(comparison.adjustmentCashflow)} />
              </div>}
              {comparison && <Card><CardContent className="space-y-3 p-4 text-sm">
                <label className="block text-xs text-muted-foreground">Target underlying price
                  <input type="number" min={0} step="any" value={target ?? ""} onChange={(event) => setTargetSpot(event.target.value === "" ? null : Number(event.target.value))}
                    className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                {targetMetrics && <div className="space-y-1 rounded bg-muted/40 p-3 tabular-nums">
                  <p>Existing <strong className="float-right">{formatSignedINR(targetMetrics.existing)}</strong></p>
                  <p>After adjustments <strong className="float-right">{formatSignedINR(targetMetrics.combined)}</strong></p>
                  <p>Change <strong className="float-right">{formatSignedINR(targetMetrics.change)}</strong></p>
                </div>}
              </CardContent></Card>}
              {comparison?.margin.status === "AVAILABLE" && comparison.margin.combined && <Card><CardContent className="space-y-2 p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" /> Heuristic margin estimate</p>
                <p>Existing <strong className="float-right">{formatINRWhole(comparison.margin.baseline?.withBenefitMargin ?? 0)}</strong></p>
                <p>After adjustments <strong className="float-right">{formatINRWhole(comparison.margin.combined.withBenefitMargin)}</strong></p>
                <p className="text-xs text-muted-foreground">Uses current known marks; new premium is shown separately.</p>
              </CardContent></Card>}
              {comparison?.margin.status !== "AVAILABLE" && comparison && <p className="text-xs text-muted-foreground">Margin estimate unavailable: {comparison.margin.status.replace(/_/g, " ").toLowerCase()}.</p>}
            </div>
          </div>

          {comparison?.expiries.length && comparison.expiries.length > 1 ? <p role="note" className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm">Expiry scenario: {comparison.expiries.join(" / ")}. A single terminal price is applied to every expiry; later-contract time value is not modelled at the first expiry.</p> : null}
          {comparison?.warnings.map((warning) => <p key={warning} role="status" className="text-xs text-amber-600">{warning}</p>)}
          {comparison?.assumptions.map((assumption) => <p key={assumption} className="text-xs text-muted-foreground">{assumption}</p>)}
        </>
      )}
    </div>
  );
}
