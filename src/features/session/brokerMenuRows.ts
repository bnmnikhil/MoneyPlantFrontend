/**
 * The Brokers dropdown, one row per account or registration. Pure, so it is
 * tested without rendering.
 *
 * The status chips this replaces drew every account in `accounts` as connected,
 * including one whose session had expired, so the menu showed a green chip for a
 * dead login with no way to reconnect it. Here an expired account is its own
 * state with a Reconnect action, through the registration that authorised it,
 * the same call Overview's "To fix" makes.
 */
import type { BrokerConnection } from "@/types/api";

export type BrokerMenuStatus = "connected" | "expired" | "pending";

export interface BrokerMenuRow {
  key: string;
  brokerId: string;
  title: string;
  status: BrokerMenuStatus;
  /** The registration to send to login-url; null for a live account. */
  label: string | null;
}

export interface BrokerMenuInput {
  brokerId: string;
  accounts: Pick<BrokerConnection, "connectionId" | "accountLabel" | "credentialLabel" | "connected">[];
  pending: string[];
  named: boolean;
}

export function brokerMenuRows(state: BrokerMenuInput[], nameOf: (brokerId: string) => string): BrokerMenuRow[] {
  return state.flatMap(({ brokerId, accounts, pending, named }) => {
    const name = nameOf(brokerId);
    const accountRows: BrokerMenuRow[] = accounts.map((a) => ({
      key: a.connectionId,
      brokerId,
      title: accounts.length > 1 ? `${name} · ${a.accountLabel}` : name,
      status: a.connected ? "connected" : "expired",
      label: a.connected ? null : a.credentialLabel,
    }));
    const pendingRows: BrokerMenuRow[] = pending.map((label) => ({
      key: `${brokerId}:${label}`,
      brokerId,
      title: named ? `${name} · ${label}` : name,
      status: "pending",
      label,
    }));
    return [...accountRows, ...pendingRows];
  });
}

export const brokerMenuStatusText: Record<BrokerMenuStatus, string> = {
  connected: "Connected",
  expired: "Session expired",
  pending: "Not connected today",
};
