import type { ChartLeg } from "./chartRange";

/**
 * The "today" curve: what the open legs would be worth now, at each hypothetical spot, rather
 * than at expiry.
 *
 * Each option leg is priced with Black-Scholes at the implied volatility solved from its own
 * current mark, and keeps that volatility as spot moves (sticky strike; the smile does not shift).
 * Solving from the leg's own mark is what makes the curve pass through the page's Current P/L at
 * today's spot, which is the check that the pricing is right.
 *
 * A mirror of the backend's `pricing/BlackScholes` and `pricing/ImpliedVolatility`, constant for
 * constant, because the chart redraws in the browser whenever a leg is unticked or the range
 * changes. `tests/payoff-projection.test.mjs` and `BlackScholesTest` pin the same reference
 * prices, so the two cannot drift apart unnoticed.
 */

/** Annualised risk-free rate; the same constant as the backend and the broker simulator. */
export const RATE = 0.065;

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const LOW = 0.001;
const HIGH = 5.0;
const TOLERANCE = 1e-6;
const MIN_VEGA = 1e-4;
const NEWTON_STEPS = 20;
const BISECTION_STEPS = 100;

export interface ProjectionLeg extends ChartLeg {
  /** ISO date; the contract expires at 15:30 IST that day. */
  expiry?: string | null;
  currentMark?: number | null;
  currentMarkKnown?: boolean;
}

/** Years from `now` to 15:30 IST (10:00 UTC) on the expiry date; 0 once that has passed. */
export function yearsToExpiry(expiry: string, now: Date): number {
  const close = Date.parse(`${expiry}T10:00:00Z`);
  if (!Number.isFinite(close)) return 0;
  return Math.max(0, close - now.getTime()) / YEAR_MS;
}

export function intrinsic(spot: number, strike: number, call: boolean): number {
  return call ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0);
}

export function bsPrice(spot: number, strike: number, years: number, vol: number, call: boolean): number {
  if (years <= 0 || vol <= 0 || spot <= 0 || strike <= 0) return intrinsic(spot, strike, call);
  const sqrtT = Math.sqrt(years);
  const d1 = (Math.log(spot / strike) + (RATE + 0.5 * vol * vol) * years) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  const discounted = strike * Math.exp(-RATE * years);
  return call ? spot * cdf(d1) - discounted * cdf(d2) : discounted * cdf(-d2) - spot * cdf(-d1);
}

function vega(spot: number, strike: number, years: number, vol: number): number {
  if (years <= 0 || vol <= 0 || spot <= 0 || strike <= 0) return 0;
  const sqrtT = Math.sqrt(years);
  const d1 = (Math.log(spot / strike) + (RATE + 0.5 * vol * vol) * years) / (vol * sqrtT);
  return spot * pdf(d1) * sqrtT;
}

/** Abramowitz & Stegun 7.1.26, as in the backend: accurate to about 7.5e-8. */
export function cdf(x: number): number {
  if (x < 0) return 1 - cdf(-x);
  const t = 1 / (1 + 0.2316419 * x);
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 1 - pdf(x) * poly;
}

function pdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Annualised volatility implied by `price`, or null when the price carries none: at or below
 * intrinsic, above what any volatility produces, expired, or a solve that never converges.
 */
export function impliedVol(price: number, spot: number, strike: number, years: number, call: boolean): number | null {
  if (!(price > 0 && spot > 0 && strike > 0 && years > 0)) return null;
  if (price <= intrinsic(spot, strike, call) + TOLERANCE) return null;
  if (call ? price >= spot : price >= strike) return null;
  return newton(price, spot, strike, years, call) ?? bisect(price, spot, strike, years, call);
}

function newton(price: number, spot: number, strike: number, years: number, call: boolean): number | null {
  let vol = Math.min(Math.max(Math.sqrt(2 * Math.PI / years) * price / spot, LOW), HIGH);
  for (let i = 0; i < NEWTON_STEPS; i++) {
    const diff = bsPrice(spot, strike, years, vol, call) - price;
    if (Math.abs(diff) < TOLERANCE) return vol;
    const v = vega(spot, strike, years, vol);
    if (v < MIN_VEGA) return null;
    const next = vol - diff / v;
    if (!(next > LOW && next < HIGH)) return null;
    vol = next;
  }
  return null;
}

