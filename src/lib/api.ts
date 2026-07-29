import type {
  BrokerAggregate,
  BrokerErrorBody,
  BrokerErrorCode,
  Holding,
  LoginUrl,
  Margins,
  Me,
  PayoffResponse,
  Position,
  SessionStatus,
} from "@/types/api";

export const BROKER_SESSION_EXPIRED = "BROKER_SESSION_EXPIRED";
export const BROKER_NOT_CONNECTED = "BROKER_NOT_CONNECTED";
export const BROKER_CALL_FAILED = "BROKER_CALL_FAILED";

/** Event fired when a broker needs (re)authorising, so any listener can react. */
export const BROKER_SESSION_LOST_EVENT = "moneyplant:broker-session-lost";

export interface BrokerSessionLostDetail {
  brokerId: string | null;
  code: BrokerErrorCode;
}

/** Thrown by every non-2xx response from the API layer. */
export class ApiError extends Error {
  status: number;
  code?: string;
  brokerId?: string | null;
  body?: unknown;

  constructor(
    status: number,
    message: string,
    code?: string,
    brokerId?: string | null,
    body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.brokerId = brokerId;
    this.body = body;
  }
}

/**
 * The broker needs authorising — either the token died or it was never linked.
 * Both are fixed by the same button, so callers rarely need to tell them apart.
 */
export function isBrokerSessionError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.code === BROKER_SESSION_EXPIRED || err.code === BROKER_NOT_CONNECTED)
  );
}

/** Upstream broker problem. Do NOT prompt to reconnect — it fixes nothing. */
export function isBrokerCallFailed(err: unknown): boolean {
  return err instanceof ApiError && err.code === BROKER_CALL_FAILED;
}

export function brokerIdOf(err: unknown): string | null {
  return err instanceof ApiError ? err.brokerId ?? null : null;
}

export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/**
 * Redirect the whole document to the login page.
 * Guarded so a 401 while already on /login (or a public page) cannot loop.
 */
function redirectToLogin() {
  const path = window.location.pathname;
  if (path === "/login" || path === "/") return;
  window.location.assign("/login");
}

function emitBrokerSessionLost(detail: BrokerSessionLostDetail) {
  window.dispatchEvent(
    new CustomEvent<BrokerSessionLostDetail>(BROKER_SESSION_LOST_EVENT, { detail })
  );
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const res = await fetch(path, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...rest,
  });

  // App-auth failure: bounce to login for any /api call.
  if (res.status === 401) {
    redirectToLogin();
    throw new ApiError(401, "Not authenticated");
  }

  // Broker failures from ApiExceptionHandler. 409 = needs authorising,
  // 502 = upstream broker problem. Only the single-connection endpoints get
  // here; the aggregate endpoints report partial failure as 200 + warnings.
  if (res.status === 409 || res.status === 502) {
    const parsed = (await parseBody(res)) as BrokerErrorBody | undefined;
    const code = parsed?.error;
    const brokerId = parsed?.brokerId ?? null;

    if (code === BROKER_SESSION_EXPIRED || code === BROKER_NOT_CONNECTED) {
      emitBrokerSessionLost({ brokerId, code });
      throw new ApiError(res.status, parsed?.message ?? "Broker not authorised", code, brokerId, parsed);
    }

    if (code === BROKER_CALL_FAILED) {
      throw new ApiError(res.status, parsed?.message ?? "Broker call failed", code, brokerId, parsed);
    }

    throw new ApiError(res.status, `Request failed (${res.status})`, undefined, null, parsed);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const parsed = await parseBody(res);
    throw new ApiError(res.status, `Request failed (${res.status})`, undefined, null, parsed);
  }

  return (await parseBody(res)) as T;
}

/** Typed API surface. Every path matches the fixed backend contract. */
export const api = {
  me: () => request<Me>("/api/me"),
  sessionStatus: () => request<SessionStatus>("/api/session/status"),
  loginUrl: () => request<LoginUrl>("/api/session/login-url"),
  // Aggregate endpoints: partial broker failures arrive as 200 + warnings.
  positions: () => request<BrokerAggregate<Position>>("/api/positions"),
  holdings: () => request<BrokerAggregate<Holding>>("/api/holdings"),
  margins: () => request<BrokerAggregate<Margins>>("/api/margins"),
  payoffUnderlyings: () => request<string[]>("/api/payoff"),
  payoff: (underlying: string) =>
    request<PayoffResponse>(`/api/payoff/${encodeURIComponent(underlying)}`),
  logout: () => request<void>("/api/logout", { method: "POST" }),
};
