import type {
  BrokerAggregate,
  BrokerCredential,
  BrokerCredentialInput,
  BrokerErrorBody,
  BrokerErrorCode,
  Holding,
  LoginUrl,
  Margins,
  Me,
  CurveRef,
  PayoffResponse,
  Position,
  SessionStatus,
} from "@/types/api";

export const BROKER_SESSION_EXPIRED = "BROKER_SESSION_EXPIRED";
export const BROKER_NOT_CONNECTED = "BROKER_NOT_CONNECTED";
export const BROKER_CALL_FAILED = "BROKER_CALL_FAILED";
export const BROKER_NOT_CONFIGURED = "BROKER_NOT_CONFIGURED";
export const BROKER_CREDENTIAL_UNREADABLE = "BROKER_CREDENTIAL_UNREADABLE";

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

/**
 * No usable credentials for this broker — never stored, or stored and now
 * undecryptable after a key rotation.
 *
 * Deliberately not folded into isBrokerSessionError: that one is fixed by
 * pressing Connect, and this one cannot be. Offering Connect here sends the user
 * through a broker round trip that fails at the last step.
 */
export function isBrokerNotConfigured(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.code === BROKER_NOT_CONFIGURED || err.code === BROKER_CREDENTIAL_UNREADABLE)
  );
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

/**
 * Spring Security hands the CSRF token over as a JS-readable XSRF-TOKEN cookie
 * and expects it echoed back in X-XSRF-TOKEN. Only mutating verbs are checked,
 * so reads skip it entirely.
 *
 * This is belt-and-braces: the session cookie is SameSite=Lax, which already
 * stops a cross-site POST from carrying credentials. Kept because the app drives
 * a live brokerage account, where one layer of defence is not enough.
 */
function csrfHeader(method: string | undefined): Record<string, string> {
  const verb = (method ?? "GET").toUpperCase();
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") return {};

  const prefix = "XSRF-TOKEN=";
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(prefix))
    ?.slice(prefix.length);

  return raw ? { "X-XSRF-TOKEN": decodeURIComponent(raw) } : {};
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const res = await fetch(path, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...csrfHeader(rest.method),
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

    // 3d. Deliberately does NOT fire the session-lost event: that event drives
    // the reconnect banner, and reconnecting cannot fix a missing or
    // undecryptable credential. The caller routes to Settings instead.
    if (code === BROKER_NOT_CONFIGURED || code === BROKER_CREDENTIAL_UNREADABLE) {
      throw new ApiError(
        res.status,
        parsed?.message ?? "Broker credentials are not configured",
        code,
        brokerId,
        parsed
      );
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
/**
 * A registration's path. The label is a path segment on the backend, which
 * constrains it to letters, digits, spaces, hyphens and underscores — so the
 * only thing needing encoding here is a space.
 */
function credentialPath(brokerId: string, label: string) {
  return `/api/broker-credentials/${encodeURIComponent(brokerId)}/${encodeURIComponent(label)}`;
}

export const api = {
  me: () => request<Me>("/api/me"),
  sessionStatus: () => request<SessionStatus>("/api/session/status"),
  loginUrl: (brokerId: string, label?: string) =>
    request<LoginUrl>(
      `/api/session/login-url?brokerId=${encodeURIComponent(brokerId)}` +
        (label ? `&label=${encodeURIComponent(label)}` : "")
    ),
  // Aggregate endpoints: partial broker failures arrive as 200 + warnings.
  positions: () => request<BrokerAggregate<Position>>("/api/positions"),
  holdings: () => request<BrokerAggregate<Holding>>("/api/holdings"),
  margins: () => request<BrokerAggregate<Margins>>("/api/margins"),
  // Payoff is per connection, not global: the same underlying can be held at
  // two brokers and each gets its own curve, so the connectionId is required.
  payoffCurves: () => request<CurveRef[]>("/api/payoff"),
  payoff: (connectionId: string, underlying: string) =>
    request<PayoffResponse>(
      `/api/payoff/${encodeURIComponent(underlying)}?connectionId=${encodeURIComponent(connectionId)}`
    ),
  // Per-user broker API credentials (3d). The GET never carries a secret; the
  // PUT is the only direction one ever travels.
  brokerCredentials: () => request<BrokerCredential[]>("/api/broker-credentials"),
  saveBrokerCredential: (brokerId: string, label: string, body: BrokerCredentialInput) =>
    request<void>(credentialPath(brokerId, label), { method: "PUT", body }),
  deleteBrokerCredential: (brokerId: string, label: string) =>
    request<void>(credentialPath(brokerId, label), { method: "DELETE" }),
  logout: () => request<void>("/api/logout", { method: "POST" }),
};
