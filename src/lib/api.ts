import type {
  Holding,
  LoginUrl,
  Margins,
  Me,
  Position,
  SessionStatus,
} from "@/types/api";

export const KITE_SESSION_EXPIRED = "KITE_SESSION_EXPIRED";

/** Thrown by every non-2xx response from the API layer. */
export class ApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;

  constructor(status: number, message: string, code?: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export function isKiteSessionExpired(err: unknown): boolean {
  return err instanceof ApiError && err.code === KITE_SESSION_EXPIRED;
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

/**
 * Broadcast a Kite-session-expired signal so a top-level listener can surface
 * the "Connect Kite" banner regardless of which query failed.
 */
function emitKiteExpired() {
  window.dispatchEvent(new CustomEvent("moneyplant:kite-expired"));
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

  // Broker-auth failure: surface the Connect Kite flow instead of an error.
  if (res.status === 409) {
    const parsed = (await parseBody(res)) as { error?: string } | undefined;
    if (parsed?.error === KITE_SESSION_EXPIRED) {
      emitKiteExpired();
      throw new ApiError(409, "Kite session expired", KITE_SESSION_EXPIRED, parsed);
    }
    throw new ApiError(409, "Conflict", undefined, parsed);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const parsed = await parseBody(res);
    throw new ApiError(res.status, `Request failed (${res.status})`, undefined, parsed);
  }

  return (await parseBody(res)) as T;
}

/** Typed API surface. Every path matches the fixed backend contract. */
export const api = {
  me: () => request<Me>("/api/me"),
  sessionStatus: () => request<SessionStatus>("/api/session/status"),
  loginUrl: () => request<LoginUrl>("/api/session/login-url"),
  positions: () => request<Position[]>("/api/positions"),
  holdings: () => request<Holding[]>("/api/holdings"),
  margins: () => request<Margins>("/api/margins"),
  logout: () => request<void>("/api/logout", { method: "POST" }),
};
