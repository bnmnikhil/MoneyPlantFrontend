import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brokerLabel } from "@/components/BrokerBadge";
import { PayoffChart } from "@/features/payoff/PayoffChart";
import { usePayoffCurves, useStrategyMetadata } from "@/features/payoff/hooks";
import { api, ApiError } from "@/lib/api";
import { formatINR, formatSignedINR } from "@/lib/format";
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
import { BuilderMargin, BuilderMetrics, TargetInspector } from "./BuilderMetrics";
import { CustomLegForm } from "./CustomLegForm";
import { draftCashflow } from "./legFigures";
import { expiryLabel } from "@/features/payoff/PayoffSummary";

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
  const [comparisonSnapshot, setComparisonSnapshot] = useState<{ inputKey: string; result: PayoffComparisonResponse } | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [targetSpot, setTargetSpot] = useState<number | null>(null);
  const [recipeMessage, setRecipeMessage] = useState<string | null>(null);
  const [importCurveKey, setImportCurveKey] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
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
      setImportOpen(false);
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
  // Never pair a prior account/draft result with the currently displayed legs.
  const comparisonInputKey = JSON.stringify([selection, baseline, drafts, spot, positionConnectionId, context?.baselineResponse]);
  const comparison = comparisonSnapshot?.inputKey === comparisonInputKey ? comparisonSnapshot.result : null;

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
    const requestRevision = ++revision.current;
    if (!selection || baseline.length + drafts.length === 0) {
      setComparisonSnapshot(null);
      setCompareError(null);
      setIsComparing(false);
      return;
    }
    if (drafts.some((leg) => !validDraft(leg))) {
      setCompareError("Complete every enabled draft leg before recalculating.");
      setIsComparing(false);
      return;
    }
    const controller = new AbortController();
    setIsComparing(true);
    setCompareError(null);
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
        if (!controller.signal.aborted && result.revision === revision.current) setComparisonSnapshot({ inputKey: comparisonInputKey, result });
      }).catch((error) => {
        if (!controller.signal.aborted && requestRevision === revision.current && error?.name !== "AbortError") setCompareError(error instanceof ApiError ? error.message : "Could not calculate this scenario.");
      }).finally(() => {
        if (!controller.signal.aborted && requestRevision === revision.current) setIsComparing(false);
      });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [comparisonInputKey]);

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

  const account = context?.baselineResponse ? `${brokerLabel(context.baselineResponse.brokerId)} · ${positionCurve?.accountLabel ?? "Imported account"}` : undefined;
  const netCashflow = draftCashflow(drafts);
  return <div className="builder-workspace">
    <section className="builder-panel builder-context" aria-label="Strategy context">
      <div className="builder-context-fields">
        <UnderlyingSearch selected={selection} onSelect={chooseUnderlying} />
        <div className="builder-baseline-context"><p>Existing positions (baseline)</p><div><span title={account}>{account ? `${account} · ${baseline.length} positions` : "No baseline"}</span><button type="button" className="builder-small-button" aria-expanded={importOpen} onClick={() => setImportOpen(!importOpen)}>{account ? "Change" : "Add existing"}</button></div></div>
        <label>Quotes source (market data)<select value={sourceConnectionId} disabled={!availableSources.length} onChange={(event) => setSourceConnectionId(event.target.value)}>
          {!availableSources.length && <option value="">No usable source</option>}
          {sources.data?.sources.map((source) => <option key={source.connectionId} value={source.connectionId} disabled={!source.available}>{brokerLabel(source.brokerId)} · {source.accountLabel}{source.policyRestricted ? " (restricted)" : ""}</option>)}
        </select></label>
        <label>Expiry<select value={pickerExpiry} disabled={!expiries.data?.expiries.length} onChange={(event) => setPickerExpiry(event.target.value)}>
          {!expiries.data?.expiries.length && <option value="">No expiry available</option>}
          {expiries.data?.expiries.map((expiry) => <option key={expiry} value={expiry}>{expiryLabel(expiry)}</option>)}
        </select></label>
        <div className="builder-spot"><p>Spot</p><strong>{spot !== null && spot > 0 ? formatINR(spot) : "—"}</strong></div>
        <div className="builder-context-actions"><button type="button" className="builder-primary-button" onClick={() => { setActiveKey(null); setComparisonSnapshot(null); setTargetSpot(null); setImportMessage(null); }}>New strategy</button>
          <Button variant="outline" disabled={!drafts.length} onClick={() => updateDrafts(() => [])}><RotateCcw className="size-3.5" />Reset adjustments</Button></div>
      </div>
      <p className="builder-context-note"><Info className="size-3.5 shrink-0" />Quotes may come from another broker; positions and margin{account ? ` remain tied to ${account}` : " stay in their original account"}.</p>
      {importOpen && <div className="builder-import">
        <label>Add existing positions<select value={importCurveKey} disabled={positionCurves.isLoading || isImporting} onChange={(event) => setImportCurveKey(event.target.value)}>
          {!positionCurves.data?.length && <option value="">No open position set available</option>}
          {positionCurves.data?.map((curve) => <option key={curveKey(curve)} value={curveKey(curve)}>{curve.underlyingLabel} · {brokerLabel(curve.brokerId)} · {curve.accountLabel}</option>)}
        </select></label>
        <Button type="button" variant="outline" disabled={!importCurveKey || isImporting} onClick={importExistingPositions}>{isImporting ? "Loading positions…" : "Load as baseline"}</Button>
        <p className="basis-full text-xs text-muted-foreground">Existing units and entry costs stay immutable; adjustments remain hypothetical draft trades.</p>
      </div>}
      {positionCurves.isError && <p role="alert" className="text-xs text-loss">Could not list existing positions. <button type="button" className="underline" onClick={() => positionCurves.refetch()}>Retry</button></p>}
      {importError && <p role="alert" className="text-xs text-loss">{importError}</p>}
      {importMessage && <p role="status" className="text-xs text-muted-foreground">{importMessage}</p>}
      {Object.keys(contexts).length > 0 && <div className="builder-session-drafts"><span>Session drafts:</span>{Object.entries(contexts).map(([key, saved]) => <button key={key} type="button" aria-pressed={key === activeKey} onClick={() => { setActiveKey(key); setTargetSpot(null); }}>
        {saved.selection.symbol}{saved.positionConnectionId ? ` · ${positionCurves.data?.find((curve) => curve.connectionId === saved.positionConnectionId && curve.underlying === saved.selection.code)?.accountLabel ?? "imported positions"}` : " · new"} ({saved.drafts.length})
      </button>)}</div>}
    </section>
    {!selection && <div className="builder-panel builder-empty">Search the exchange catalogue to start a strategy, or add existing positions above.</div>}
    {selection?.hasOptions === false && <div className="builder-panel builder-empty"><strong>No listed options</strong><p>{selection.name} has no listed option contracts in the current catalogue.</p></div>}
    {selection && selection.hasOptions !== false && <>
      {!availableSources.length && <p role="status" className="text-sm text-amber-300">Option data unavailable. Connect a market-data-capable broker for chain quotes.</p>}
      {sources.isError && <p role="alert" className="text-sm text-loss">Could not load quote sources. <button className="underline" onClick={() => sources.refetch()}>Retry</button></p>}
      {expiries.isError && <p role="alert" className="text-sm text-loss">Could not load expiries. <button className="underline" onClick={() => expiries.refetch()}>Retry</button></p>}
      <div className="builder-grid">
        <section className="builder-panel builder-chain-panel">
          <OptionChainPicker chain={chain.data} isLoading={chain.isLoading || chain.isFetching} error={chain.error}
            onRetry={() => chain.refetch()} onExpand={() => setStrikeCount((value) => Math.min(50, value + 10))} canExpand={strikeCount < 50}
            onAdd={addFromChain} quantityFor={quantityFor} />
        </section>
        <section className="builder-panel builder-legs-panel" aria-labelledby="builder-legs-title">
          <div className="builder-panel-heading"><h2 id="builder-legs-title">Strategy legs</h2></div>
          <div className="builder-recipes"><h3>Quick recipes</h3><div>
            {metadata.data?.templates.map((template) => <button key={template.id} type="button" disabled={!chain.data} title={template.description} onClick={() => addRecipe(template.id)}>{template.label}</button>)}
          </div>{recipeMessage && <p role="status" className="mt-2 text-xs text-muted-foreground">{recipeMessage}</p>}</div>
          <StrategyLegEditor baseline={baseline} drafts={drafts} expiries={expiries.data?.expiries ?? []} chain={chain.data} account={account}
            onToggle={(id) => updateDraft(id, (leg) => ({ ...leg, enabled: !leg.enabled }))}
            onRemove={(id) => updateDrafts((current) => current.filter((leg) => leg.id !== id))}
            onDirection={(id) => updateDraft(id, (leg) => ({ ...leg, qty: -leg.qty, closesLegId: null }))}
            onQuantity={(id, units) => updateDraft(id, (leg) => ({ ...leg, qty: Math.sign(leg.qty) * units, closesLegId: null }))}
            onPrice={(id, price) => updateDraft(id, (leg) => withManualPrice(leg, price))}
            onLatest={(id) => updateDraft(id, (leg) => useLatestPrice(leg, leg.currentMark))}
            onExpiry={setLegExpiry} onContract={setContract}
            onClose={(leg) => updateDrafts((current) => {
              const closing = current.filter((draft) => draft.enabled && draft.closesLegId === leg.id).reduce((sum, draft) => sum + Math.abs(draft.qty), 0);
              const remaining = Math.abs(leg.qty) - closing;
              return remaining <= 0 ? current : [...current, closeDraft(leg, leg.currentMark?.value ?? null, remaining)];
            })} />
          <div className="builder-legs-footer"><CustomLegForm chain={chain.data} onAdd={addFromChain} /><div className="text-sm"><span className="text-muted-foreground">Net draft cashflow </span><strong className={netCashflow === null ? "" : netCashflow < 0 ? "text-loss" : "text-profit"}>{netCashflow === null ? "Incomplete" : formatSignedINR(netCashflow)}</strong></div></div>
          <p className="px-4 pb-3 text-xs text-muted-foreground">Prices are accepted snapshots or manual assumptions. Expand an instrument to edit its contract or price source. Close adds an opposite draft trade.</p>
        </section>
        <div className="builder-preview-column">
          <section className="builder-panel builder-preview" aria-labelledby="builder-preview-title">
            <div className="builder-panel-heading"><h2 id="builder-preview-title">Live payoff preview</h2><span className="text-xs text-muted-foreground" role="status">{isComparing ? "Calculating…" : comparison ? "Calculated · expiry" : "Awaiting valid legs"}</span></div>
            {compareError && <p role="alert" className="p-3 text-sm text-loss">{compareError}</p>}
            {comparison ? <>
              <PayoffChart variant="builder" key={activeKey} payoff={comparison.combined} spot={comparison.spot ?? 0} legs={enabledCombined.map(chartLeg)} isIndex={selection.isIndex}
                baseline={baseline.length ? { payoff: comparison.baseline, legs: baseline.map(chartLeg) } : undefined} />
              <BuilderMetrics comparison={comparison} linearTrades={drafts.some((leg) => leg.enabled && (leg.contract.type === "EQ" || leg.contract.type === "FUT"))} />
              <TargetInspector spot={spot} target={target} metrics={targetMetrics} onTarget={setTargetSpot} />
            </> : <div className="builder-empty builder-preview-empty">{isComparing ? "Calculating this scenario…" : "Add and price a leg to calculate the expiry payoff."}</div>}
          </section>
          {comparison && <BuilderMargin comparison={comparison} account={account} />}
        </div>
      </div>
      {comparison && comparison.expiries.length > 1 && <p role="note" className="payoff-warning">Expiry scenario: {comparison.expiries.map(expiryLabel).join(" / ")}. A single terminal price is applied to every expiry; later-contract time value is not modelled at the first expiry.</p>}
      {comparison?.warnings.map((warning) => <p key={warning} role="status" className="text-xs text-amber-300">{warning}</p>)}
      {comparison?.assumptions.map((assumption) => <p key={assumption} className="text-xs text-muted-foreground">{assumption}</p>)}
    </>}
    {onBackToLive && <button type="button" onClick={onBackToLive} className="justify-self-start text-sm text-muted-foreground hover:text-primary">Back to live positions</button>}
  </div>;
}
