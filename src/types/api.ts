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
  /**
   * Which of the user's registrations at this broker authorised this login —
   * matches `BrokerCredential.label`, and is the join between the two. A
   * different axis from `accountLabel`: one registration (a developer app) can
   * authorise several accounts. Never blank; "default" where the user never
   * named one.
   */
  credentialLabel: string;
  connected: boolean;
}

/**
 * Two arrays, answering two questions.
 *
 * `connections` is what this user has linked, one row per account — so two
 * accounts at the same broker are two rows, which the old broker-keyed
 * `{id, connected}` shape could not express.
 *
 * `brokers` is what the Connect buttons are built from: a broker with no
 * connection has no row in the first array.
 *
 * As of 3d it means "brokers this user has stored credentials for", not "every
 * broker in the build". An empty array is the new-user state and means send them
 * to Settings — a Connect button for a broker whose API key they have not
 * supplied could only ever fail.
 */
export interface SessionStatus {
  brokers: string[];
  connections: BrokerConnection[];
}

/**
 * One broker's credential state on the settings screen.
 *
 * There is deliberately no secret field, in any form. The backend never returns
 * one — not even masked, since a masked value would imply the real one is
 * retrievable, and it is not. `configured` is what the UI renders instead.
 */
export interface BrokerCredential {
  brokerId: string;
  /**
   * The user's name for this registration at this broker — *not* an account
   * label. A credential is a developer app; a connection is a login that app
   * authorised, and one registration can produce several connections.
   */
  label: string;
  /** The key itself, so the user can confirm they pasted the right one. Null when unconfigured. */
  apiKey: string | null;
  configured: boolean;
}

/** Write-only: the secret goes up and is never read back. */
export interface BrokerCredentialInput {
  apiKey: string;
  apiSecret: string;
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
 * BROKER_SESSION_EXPIRED      -> 409, reconnect this broker
 * BROKER_NOT_CONNECTED        -> 409, connect it for the first time
 * BROKER_CALL_FAILED          -> 502, upstream problem, retry may work
 * BROKER_NOT_CONFIGURED       -> 409, no credentials stored: go to Settings
 * BROKER_CREDENTIAL_UNREADABLE-> 409, stored secret will not decrypt, re-enter it
 *
 * The last two arrived with 3d. Both are 409 rather than 404 for the same reason
 * as the first two: the request cannot proceed in the current state, and the fix
 * is an action the user takes — the difference is only which screen it happens on.
 */
export type BrokerErrorCode =
  | "BROKER_SESSION_EXPIRED"
  | "BROKER_NOT_CONNECTED"
  | "BROKER_CALL_FAILED"
  | "BROKER_NOT_CONFIGURED"
  | "BROKER_CREDENTIAL_UNREADABLE";

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
