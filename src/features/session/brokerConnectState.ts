import { useBrokerStatus } from "@/features/session/hooks";
import { useBrokerCredentials } from "@/features/credentials/hooks";
import type { BrokerConnection } from "@/types/api";

/**
 * One broker, with its live accounts and whatever is left to connect.
 *
 * `accounts` and `pending` are two different axes and the distinction is the
 * whole point of this file. A *registration* is a developer app the user created
 * at the broker; an *account* is a login that app authorised. One registration
 * can authorise several accounts, so the two cannot be counted together.
 */
export interface BrokerConnectState {
  brokerId: string;
  /** Live accounts, in the backend's order (brokerId then accountLabel). */
  accounts: BrokerConnection[];
  /**
   * Registration labels with no live account. These are the only ones worth
   * offering Connect for — a registration that already has an account connected
   * has nothing left to do, which is what makes the buttons disappear once
   * everything is linked.
   */
  pending: string[];
  /**
   * True when this broker has more than one registration, so naming one
   * distinguishes something. With a single registration the name is noise: the
   * user never chose it.
   */
  named: boolean;
}

/**
 * Joins /api/session/status to /api/broker-credentials on `credentialLabel`.
 *
 * Both queries are shared with the rest of the app, so this costs no extra
 * request wherever it is used.
 *
 * The join is the reason `credentialLabel` exists on a connection at all.
 * Without it there is no way to tell a registration that is already in use from
 * one that has never been connected, and the honest rendering is then a Connect
 * button per registration forever — which is exactly what it used to do.
 */
export function useBrokerConnectState() {
  const { brokers, connections, isLoading } = useBrokerStatus();
  const credentials = useBrokerCredentials();

  const configured = (credentials.data ?? []).filter((c) => c.configured);

  // Connections first so a broker whose credentials were deleted mid-session
  // still renders its live accounts rather than vanishing from the row.
  const brokerIds = [
    ...new Set([...connections.map((c) => c.brokerId), ...brokers]),
  ].sort();

  const state: BrokerConnectState[] = brokerIds.map((brokerId) => {
    const accounts = connections.filter((c) => c.brokerId === brokerId);
    const labels = configured
      .filter((c) => c.brokerId === brokerId)
      .map((c) => c.label);

    // /api/session/status lists a broker only when the user has credentials for
    // it, so an empty list here means the two queries disagree for one poll.
    // "default" is the registration every user starts with.
    const known = labels.length > 0 ? labels : ["default"];
    const live = new Set(accounts.map((a) => a.credentialLabel));

    return {
      brokerId,
      accounts,
      // Nothing offered until the credential query has answered. A wrong Connect
      // chip for a fraction of a second is worse than none: it invites a click
      // that starts a broker round trip the user did not need.
      pending: credentials.isPending ? [] : known.filter((l) => !live.has(l)),
      named: known.length > 1,
    };
  });

  return { state, isLoading };
}