function bisect(price: number, spot: number, strike: number, years: number, call: boolean): number | null {
  let lo = LOW, hi = HIGH;
  if (bsPrice(spot, strike, years, hi, call) < price) return null;
  if (bsPrice(spot, strike, years, lo, call) > price) return null;
  for (let i = 0; i < BISECTION_STEPS; i++) {
    const mid = 0.5 * (lo + hi);
    const diff = bsPrice(spot, strike, years, mid, call) - price;
    if (Math.abs(diff) < TOLERANCE || hi - lo < TOLERANCE) return mid;
    if (diff > 0) hi = mid; else lo = mid;
  }
  return 0.5 * (lo + hi);
}

/** One leg, ready to value at any spot. */
type Valued =
  | { kind: "option"; leg: ProjectionLeg; call: boolean; years: number; vol: number }
  | { kind: "linear"; leg: ProjectionLeg; offset: number };

export interface Projection {
  legs: Valued[];
  /** Option legs priced at a volatility borrowed from another leg, because their own mark gave none. */
  borrowedVol: number;
}

/**
 * Prepare the legs for the today curve, or null when it cannot be drawn: no spot, or an open
 * option leg for which no volatility can be found anywhere in the book.
 *
 * A leg whose own mark yields no volatility (unpriced, or trading at intrinsic) borrows the
 * volatility of the nearest-the-money solved leg, preferring one with the same expiry; the count
 * is reported so the chart can say so. Futures and shares move one-for-one with spot, keeping
 * today's basis, so they too pass through their current mark.
 */
export function prepareProjection(legs: ProjectionLeg[], spot: number, now: Date): Projection | null {
  if (!(spot > 0)) return null;
  const open = legs.filter((leg) => leg.qty !== 0);
  const markOf = (leg: ProjectionLeg) =>
    leg.currentMarkKnown && leg.currentMark != null && Number.isFinite(leg.currentMark) ? leg.currentMark : null;

  const solved = open.map((leg) => {
    if (leg.type !== "CE" && leg.type !== "PE") return null;
    const years = leg.expiry ? yearsToExpiry(leg.expiry, now) : 0;
    const mark = markOf(leg);
    return mark === null ? null : impliedVol(mark, spot, leg.strike, years, leg.type === "CE");
  });

  const borrow = (leg: ProjectionLeg): number | null => {
    let best: { vol: number; score: number } | null = null;
    open.forEach((other, i) => {
      const vol = solved[i];
      if (vol === null) return;
      // Same expiry first, then nearest the money.
      const score = (other.expiry === leg.expiry ? 0 : 1e12) + Math.abs(other.strike - spot);
      if (!best || score < best.score) best = { vol, score };
    });
    return best ? (best as { vol: number }).vol : null;
  };

  let borrowedVol = 0;
  const valued: Valued[] = [];
  for (let i = 0; i < open.length; i++) {
    const leg = open[i];
    if (leg.type === "CE" || leg.type === "PE") {
      const years = leg.expiry ? yearsToExpiry(leg.expiry, now) : 0;
      let vol = solved[i];
      if (vol === null && years > 0) {
        vol = borrow(leg);
        if (vol === null) return null;
        borrowedVol++;
      }
      valued.push({ kind: "option", leg, call: leg.type === "CE", years, vol: vol ?? 0 });
    } else {
      const mark = markOf(leg);
      valued.push({ kind: "linear", leg, offset: mark === null ? 0 : mark - spot });
    }
  }
  return { legs: valued, borrowedVol };
}

/** Open P&L at `spot` today, in rupees, rounded to paise like the expiry curve. */
export function projectedPnl(projection: Projection, spot: number): number {
  let total = 0;
  for (const v of projection.legs) {
    const value = v.kind === "option"
      ? bsPrice(spot, v.leg.strike, v.years, v.vol, v.call)
      : spot + v.offset;
    total += (value - v.leg.avgPrice) * v.leg.qty;
  }
  return Math.round(100 * total) / 100;
}
