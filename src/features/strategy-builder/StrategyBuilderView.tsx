import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Info, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { brokerLabel } from "@/components/BrokerBadge";
import { PayoffChart } from "@/features/payoff/PayoffChart";
import { usePayoffCurves, useStrategyMetadata } from "@/features/payoff/hooks";
import { useHoldings } from "@/features/holdings/hooks";
import { useBrokerStatus } from "@/features/session/hooks";
import { api, ApiError } from "@/lib/api";
import { formatPrice, formatSignedINR } from "@/lib/format";
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
import { BuilderMetrics, PnlLadder, TargetInspector } from "./BuilderMetrics";
import { CustomLegForm } from "./CustomLegForm";
import { draftCashflow } from "./legFigures";
import { expiryLabel } from "@/features/payoff/expiry";

interface StrategyBuilderProps {
  initialBaseline?: PayoffResponse | null;
  active?: boolean;
}

interface DraftContext {
  selection: UnderlyingSearchItem;
  baseline: ScenarioLeg[];
  baselineResponse: PayoffResponse | null;
  positionConnectionId: string | null;
  drafts: ScenarioLeg[];
}

export function StrategyBuilderView({ initialBaseline, active = true }: StrategyBuilderProps) {
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
  // The baseline is switched on and off from the legs panel: existing positions, holdings, or both,
  // from one account. `baselineAccount` is the account chosen when more than one holds this
  // underlying; with a baseline loaded the baseline's own account wins.
  const [baselineAccount, setBaselineAccount] = useState<string | null>(null);
  const [baselineBusy, setBaselineBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const holdingsQuery = useHoldings();
  const status = useBrokerStatus();
  // Layout B: the chain is a drawer over the legs, opened by "+ Add from chain"; the payoff stays in
  // view beside it so each Buy or Sell visibly redraws the curve.
  const [chainOpen, setChainOpen] = useState(false);
  const [chartTab, setChartTab] = useState<"chart" | "table">("chart");
  useEffect(() => {
    if (!chainOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setChainOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chainOpen]);
  const revision = useRef(0);
  const importedRevision = useRef<string | null>(null);

  const context = activeKey ? contexts[activeKey] : undefined;
  const selection = context?.selection ?? null;
  const baseline = context?.baseline ?? [];
  const drafts = context?.drafts ?? [];
  const positionConnectionId = context?.positionConnectionId ?? null;
  const positionCurve = positionCurves.data?.find((curve) =>
    curve.connectionId === positionConnectionId && curve.underlying === selection?.code);

  const importBaseline = useCallback((response: PayoffResponse, keep?: { selection: UnderlyingSearchItem; draftsFrom: string | null }) => {
    const key = draftKey(response.underlying, response.connectionId);
    const importedSelection: UnderlyingSearchItem = keep?.selection ?? {
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
        // Switching a baseline on from the legs panel keeps the drafts already on screen.
        drafts: current[key]?.drafts?.length ? current[key].drafts
          : keep?.draftsFrom ? current[keep.draftsFrom]?.drafts ?? [] : current[key]?.drafts ?? [],
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

  // Who holds this underlying: accounts with open positions in it, and accounts with its shares.
  const positionAccounts = useMemo(() => (positionCurves.data ?? []).filter((curve) => curve.underlying === selection?.code)
    .map((curve) => curve.connectionId), [positionCurves.data, selection?.code]);
  const holdingAccounts = useMemo(() => [...new Set((holdingsQuery.data?.items ?? [])
    .filter((h) => h.qty > 0 && h.underlying === selection?.code).map((h) => h.connectionId))], [holdingsQuery.data, selection?.code]);
  const baselineAccounts = useMemo(() => [...new Set([...positionAccounts, ...holdingAccounts])], [positionAccounts, holdingAccounts]);
  const accountName = (connectionId: string) => {
    const c = status.connections.find((x) => x.connectionId === connectionId);
    return c ? `${brokerLabel(c.brokerId)} · ${c.accountLabel}` : connectionId.split(":").slice(1).join(" · ");
  };
  const currentAccount = positionConnectionId ?? (baselineAccount && baselineAccounts.includes(baselineAccount) ? baselineAccount : baselineAccounts[0] ?? null);
  const positionsOn = baseline.some((leg) => leg.origin === "EXISTING_POSITION");
  const holdingsOn = baseline.some((leg) => leg.origin === "EXISTING_HOLDING");

  /** Loads exactly the baseline asked for: positions, holdings, both, or neither. Drafts stay. */
  const setBaselineParts = async (positions: boolean, holdings: boolean, account: string | null) => {
    if (!selection || !activeKey) return;
    setImportError(null);
    if ((!positions && !holdings) || !account) {
      setContexts((current) => current[activeKey] ? ({ ...current, [activeKey]: { ...current[activeKey], baseline: [], baselineResponse: null } }) : current);
      return;
    }
    setBaselineBusy(true);
    try {
      const response = await api.payoff(account, selection.code, holdings);
      const legs = response.legs.filter((leg) => (positions && leg.origin === "EXISTING_POSITION") || (holdings && leg.origin === "EXISTING_HOLDING"));
      importBaseline({ ...response, legs }, { selection, draftsFrom: activeKey });
    } catch (error) {
      setImportError(error instanceof ApiError ? error.message : "Could not load that account's positions.");
    } finally {
      setBaselineBusy(false);
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
  const ladderLeg = (leg: ScenarioLeg) => ({ type: leg.contract.type, strike: leg.contract.strike, price: leg.entryPrice ?? 0, qty: leg.qty });
  const quotesNote = `Quotes may come from another broker; positions and margin ${account ? `remain tied to ${account}` : "stay in their original account"}.`;
  return <div className="builder-workspace builder-b">
    <section className="builder-panel builder-context" aria-label="Strategy context">
      <div className="builder-context-fields">
        <UnderlyingSearch selected={selection} onSelect={chooseUnderlying} />
        <label>Expiry<select value={pickerExpiry} disabled={!expiries.data?.expiries.length} onChange={(event) => setPickerExpiry(event.target.value)}>
          {!expiries.data?.expiries.length && <option value="">No expiry available</option>}
          {expiries.data?.expiries.map((expiry) => <option key={expiry} value={expiry}>{expiryLabel(expiry)}</option>)}
        </select></label>
        <label title={quotesNote}>Quotes source<select value={sourceConnectionId} disabled={!availableSources.length} onChange={(event) => setSourceConnectionId(event.target.value)}>
          {!availableSources.length && <option value="">No usable source</option>}
          {sources.data?.sources.map((source) => <option key={source.connectionId} value={source.connectionId} disabled={!source.available}>{brokerLabel(source.brokerId)} · {source.accountLabel}{source.policyRestricted ? " (restricted)" : ""}</option>)}
        </select></label>
        <div className="builder-spot"><p>Spot</p><strong>{spot !== null && spot > 0 ? formatPrice(spot) : "—"}</strong></div>
        <div className="builder-context-actions">
          <span className="builder-hypo" title="A what-if workspace: nothing here is sent to a broker.">Hypothetical · no orders</span>
          <button type="button" className="builder-primary-button" onClick={() => { setActiveKey(null); setComparisonSnapshot(null); setTargetSpot(null); setImportError(null); setChainOpen(false); }}>New strategy</button>
          <Button variant="outline" disabled={!drafts.length} onClick={() => updateDrafts(() => [])}><RotateCcw className="size-3.5" />Reset</Button>
        </div>
      </div>
      {positionCurves.isError && <p role="alert" className="text-xs text-loss">Could not list existing positions. <button type="button" className="underline" onClick={() => positionCurves.refetch()}>Retry</button></p>}
      {Object.keys(contexts).length > 1 && <div className="builder-session-drafts"><span>Session drafts:</span>{Object.entries(contexts).map(([key, saved]) => <button key={key} type="button" aria-pressed={key === activeKey} onClick={() => { setActiveKey(key); setTargetSpot(null); }}>
        {saved.selection.symbol}{saved.positionConnectionId ? ` · ${positionCurves.data?.find((curve) => curve.connectionId === saved.positionConnectionId && curve.underlying === saved.selection.code)?.accountLabel ?? "imported positions"}` : " · new"} ({saved.drafts.length})
      </button>)}</div>}
    </section>
    {!selection && <div className="builder-panel builder-empty">Search the exchange catalogue to start a strategy, or add existing positions above.</div>}
    {selection?.hasOptions === false && <div className="builder-panel builder-empty"><strong>No listed options</strong><p>{selection.name} has no listed option contracts in the current catalogue.</p></div>}
    {selection && selection.hasOptions !== false && <>
      {!availableSources.length && <p role="status" className="text-sm text-orange-300">Option data unavailable. Connect a market-data-capable broker for chain quotes.</p>}
      {sources.isError && <p role="alert" className="text-sm text-loss">Could not load quote sources. <button className="underline" onClick={() => sources.refetch()}>Retry</button></p>}
      {expiries.isError && <p role="alert" className="text-sm text-loss">Could not load expiries. <button className="underline" onClick={() => expiries.refetch()}>Retry</button></p>}
      <div className="builder-b-grid">
        <section className="builder-panel builder-b-legs" aria-labelledby="builder-legs-title">
          <div className="builder-panel-heading">
            <h2 id="builder-legs-title">Strategy legs</h2>
            <div className="flex items-center gap-2">
              <button type="button" className="builder-primary-button" aria-expanded={chainOpen} aria-controls="builder-chain-drawer" onClick={() => setChainOpen(true)}><Plus className="size-3.5" />Add from chain</button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={!chain.data || !metadata.data?.templates.length}>Recipes<ChevronDown className="size-3.5" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="app-workspace max-h-80 overflow-auto">
                  {metadata.data?.templates.map((template) => <DropdownMenuItem key={template.id} title={template.description} onSelect={() => addRecipe(template.id)}>{template.label}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="builder-baseline-bar" aria-label="Existing positions and holdings">
            <label className="builder-switch" title={positionAccounts.length ? "Add this account's open positions as a locked baseline" : `No open ${selection.symbol} positions in any account`}>
              <input type="checkbox" role="switch" className="payoff-holdings-switch" checked={positionsOn} disabled={baselineBusy || (!positionsOn && !(currentAccount && positionAccounts.includes(currentAccount)))}
                onChange={(event) => { void setBaselineParts(event.target.checked, holdingsOn, currentAccount); }} />
              Existing positions
            </label>
            <label className="builder-switch" title={holdingAccounts.length ? "Add this account's shares as a locked baseline (margin is not estimated with shares)" : `No ${selection.symbol} shares in any account`}>
              <input type="checkbox" role="switch" className="payoff-holdings-switch" checked={holdingsOn} disabled={baselineBusy || (!holdingsOn && !(currentAccount && holdingAccounts.includes(currentAccount)))}
                onChange={(event) => { void setBaselineParts(positionsOn, event.target.checked, currentAccount); }} />
              Holdings
            </label>
            {baselineAccounts.length > 1 && <select aria-label="Account for existing positions and holdings" value={currentAccount ?? ""} disabled={baselineBusy}
              onChange={(event) => { setBaselineAccount(event.target.value); if (positionsOn || holdingsOn) void setBaselineParts(positionsOn, holdingsOn, event.target.value); }}>
              {baselineAccounts.map((id) => <option key={id} value={id}>{accountName(id)}</option>)}
            </select>}
            {baselineAccounts.length === 1 && (positionsOn || holdingsOn) && <span className="builder-baseline-account">{accountName(baselineAccounts[0])}</span>}
            {baselineBusy && <span className="builder-baseline-account">Loading…</span>}
          </div>
          {importError && <p role="alert" className="builder-legs-note text-loss">{importError}</p>}
          {recipeMessage && <p role="status" className="builder-legs-note">{recipeMessage}</p>}
          <div className="builder-b-legs-scroll">
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
          </div>
          {comparison && <BuilderMetrics comparison={comparison} linearTrades={drafts.some((leg) => leg.enabled && (leg.contract.type === "EQ" || leg.contract.type === "FUT"))} />}
          {chainOpen && <div id="builder-chain-drawer" className="builder-drawer" role="dialog" aria-label="Add legs from the option chain">
            <OptionChainPicker chain={chain.data} isLoading={chain.isLoading || chain.isFetching} error={chain.error}
              onRetry={() => chain.refetch()} onExpand={() => setStrikeCount((value) => Math.min(50, value + 10))} canExpand={strikeCount < 50}
              onAdd={addFromChain} quantityFor={quantityFor}
              actions={<button type="button" className="builder-primary-button" autoFocus title="Tap Buy or Sell; the payoff on the right updates as you go. Esc also closes." onClick={() => setChainOpen(false)}>Done</button>} />
          </div>}
        </section>
        <section className="builder-panel builder-b-chart" aria-labelledby="builder-preview-title">
          <div className="builder-panel-heading">
            <h2 id="builder-preview-title">Payoff at expiry</h2>
            <div className="builder-chart-tabs" role="tablist" aria-label="Payoff view">
              <button type="button" role="tab" aria-selected={chartTab === "chart"} onClick={() => setChartTab("chart")}>Chart</button>
              <button type="button" role="tab" aria-selected={chartTab === "table"} onClick={() => setChartTab("table")}>P&amp;L table</button>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">{isComparing ? "Calculating…" : comparison ? "Calculated · expiry" : "Awaiting valid legs"}
              {comparison?.assumptions.length ? <Info className="size-3.5" aria-label={comparison.assumptions.join(" ")}><title>{comparison.assumptions.join(" ")}</title></Info> : null}</span>
          </div>
          {compareError && <p role="alert" className="p-3 text-sm text-loss">{compareError}</p>}
          {comparison ? <>
            {chartTab === "chart"
              ? <PayoffChart variant="builder" axisTitles={false} key={activeKey} payoff={comparison.combined} spot={comparison.spot ?? 0} legs={enabledCombined.map(chartLeg)} isIndex={selection.isIndex}
                  baseline={baseline.length ? { payoff: comparison.baseline, legs: baseline.map(chartLeg) } : undefined} />
              : <PnlLadder spot={comparison.spot} isIndex={selection.isIndex} baseline={baseline.map(ladderLeg)} combined={enabledCombined.map(ladderLeg)} />}
            <TargetInspector spot={spot} target={target} metrics={targetMetrics} onTarget={setTargetSpot} />
          </> : <div className="builder-empty builder-preview-empty">{isComparing ? "Calculating this scenario…" : "Add legs from the chain or a recipe to see the expiry payoff."}</div>}
        </section>
      </div>
      {comparison && comparison.expiries.length > 1 && <p role="note" className="payoff-warning">Expiry scenario: {comparison.expiries.map(expiryLabel).join(" / ")}. A single terminal price is applied to every expiry; later-contract time value is not modelled at the first expiry.</p>}
      {comparison?.warnings.map((warning) => <p key={warning} role="status" className="text-xs text-orange-300">{warning}</p>)}
    </>}
  </div>;
}
