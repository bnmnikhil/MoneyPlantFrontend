/**
 * API types — mirror the backend contract exactly (Spring Boot, same origin, /api).
 * Do not add fields the backend does not send.
 */

export interface Me {
  email: string;
  name: string;
  picture: string;
}

/** One linked broker account. Keyed by connectionId, like every other contract. */
export interface BrokerConnection {
  connectionId: string;
  brokerId: string;
  /**
   * What to call this account: the broker's own client code where it gives one
   * ("ZR4821"), otherwise the connectionId's label segment ("default").
   * Never blank — the backend normalises it on BrokerSession.
   */
  accountLabel: string;
  connected: boolean;
}

/**
 * Two arrays, answering two questions.
 *
 * `connections` is what this user has linked, one row per account — so two
 * accounts at the same broker are two rows, which the old broker-keyed
 * `{id, connected}` shape could not express.
 *
 * `brokers` is every broker the backend knows about, which is what the Connect
 * buttons are built from: a broker with no connection has no row in the first
 * array. Do not read it as "brokers this user wants" — that distinction starts
 * mattering only when brokers become user-configured.
 */
export interface SessionStatus {
  brokers: string[];
  connections: BrokerConnection[];
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
  /**
   * BANKNIFTY, ITC — resolved server-side from the broker's contract master.
   *
   * Null for equity positions, and for any symbol the contract master doesn't
   * know. The UI groups on this, so it must tolerate null rather than assume it.
   */
  underlying: string | null;
  product: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  /** Lifetime, since entry, in rupees. */
  pnl: number;
  /** Today's movement, in rupees — not a per-unit price delta. */
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

/**
 * Error body when the whole request failed, from ApiExceptionHandler.
 *
 * Only the single-connection endpoints (payoff) can produce this — the
 * aggregate endpoints report per-broker failures as 200 + warnings.
 *
 * BROKER_SESSION_EXPIRED -> 409, reconnect this broker
 * BROKER_NOT_CONNECTED   -> 409, connect it for the first time
 * BROKER_CALL_FAILED     -> 502, upstream problem, retry may work
 */
export type BrokerErrorCode =
  | "BROKER_SESSION_EXPIRED"
  | "BROKER_NOT_CONNECTED"
  | "BROKER_CALL_FAILED";

export interface BrokerErrorBody {
  error: BrokerErrorCode;
  /** Null when the failure happened before a broker was resolved. */
  brokerId: string | null;
  message: string;
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

/**
 * One selectable curve.
 *
 * Curves are per (connection, underlying) and are deliberately not merged
 * across brokers — a spread only earns margin benefit inside one account, so a
 * combined curve would describe no real position. The same underlying held at
 * two brokers therefore appears twice, distinguished by broker.
 */
export interface CurveRef {
  connectionId: string;
  brokerId: string;
  underlying: string;
}

export interface PayoffResponse {
  underlying: string;
  brokerId: string;
  connectionId: string;
  spot: number;
  legs: PayoffLeg[];
  payoff: Payoff;
  expiries: string[];
}
