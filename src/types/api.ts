/**
 * API types — mirror the backend contract exactly (Spring Boot, same origin, /api).
 * Do not add fields the backend does not send.
 */

export interface Me {
  email: string;
  name: string;
  picture: string;
}

export interface SessionStatus {
  brokers: { id: string; connected: boolean }[];
}
export interface LoginUrl {
  url: string;
}

/**
 * One broker failed while others succeeded.
 *
 * SESSION_EXPIRED -> that broker's token is dead, the user must reconnect it.
 * CALL_FAILED     -> transient (network, 5xx, rate limit). Do NOT tell the user
 *                    to reconnect; a retry may simply work.
 */
export type BrokerWarningCode = "SESSION_EXPIRED" | "CALL_FAILED";

export interface BrokerWarning {
  brokerId: string;
  connectionId: string;
  code: BrokerWarningCode;
  message: string;
}

/**
 * Envelope returned by every multi-broker read endpoint.
 *
 * Partial success is the normal case and arrives as HTTP 200: if Kite responds
 * and Alice Blue's token is dead, `items` holds Kite's rows and `warnings` has
 * one entry for Alice Blue. A non-2xx means the whole request failed.
 */
export interface BrokerAggregate<T> {
  items: T[];
  warnings: BrokerWarning[];
}

/** Fields the backend fan-out stamps onto every aggregated row. */
export interface BrokerSourced {
  broker: string;
  connectionId: string;
}

export interface Position extends BrokerSourced {
  symbol: string;
  product: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  dayChange: number;
}

export interface Holding extends BrokerSourced {
  symbol: string;
  qty: number;
  avgCost: number;
  ltp: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
}

/** One row per connected broker. The frontend sums these for headline figures. */
export interface Margins extends BrokerSourced {
  available: number;
  used: number;
  total: number;
  cash: number;
  collateral: number;
}

/** Backend error body when the entire request failed (HTTP 409). */
export interface KiteSessionExpiredError {
  error: "KITE_SESSION_EXPIRED";
}

export interface PayoffLeg {
  symbol: string;
  strike: number;
  /** Backend InstrumentType includes FUT, so a futures position is representable. */
  type: "CE" | "PE" | "FUT";
  qty: number;
  avgPrice: number;
}

export interface PayoffPoint {
  spot: number;
  pnl: number;
}

export interface Payoff {
  points: PayoffPoint[];
  breakevens: number[];
  maxProfit: number;
  maxLoss: number;
  unboundedProfit: boolean;
  unboundedLoss: boolean;
}

export interface PayoffResponse {
  underlying: string;
  spot: number;
  legs: PayoffLeg[];
  payoff: Payoff;
  expiries: string[];
}
