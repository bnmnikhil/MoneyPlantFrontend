export interface ChartLeg {
  type: "CE" | "PE" | "FUT" | "EQ";
  strike: number;
  qty: number;
  avgPrice: number;
}
export type PriceRange = [number, number];

const positive = (value: number) => Number.isFinite(value) && value > 0;

/**
 * Round axis ticks inside [min, max]: steps of 1, 2, 2.5 or 5 times a power of ten, about `target`
 * of them. Recharts' own ticks on a fitted domain land on values like 225.845; these land on 230,
 * 240, 250. Returns [] for an empty or non-finite range so the chart falls back to its defaults.
 */
export function niceTicks(min: number, max: number, target = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || target < 1) return [];
  const raw = (max - min) / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const count = (s: number) => Math.floor(max / s + 1e-9) - Math.ceil(min / s - 1e-9) + 1;
  // The step whose tick count is closest to the target; on a tie, the finer one.
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power)
    .reduce((best, s) => Math.abs(count(s) - target) < Math.abs(count(best) - target) ? s : best);
  const ticks: number[] = [];
  for (let tick = Math.ceil(min / step) * step; tick <= max + step * 1e-9; tick += step) {
    ticks.push(Math.round(tick / step) * step);
  }
  return ticks.map((tick) => Number(tick.toFixed(10)));
}

export function rangeAnchor(spot: number, legs: ChartLeg[]): number {
  if (positive(spot)) return spot;
  const active = legs.filter((leg) => leg.qty !== 0);
  const strikes = active.filter((leg) => leg.type === "CE" || leg.type === "PE")
    .map((leg) => leg.strike).filter(positive).sort((a, b) => a - b);
  if (strikes.length) return (strikes[0] + strikes[strikes.length - 1]) / 2;
  const entries = active.map((leg) => leg.avgPrice).filter(positive);
  return entries.length ? entries.reduce((a, b) => a + b, 0) / entries.length : 0;
}

export function defaultRange(spot: number, isIndex: boolean, legs: ChartLeg[], breakevens: number[]): PriceRange {
  const anchor = rangeAnchor(spot, legs);
  const percent = isIndex ? 0.10 : 0.15;
  let low = anchor * (1 - percent), high = anchor * (1 + percent);
  const landmarks = [
    ...legs.filter((leg) => leg.qty !== 0 && (leg.type === "CE" || leg.type === "PE")).map((leg) => leg.strike),
    ...breakevens,
  ].filter((value) => Number.isFinite(value) && value >= 0);
  const padding = anchor * 0.02;
  for (const price of landmarks) {
    if (price < low) low = Math.max(0, price - padding);
    if (price > high) high = price + padding;
  }
  return [Math.max(0, low), Math.max(high, low + 1)];
}

export function validRange(low: number, high: number): boolean {
  return Number.isFinite(low) && Number.isFinite(high) && low >= 0 && high > low;
}

/** Re-sample exact expiry payoff; do not extrapolate a rounded API polyline. */
export function chartPoints(legs: ChartLeg[], [low, high]: PriceRange, landmarks: number[] = []) {
  const prices = new Set<number>([low, high]);
  for (let i = 1; i < 200; i++) prices.add(low + (high - low) * i / 200);
  for (const value of [...legs.filter((leg) => leg.qty !== 0 && (leg.type === "CE" || leg.type === "PE")).map((leg) => leg.strike), ...landmarks]) {
    if (Number.isFinite(value) && value >= low && value <= high) prices.add(value);
  }
  return [...prices].sort((a, b) => a - b).map((spot) => ({ spot, pnl: Math.round(100 * legs.reduce((sum, leg) => {
    const value = leg.type === "CE" ? Math.max(spot - leg.strike, 0)
      : leg.type === "PE" ? Math.max(leg.strike - spot, 0) : spot;
    return sum + (value - leg.avgPrice) * leg.qty;
  }, 0)) / 100 }));
}
