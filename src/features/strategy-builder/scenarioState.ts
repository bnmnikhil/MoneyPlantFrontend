import type {
  OptionChainResponse,
  OptionChainRow,
  PayoffLeg,
  PayoffResponse,
  PriceObservation,
  ScenarioLeg,
  TemplateSummary,
} from "@/types/api";

export function baselineFromPayoff(response: PayoffResponse): ScenarioLeg[] {
  return response.legs.map((leg) => ({
    id: leg.legId,
    contract: {
      underlying: leg.underlying,
      expiry: leg.expiry,
      strike: leg.strike,
      type: leg.type,
    },
    exchange: leg.exchange,
    lotSize: leg.lotSize,
    qty: leg.qty,
    entryPrice: leg.avgPrice,
    priceBasis: "POSITION_AVERAGE",
    entryQuote: null,
    currentMark: observationFromImportedLeg(leg, response),
    origin: leg.origin,
    enabled: true,
    closesLegId: null,
  }));
}

function observationFromImportedLeg(leg: PayoffLeg, response: PayoffResponse): PriceObservation | null {
  if (!leg.currentMarkKnown || leg.currentMark === null) return null;
  return {
    value: leg.currentMark,
    priceKnown: true,
    fetchedAt: response.retrievedAt,
    quotedAt: null,
    sourceConnectionId: response.connectionId,
    status: "AVAILABLE",
  };
}

export function draftFromChain(
  chain: OptionChainResponse,
  row: OptionChainRow,
  type: "CE" | "PE",
  direction: "BUY" | "SELL",
  id: string = crypto.randomUUID()
): ScenarioLeg | null {
  const quote = type === "CE" ? row.call : row.put;
  if (row.lotSize === null || row.metadataConflict) return null;
  return {
    id,
    contract: { underlying: chain.underlying, expiry: chain.expiry, strike: row.strike, type },
    exchange: chain.exchange,
    lotSize: row.lotSize,
    qty: (direction === "BUY" ? 1 : -1) * row.lotSize,
    entryPrice: quote.priceKnown ? quote.value : null,
    priceBasis: quote.priceKnown ? "QUOTE_SNAPSHOT" : "MANUAL",
    entryQuote: quote.priceKnown ? quote : null,
    currentMark: quote.priceKnown ? quote : null,
    origin: "DRAFT_TRADE",
    enabled: true,
    closesLegId: null,
  };
}

export function withManualPrice(leg: ScenarioLeg, value: number | null): ScenarioLeg {
  return { ...leg, entryPrice: value, priceBasis: "MANUAL" };
}

export function useLatestPrice(leg: ScenarioLeg, observation: PriceObservation | null): ScenarioLeg {
  if (!observation?.priceKnown || observation.value === null) return leg;
  return { ...leg, entryPrice: observation.value, priceBasis: "QUOTE_SNAPSHOT", entryQuote: observation };
}

export function changeDraftContract(
  leg: ScenarioLeg,
  updates: Partial<ScenarioLeg["contract"]>,
  lotSize: number | null
): ScenarioLeg {
  return {
    ...leg,
    contract: { ...leg.contract, ...updates },
    lotSize,
    entryPrice: null,
    entryQuote: null,
    currentMark: null,
    priceBasis: "MANUAL",
  };
}

export function closeDraft(existing: ScenarioLeg, assumedPrice: number | null): ScenarioLeg {
  return {
    ...existing,
    id: crypto.randomUUID(),
    qty: -existing.qty,
    entryPrice: assumedPrice,
    priceBasis: assumedPrice === existing.currentMark?.value ? "QUOTE_SNAPSHOT" : "MANUAL",
    entryQuote: assumedPrice === existing.currentMark?.value ? existing.currentMark : null,
    origin: "DRAFT_TRADE",
    enabled: true,
    closesLegId: existing.id,
  };
}

export function validDraft(leg: ScenarioLeg): boolean {
  if (!leg.enabled) return true;
  if (leg.qty === 0 || leg.entryPrice === null || !Number.isFinite(leg.entryPrice) || leg.entryPrice < 0) return false;
  if ((leg.contract.type === "CE" || leg.contract.type === "PE") &&
      (!leg.contract.expiry || leg.contract.strike <= 0 || !leg.lotSize || Math.abs(leg.qty) % leg.lotSize !== 0)) return false;
  return true;
}

export function applyRecipe(
  template: TemplateSummary,
  chain: OptionChainResponse,
  idPrefix = `recipe-${Date.now()}`
): { legs: ScenarioLeg[]; missing: number } {
  if (!chain.rows.length || chain.spot === null) return { legs: [], missing: template.legs.length };
  const atmIndex = chain.rows.reduce((best, row, index) =>
    Math.abs(row.strike - chain.spot!) < Math.abs(chain.rows[best].strike - chain.spot!) ? index : best, 0);
  const legs: ScenarioLeg[] = [];
  let missing = 0;
  template.legs.forEach((selection, index) => {
    const row = chain.rows[atmIndex + selection.strikeOffset];
    const draft = row && draftFromChain(chain, row, selection.type,
      selection.quantityLots < 0 ? "SELL" : "BUY", `${idPrefix}-${index}`);
    if (!draft) {
      missing++;
      return;
    }
    legs.push({ ...draft, qty: Math.sign(selection.quantityLots) * Math.abs(selection.quantityLots) * draft.lotSize! });
  });
  return { legs, missing };
}

export function chartLeg(leg: ScenarioLeg) {
  return {
    type: leg.contract.type,
    strike: leg.contract.strike,
    qty: leg.qty,
    avgPrice: leg.entryPrice ?? 0,
  };
}

export function draftKey(underlying: string, positionConnectionId?: string | null) {
  return `${positionConnectionId ?? "new"}:${underlying}`;
}
