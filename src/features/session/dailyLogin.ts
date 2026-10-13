/**
 * What the Overview shows before any broker is logged in today (N16).
 *
 * Broker logins end every night, so for a returning user this is a daily step,
 * not setup: one even row per registration, each with its own Log in button.
 * Pure, so the wording is tested without rendering.
 */

export interface PendingRegistration {
  brokerId: string;
  /** Registration labels with no live account. */
  pending: string[];
  /** More than one registration at this broker, so the label is shown. */
  named: boolean;
}

export interface LoginRow {
  brokerId: string;
  /** Always sent to login-url, even when not shown. */
  label: string;
  title: string;
  note: string;
}

/** One row per registration still to log in, in the order the brokers come. */
export function loginRows(state: PendingRegistration[], nameOf: (brokerId: string) => string): LoginRow[] {
  return state.flatMap(({ brokerId, pending, named }) => pending.map((label) => {
    const name = nameOf(brokerId);
    return { brokerId, label, title: named ? `${name} · ${label}` : name, note: loginNote(brokerId, name) };
  }));
}

/**
 * What a login asks of the user. Paytm Money is the one that differs: a password
 * and an OTP every time, with no refresh token. Every other broker is one
 * redirect to its own page and back.
 */
export function loginNote(brokerId: string, name: string): string {
  return brokerId === "paytm"
    ? "Asks for your password and an OTP every day"
    : `Opens ${name}, then comes straight back`;
}

/** "Tuesday, 13 October", in IST, where broker logins end at midnight. */
export function todayInIndia(now: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata",
  }).format(now);
}

export type SessionTone = "neutral" | "partial" | "live";

/**
 * The header's broker-session pill. "Offline" read as "the app or the network is
 * down"; with nothing logged in yet today it says so instead.
 */
export function sessionStatusLabel(input: {
  pending: boolean; error: boolean; configured: boolean; allConnected: boolean; anyConnected: boolean;
}): { label: string; tone: SessionTone } {
  if (input.pending) return { label: "Checking", tone: "neutral" };
  if (input.error) return { label: "Unavailable", tone: "neutral" };
  if (input.allConnected) return { label: "Live", tone: "live" };
  if (input.anyConnected) return { label: "Partial", tone: "partial" };
  return { label: input.configured ? "Not logged in" : "No brokers yet", tone: "neutral" };
}
