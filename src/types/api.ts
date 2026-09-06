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

export type Freshness = "LIVE" | "SNAPSHOT" | "STALE" | "NONE";

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
  asOf?: string | null;
  freshness?: Freshness;
  refreshing?: boolean;
}

/** Fields the backend fan-out stamps onto every aggregated row. */
export interface BrokerSourced {
  broker: string;
  connectionId: string;
}

export interface Position extends BrokerSourced {
  symbol: string;
  /**
   * Canonical code — BANKNIFTY, ITC, MM. Resolved server-side from the broker's
   * contract master.
   *
   * Null for equity positions, and for any symbol the contract master doesn't
   * know. The UI groups on this, so it must tolerate null rather than assume it.
   *
   * **Group on this; never render it.** It is punctuation-stripped so that three
   * brokers' spellings collapse to one key, which means Mahindra reads `MM`.
   * Render `underlyingLabel`.
   */
  underlying: string | null;
  /**
   * The same underlying spelled for a human — `M&M`, `BANKNIFTY`.
   *
   * Null exactly when `underlying` is null; otherwise always present, falling
   * back to the canonical code, so the UI never has to choose between them.
   */
  underlyingLabel: string | null;
  /**
   * The option right — CE, PE, FUT or EQ — resolved server-side from the same
   * contract master as `underlying`, and null exactly when that lookup missed.
   *
   * Deriving it here would mean regex-parsing `HDFCBANK25AUG26P730` in the
   * browser, which is what the note on `underlying` above rules out. Null means
   * "we could not tell", never "not an option": a null must fall into its own
   * bucket rather than being folded in with the calls.
   */
  instrumentType: InstrumentType | null;
  /**
   * Strike, expiry and lot size, from the same contract master lookup as
   * `underlying` and `instrumentType` — null exactly when that lookup missed.
   *
   * Here because anything reasoning about a position as a **structure** rather
   * than as a mark needs them: splitting a premium into intrinsic and extrinsic
   * needs the strike, and locating a group on its own payoff curve needs the
   * strike of every leg. The alternative was parsing the vendor symbol in the
   * browser, which the note on `underlying` above rules out.
   *
   * One nullable object rather than three nullable fields, so the question
   * "did the contract master resolve this row?" is asked once.
   */
  contract: PositionContract | null;
  product: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  /**
   * False when nothing could quote this row — **not** the same as it being
   * worth zero.
   *
   * Paytm prices its positions from a separate market-data call that can come
   * back empty, leaving `ltp` at 0. Any figure derived from the mark — market
   * value, premium left — must render a dash rather than ₹0 when this is false,
   * on the same rule as an unavailable margin basis: a zero is a claim, and
   * printing one nobody measured is worse than printing nothing.
   */
  priceKnown: boolean;
  /** Lifetime, since entry, in rupees. */
  pnl: number;
  /**
   * The realised half of `pnl`, booked on quantity no longer open — and already
   * included in it.
   *
   * `qty × (ltp − avgPrice)` is the *unrealised* half only, so anything pairing
   * a mark against an entry basis — premium left beside premium at entry —
   * differs from `pnl` by exactly this. It is 0 across every live book captured
   * so far, which is why treating the pair as the lifetime P&L has held.
   */
  realisedPnl: number;
  /** Today's movement, in rupees — not a per-unit price delta. */
  dayChange: number;
}

/** What the broker's contract master knows about an instrument beyond its name. */
export interface PositionContract {
  /** 0 for futures and equity, matching the server's InstrumentKey. */
  strike: number;
  /** ISO date. Null for equity. */
  expiry: string | null;
  lotSize: number;
}

