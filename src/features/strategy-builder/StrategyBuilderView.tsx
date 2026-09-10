import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, RotateCcw, ShieldCheck, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { brokerLabel } from "@/components/BrokerBadge";
import { PayoffChart } from "@/features/payoff/PayoffChart";
import { usePayoffCurves, useStrategyMetadata } from "@/features/payoff/hooks";
import { api, ApiError } from "@/lib/api";
import { formatINR, formatINRWhole, formatSignedINR } from "@/lib/format";
import type {
  OptionChainRow,
  CurveRef,
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

const curveKey = (curve: CurveRef) => `${curve.connectionId}:${curve.underlying}`;

export function StrategyBuilderView({ initialBaseline, onBackToLive, active = true }: StrategyBuilderProps) {
  const metadata = useStrategyMetadata();
  const positionCurves = usePayoffCurves();
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
  const [importCurveKey, setImportCurveKey] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const revision = useRef(0);
  const importedRevision = useRef<string | null>(null);

  const context = activeKey ? contexts[activeKey] : undefined;
  const selection = context?.selection ?? null;
  const baseline = context?.baseline ?? [];
  const drafts = context?.drafts ?? [];
  const positionConnectionId = context?.positionConnectionId ?? null;
  const positionCurve = positionCurves.data?.find((curve) =>
    curve.connectionId === positionConnectionId && curve.underlying === selection?.code);

  const importBaseline = useCallback((response: PayoffResponse) => {
    const key = draftKey(response.underlying, response.connectionId);
    const importedSelection: UnderlyingSearchItem = {
      code: response.underlying,
      symbol: response.underlying,
      name: response.underlying,
      exchange: response.legs[0]?.exchange ?? "NSE",
      isIndex: response.isIndex,
      hasOptions: true,
      aliases: [],
    };
    setContexts((current) => ({
      ...current,
      [key]: {
        selection: importedSelection,
        baseline: baselineFromPayoff(response),
        baselineResponse: response,
        positionConnectionId: response.connectionId,
        drafts: current[key]?.drafts ?? [],
      },
    }));
    setActiveKey(key);
    setStrikeCount(10);
    setRecipeMessage(null);
    setTargetSpot(response.spot > 0 ? response.spot : null);
  }, []);

  useEffect(() => {
    if (!initialBaseline) return;
    const importId = `${initialBaseline.connectionId}:${initialBaseline.underlying}:${initialBaseline.retrievedAt}`;
    if (importedRevision.current === importId) return;
    importedRevision.current = importId;
    importBaseline(initialBaseline);
  }, [initialBaseline, importBaseline]);

  useEffect(() => {
    const curves = positionCurves.data ?? [];
    setImportCurveKey((current) => curves.some((curve) => curveKey(curve) === current)
      ? current : curves[0] ? curveKey(curves[0]) : "");
  }, [positionCurves.data]);

  const importExistingPositions = async () => {
    const curve = positionCurves.data?.find((candidate) => curveKey(candidate) === importCurveKey);
    if (!curve) return;
    setIsImporting(true);
    setImportError(null);
    setImportMessage(null);
    try {
      const response = await api.payoff(curve.connectionId, curve.underlying);
      importBaseline(response);
      setImportMessage(`Loaded ${curve.underlyingLabel} positions from ${brokerLabel(curve.brokerId)} · ${curve.accountLabel}. Existing draft adjustments for this account were kept.`);
    } catch (error) {
      setImportError(error instanceof ApiError ? error.message : "Could not load those existing positions.");
    } finally {
      setIsImporting(false);
    }
  };

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
  const showChain = Boolean(chain.data || chain.isLoading || chain.error);

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
    setImportError(null);
    setImportMessage(null);
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
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <label className="min-w-[260px] flex-1 text-xs font-medium text-muted-foreground">
            Add existing positions
            <select value={importCurveKey} disabled={positionCurves.isLoading || isImporting}
              onChange={(event) => setImportCurveKey(event.target.value)}
              className="mt-1 block w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50">
              {!positionCurves.data?.length && <option value="">No open position set available</option>}
              {positionCurves.data?.map((curve) => <option key={curveKey(curve)} value={curveKey(curve)}>
                {curve.underlyingLabel} · {brokerLabel(curve.brokerId)} · {curve.accountLabel}
              </option>)}
            </select>
          </label>
          <Button type="button" variant="outline" disabled={!importCurveKey || isImporting}
            onClick={importExistingPositions}>
            {isImporting ? "Loading positions…" : "Load as baseline"}
          </Button>
          <span className="basis-full text-xs text-muted-foreground">
            Existing units and entry costs stay immutable; adjustments remain hypothetical draft trades.
          </span>
          {positionCurves.isError && <p role="alert" className="basis-full text-xs text-loss">
            Could not list existing positions. <button type="button" className="underline" onClick={() => positionCurves.refetch()}>Retry</button>
          </p>}
          {importError && <p role="alert" className="basis-full text-xs text-loss">{importError}</p>}
          {importMessage && <p role="status" className="basis-full text-xs text-muted-foreground">{importMessage}</p>}
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

      {!selection && <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Search the exchange catalogue to start a strategy, or load existing positions above.</CardContent></Card>}
      {selection?.hasOptions === false && <Card><CardContent className="p-6"><strong>No listed options</strong><p className="mt-1 text-sm text-muted-foreground">{selection.name} remains selectable, but the current catalogue has no listed option contracts.</p></CardContent></Card>}

      {selection && selection.hasOptions !== false && (
        <>
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
            <label className="text-xs text-muted-foreground">Market data source
              <select value={sourceConnectionId} onChange={(event) => setSourceConnectionId(event.target.value)} className="mt-1 block rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
                {!availableSources.length && <option value="">No usable source</option>}
                {sources.data?.sources.map((source) => <option key={source.connectionId} value={source.connectionId} disabled={!source.available}>
                  {brokerLabel(source.brokerId)} · {source.accountLabel}{source.policyRestricted ? " (restricted)" : ""}
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
            {context?.baselineResponse && <Badge variant="outline">
              Positions · {brokerLabel(context.baselineResponse.brokerId)}
              {positionCurve ? ` · ${positionCurve.accountLabel}` : ""}
            </Badge>}
            <Badge variant="outline">Hypothetical · no orders</Badge>
            <p className="basis-full text-xs text-muted-foreground">
              Option-chain quotes may come from a different connected broker. Existing positions and margin remain tied to their original account.
            </p>
          </div>
          {!availableSources.length && <p role="status" className="text-sm text-amber-600">Option data unavailable. Connect a market-data-capable broker (currently Alice Blue) for chain quotes.</p>}

          {/* Chain and payoff sit side by side: the graph has to answer while
              legs are being picked, not two full-width cards further down. */}
          <div className={showChain ? "grid gap-4 xl:grid-cols-12" : "space-y-4"}>
            {showChain && (
              <Card className="xl:col-span-5">
                <CardContent className="space-y-3 p-4">
                  <OptionChainPicker chain={chain.data} isLoading={chain.isLoading || chain.isFetching} error={chain.error}
                    onRetry={() => chain.refetch()} onExpand={() => setStrikeCount((value) => Math.min(50, value + 10))}
                    onAdd={addFromChain} quantityFor={quantityFor} />
                  {chain.data && metadata.data?.templates.length ? (
                    <div className="border-t border-border pt-3">
                      <p className="text-xs text-muted-foreground">Recipes from actual chain rows</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {metadata.data.templates.map((template) => <button key={template.id} type="button" title={template.description}
                          onClick={() => addRecipe(template.id)} className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary hover:text-primary">{template.label}</button>)}
                      </div>
                      {recipeMessage && <p role="status" className="mt-2 text-xs text-muted-foreground">{recipeMessage}</p>}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            <div className={showChain ? "space-y-4 xl:col-span-7" : "space-y-4"}>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Payoff comparison</CardTitle>{isComparing && <span className="text-xs text-muted-foreground">Updating…</span>}</CardHeader>
                <CardContent>
                  {compareError && <p role="alert" className="mb-3 text-sm text-loss">{compareError}</p>}
                  {comparison ? <PayoffChart payoff={comparison.combined} spot={comparison.spot ?? 0}
                    legs={enabledCombined.map(chartLeg)} isIndex={selection.isIndex}
                    baseline={baseline.length ? { payoff: comparison.baseline, legs: baseline.map(chartLeg) } : undefined} />
                    : <div className="p-12 text-center text-sm text-muted-foreground">Add a priced option leg to calculate the expiry payoff.</div>}
                </CardContent>
              </Card>

              {comparison && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Max profit" icon={<TrendingUp />} value={comparison.combined.unboundedProfit ? "Unlimited" : formatSignedINR(comparison.combined.maxProfit)} valueClassName="text-profit" />
                <StatCard label="Max loss" icon={<TrendingDown />} value={comparison.combined.unboundedLoss ? "Unlimited" : formatSignedINR(comparison.combined.maxLoss)} valueClassName="text-loss" />
                <StatCard label="Breakevens" icon={<Target />} value={comparison.combined.breakevens.length ? comparison.combined.breakevens.map(formatINRWhole).join(" / ") : "—"} />
                <StatCard label="New premium" icon={<Crosshair />} value={formatSignedINR(comparison.adjustmentCashflow)} />
              </div>}

              {comparison && <div className="grid gap-3 sm:grid-cols-2">
                <Card><CardContent className="space-y-3 p-4 text-sm">
                  <label className="block text-xs text-muted-foreground">Target underlying price
                    <input type="number" min={0} step="any" value={target ?? ""} onChange={(event) => setTargetSpot(event.target.value === "" ? null : Number(event.target.value))}
                      className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </label>
                  {targetMetrics && <div className="space-y-1 rounded bg-muted/40 p-3 tabular-nums">
                    <p>Existing <strong className="float-right">{formatSignedINR(targetMetrics.existing)}</strong></p>
                    <p>After adjustments <strong className="float-right">{formatSignedINR(targetMetrics.combined)}</strong></p>
                    <p>Change <strong className="float-right">{formatSignedINR(targetMetrics.change)}</strong></p>
                  </div>}
                </CardContent></Card>
                <Card><CardContent className="space-y-2 p-4 text-sm">
                  <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-primary" /> Heuristic margin estimate</p>
                  {comparison.margin.status === "AVAILABLE" && comparison.margin.combined ? <>
                    <p>Existing <strong className="float-right">{formatINRWhole(comparison.margin.baseline?.withBenefitMargin ?? 0)}</strong></p>
                    <p>After adjustments <strong className="float-right">{formatINRWhole(comparison.margin.combined.withBenefitMargin)}</strong></p>
                    <p className="text-xs text-muted-foreground">Uses current known marks; new premium is shown separately.</p>
                  </> : <p className="text-xs text-muted-foreground">Unavailable: {comparison.margin.status.replace(/_/g, " ").toLowerCase()}.</p>}
                </CardContent></Card>
              </div>}
            </div>
          </div>

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
                onClose={(leg) => updateDrafts((current) => {
                  // Only what is still open: closing twice would otherwise
                  // propose a long position the user never held.
                  const closing = current
                    .filter((draft) => draft.enabled && draft.closesLegId === leg.id)
                    .reduce((sum, draft) => sum + Math.abs(draft.qty), 0);
                  const remaining = Math.abs(leg.qty) - closing;
                  if (remaining <= 0) return current;
                  return [...current, closeDraft(leg, leg.currentMark?.value ?? null, remaining)];
                })} />
            </CardContent>
          </Card>

          {comparison?.expiries.length && comparison.expiries.length > 1 ? <p role="note" className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm">Expiry scenario: {comparison.expiries.join(" / ")}. A single terminal price is applied to every expiry; later-contract time value is not modelled at the first expiry.</p> : null}
          {comparison?.warnings.map((warning) => <p key={warning} role="status" className="text-xs text-amber-600">{warning}</p>)}
          {comparison?.assumptions.map((assumption) => <p key={assumption} className="text-xs text-muted-foreground">{assumption}</p>)}
        </>
      )}
    </div>
  );
}
