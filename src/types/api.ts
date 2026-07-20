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
  kiteConnected: boolean;
}

export interface LoginUrl {
  url: string;
}

export interface Position {
  symbol: string;
  product: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  dayChange: number;
}

export interface Holding {
  symbol: string;
  qty: number;
  avgCost: number;
  ltp: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
}

export interface Margins {
  available: number;
  used: number;
  total: number;
  cash: number;
  collateral: number;
}

/** Backend error body for an expired Kite session (HTTP 409). */
export interface KiteSessionExpiredError {
  error: "KITE_SESSION_EXPIRED";
}