export interface Holding extends BrokerSourced {
  symbol: string;
  /** The whole holding, pledged shares included. currentValue and pnl use this. */
  qty: number;
  /** How much of `qty` is pledged as collateral. A breakdown, never an addition. */
  pledgedQty: number;
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
  /** Canonical code. This is what `/api/payoff/{underlying}` expects. */
  underlying: string;
  /** Display spelling. Show this on the selector button; never send it. */
  underlyingLabel: string;
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

export interface SimulatedLeg {
  underlying: string;
  expiry: string;
  strike: number;
  type: "CE" | "PE" | "FUT" | "EQ";
  qty: number;
  price: number;
}

export interface StrategySimulationRequest {
  underlying?: string;
  spot?: number;
  legs: SimulatedLeg[];
}

export interface LegBreakdown {
  underlying: string;
  expiry: string;
  strike: number;
  type: "CE" | "PE" | "FUT" | "EQ";
  qty: number;
  price: number;
  standaloneMargin: number;
  hedgedMargin: number;
  hedgeBenefit: number;
  span: number;
  exposure: number;
  premium: number;
}

export interface StrategyMetrics {
  netPremium: number;
  riskRewardRatio: string;
  minStrike: number;
  maxStrike: number;
  totalLots: number;
  totalFundsRequired: number;
}

export interface StrategySimulationResponse {
  underlying: string;
  spot: number;
  payoff: Payoff;
  margin: {
    initialMargin: number;
    withBenefitMargin: number;
    hedgeBenefit: number;
    legs: LegBreakdown[];
  };
  metrics: StrategyMetrics;
  legs: LegBreakdown[];
}

export interface UnderlyingConfig {
  code: string;
  label: string;
  isIndex: boolean;
  lotSize: number;
  strikeStep: number;
  defaultSpot: number;
}

export interface TemplateSummary {
  id: string;
  label: string;
  sentiment: string;
  description: string;
}

export interface StrategyMetadata {
  underlyings: UnderlyingConfig[];
  templates: TemplateSummary[];
  expiries: string[];
}

/**
 * One slice of the book.
 *
 * An array rather than a `Record<string, number>`, mirroring the backend. A map
 * lost `label`, so a punctuation-stripped "MM" was all the UI could print for
 * M&M; and a map has no order, so the bars reshuffled between polls. These
 * arrive sorted by `percent`, descending — render them in the order given.
 */
export interface Concentration {
  /** Canonical grouping key, or "UNKNOWN". Never print this. */
  code: string;
  /** Vendor spelling. Print this. */
  label: string;
  marketValue: number;
  /** Share of gross market value, 0-100. */
  percent: number;
}

/**
 * Portfolio size and where it is concentrated.
 *
 * `marketValue`, NOT "exposure". These are `qty x ltp` summed, which for an
 * option is the premium value — what closing would cost or yield — and is not
 * the risk. A short call and a long put with the same market value differ
 * enormously: the put's is exactly its max loss, the call's is unbounded.
 */
export interface ExposureReport {
  /** Signed. Longs and shorts cancel. */
  netMarketValue: number;
  /** Sum of absolute values. The size of the book. */
  grossMarketValue: number;
  concentrationByUnderlying: Concentration[];
  /** Keyed on the option right (CE/PE/FUT/EQ), not on product (NRML/MIS). */
  concentrationByInstrumentType: Concentration[];
}

export type InstrumentType = 'CE' | 'PE' | 'FUT' | 'EQ';

/**
 * Structural identity of a contract.
 *
 * The backend record also serialises five `isXxx()` helpers (`call`, `equity`,
 * `future`, `option`, `put`) that are deliberately not declared here — see
 * RiskSummaryJsonTest, which pins the full wire shape. Derive from `type`.
 */
export interface InstrumentKey {
  underlying: string;
  /** null for cash and equity. */
  expiry: string | null;
  /** 0 for futures and cash. */
  strike: number;
  type: InstrumentType;
}

/**
 * How bad the worst case is — and whether we can say.
 *
 * UNBOUNDED and UNKNOWN are different facts and must render differently.
 * "This can lose without limit" is a finding; "we could not work out what this
 * can lose" is a gap. Collapsing both into a blank cell lets an unresolved
 * Alice Blue row read as safe.
 */
export type LossBound = 'BOUNDED' | 'UNBOUNDED' | 'UNKNOWN';

/**
 * Where a per-contract margin figure came from — and it always has to be shown,
 * because margin is non-additive. A hedged book consumes far less than its legs
 * separately, so there is no single true per-contract number, and a figure with
 * no stated method is a figure that cannot be checked.
 *
 * BROKER_MODEL — the broker's own margin calculator answered.
 * ESTIMATED    — our bottom-up engine: exchange SPAN scanned across the expiry
 *                group and divided among its legs, plus exposure per leg. Does
 *                not total to the account's bill; measured 8.6% over on a real
 *                Zerodha account, 15 Aug 2026.
 * UNAVAILABLE  — nothing to compute from. Not a zero charge.
 */
export type MarginBasis = 'BROKER_MODEL' | 'ESTIMATED' | 'UNAVAILABLE';

/** One product bucket within an account — Kite holds NRML and MIS separately. */
export interface ProductLeg {
  product: string;
  qty: number;
  avgPrice: number;
}

/**
 * Everything held in one contract, in one account.
 *
 * Netted across the broker's own product buckets, never across connections: a
 * spread only earns margin benefit inside one account, and a figure spanning
 * two brokers is one neither could confirm. Rows arrive sorted by absolute
 * market value, descending.
 */
export interface InstrumentRiskRow {
  connectionId: string;
  brokerId: string;
  symbol: string;
  /** null when the contract master could not resolve the symbol. */
  key: InstrumentKey | null;
  underlying: string | null;
  underlyingLabel: string | null;
  /** Signed. Negative is short. */
  netQty: number;
  /** Sum of absolute quantities. Exceeds |netQty| only when held both ways. */
  grossQty: number;
  avgEntry: number;
  ltp: number;
  marketValue: number;
  lossBound: LossBound;
  /** Positive magnitude. Null unless `lossBound === 'BOUNDED'`. */
  maxLoss: number | null;
  pnl: number;
  dayChange: number;
  /** Capital this contract ties up. Null when `marginBasis` is UNAVAILABLE. */
  marginUsed: number | null;
  marginBasis: MarginBasis;
  legs: ProductLeg[];
}

/**
 * What put a marker where it is.
 *
 * PERCENT rungs need only a spot and are always present when one is known.
 * SIGMA rungs need an implied volatility, solved from the book's own
 * nearest-the-money leg, and are absent when no leg could answer.
 */
export type ScenarioKind = 'PERCENT' | 'SIGMA';

export interface ScenarioMarker {
  kind: ScenarioKind;
  /** Signed magnitude: -10 for -10%, -2 for -2 sigma, 0 for spot itself. */
  scale: number;
  spot: number;
  /** Terminal P&L of the whole group at this spot. Exact, not sampled. */
  pnl: number;
}

/**
 * What one expiry of one underlying, in one account, does if the underlying
 * moves — the honest substitute for greeks while there is no volatility feed.
 *
 * Grouped by expiry as well as underlying: the P&L is the *terminal* payoff, so
 * legs expiring on different dates cannot share a curve.
 */
export interface ScenarioGroup {
  connectionId: string;
  brokerId: string;
  underlying: string;
  underlyingLabel: string;
  expiry: string;
  /** 0 when no spot was available — then `markers` is empty. */
  spot: number;
  /** Annualised, as a fraction. 0 when it could not be solved. */
  iv: number;
  /**
   * Which strike the volatility came from, e.g. "24000 CE". Null when unsolved.
   *
   * Show this. The volatility surface is a smile, so a vol taken from an
   * out-of-the-money leg is a real number about the wrong strike — usually
   * higher, which widens the band and overstates the plausible move. The reader
   * cannot judge the band without knowing which leg produced it.
   */
  ivSource: string | null;
  markers: ScenarioMarker[];
  rows: InstrumentRiskRow[];
}

/** One connection's funding. Keyed on connectionId — two Kite accounts are two rows. */
export interface AccountMargin {
  connectionId: string;
  brokerId: string;
  available: number;
  used: number;
  /** available + used. A MoneyPlant convention; no vendor supplies it. */
  total: number;
  /**
   * Per account only, and never summed. Alice Blue's is `openingCashLimit`, a
   * start-of-day figure, while Kite's and Paytm's are live and both
   * legitimately negative when a book is funded against collateral.
   */
  cash: number;
  collateral: number;
  utilisationPct: number;
}

/**
 * How much of the book's capital is committed — D9's margin & capital
 * utilisation, absent from the risk report until margin_snapshot got a writer.
 *
 * Note there is deliberately no top-level `cash`: see AccountMargin.cash.
 */
export interface MarginUtilisationReport {
  available: number;
  used: number;
  total: number;
  collateral: number;
  /** used / total, 0-100. Same formula as aggregate.ts, so the two agree. */
  utilisationPct: number;
  accounts: AccountMargin[];
  /**
   * Margins carry their OWN asOf, distinct from the report's. They are migrated
   * from different archive rows than positions and can be materially older —
   * show this one next to the margin card, not the page-level stamp.
   */
  asOf: string | null;
  freshness: Freshness;
}

/**
 * Nearest-first, which is also increasing order of risk-of-surprise.
 *
 * EXPIRED is its own tier: the backend used to compare a *signed* day count
 * against `days <= 7`, so already-expired contracts landed in THIS_WEEK and read
 * as live near-term positions.
 */
export type ExpiryTier =
  | 'EXPIRED'
  | 'THIS_WEEK'
  | 'NEXT_WEEK'
  | 'THIS_MONTH'
  | 'FAR'
  | 'NO_EXPIRY';

/**
 * A tier and a date, not a pre-composed label — the frontend composes the
 * string, same rule as `CurveRef`. Buckets arrive sorted nearest-first.
 */
export interface ExpiryBucket {
  tier: ExpiryTier;
  /** null for cash, equity, and anything the contract master could not resolve. */
  expiry: string | null;
  /** null when `expiry` is; negative when already expired. */
  daysToExpiry: number | null;
  netMarketValue: number;
  grossMarketValue: number;
  positionCount: number;
}

export interface DecayPoint {
  tradingDay: string;
  totalOptionValue: number;
  dayPnl: number;
  status: 'CAPTURED' | 'NO_SESSION' | 'FAILED';
}

export interface RiskSummaryReport {
  exposure: ExposureReport;
  /** One row per contract per account, biggest absolute market value first. */
  instruments: InstrumentRiskRow[];
  /** Per (account, underlying, expiry), nearest expiry first. */
  scenarios: ScenarioGroup[];
  expiryBuckets: ExpiryBucket[];
  /** Capital committed, per account and in total. Carries its own asOf. */
  margin: MarginUtilisationReport;
  /** Always empty for now: decay needs a snapshot series that has no writer yet. */
  decaySeries: DecayPoint[];
  /**
   * Per-broker failures. Non-empty means these numbers describe a *partial*
   * book — a concentration percentage over two of three brokers is not merely
   * inaccurate, it is unanswerable, so say so rather than rendering it plain.
   */
  warnings: BrokerWarning[];
  asOf: string | null;
  freshness: Freshness;
}
