import type { ScenarioLeg } from "@/types/api";

export function legCashflow(leg: ScenarioLeg): number | null {
  return leg.entryPrice !== null && Number.isFinite(leg.entryPrice) && leg.entryPrice >= 0
    ? -leg.qty * leg.entryPrice : null;
}

export function draftCashflow(legs: ScenarioLeg[]): number | null {
  const values = legs.filter((leg) => leg.enabled).map(legCashflow);
  return values.some((value) => value === null) ? null : values.reduce<number>((sum, value) => sum + value!, 0);
}

/** Unrealised change at the imported mark; no realised P&L is supplied here. */
export function markedPnl(leg: ScenarioLeg): number | null {
  if (!leg.currentMark?.priceKnown || leg.currentMark.value === null || leg.entryPrice === null) return null;
  return (leg.currentMark.value - leg.entryPrice) * leg.qty;
}

export function quantitySize(leg: ScenarioLeg) {
  const inLots = leg.contract.type !== "EQ" && !!leg.lotSize && Math.abs(leg.qty) % leg.lotSize === 0;
  return { value: Math.abs(leg.qty) / (inLots ? leg.lotSize! : 1), unit: inLots ? "lots" : "units" };
}
