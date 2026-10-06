import type {
  BrokerConnection,
  BrokerCredential,
  BrokerCredentialInput,
  BrokerDefinition,
} from "@/types/api";

/** Mirrors the backend's path-segment constraint, so the error arrives before the request. */
export const LABEL_PATTERN = /^[A-Za-z0-9 _-]{1,32}$/;

/** The label the backend assumes when a user never names a registration. */
export const DEFAULT_LABEL = "default";

/** One broker's stored registrations, ready to render as a group. */
export interface BrokerGroupModel {
  definition: BrokerDefinition;
  registrations: BrokerCredential[];
}

/**
 * Stored registrations, grouped by broker, in the catalogue's own order.
 *
 * Two filters, both deliberate. `configured` drops the placeholder rows
 * /api/broker-credentials returns for brokers the user has *not* set up — those
 * populate the Add dropdown, not the list. And a row whose broker has no
 * catalogue entry is dropped rather than rendered under a raw broker id: the
 * backend refuses to start in that state, so on a live system it cannot happen,
 * and a stale cached credential list is not worth a mystery row.
 */
export function groupRegistrations(
  credentials: BrokerCredential[],
  definitions: BrokerDefinition[]
): BrokerGroupModel[] {
  const groups: BrokerGroupModel[] = [];
  for (const definition of definitions) {
    const registrations = credentials.filter(
      (credential) => credential.configured && credential.brokerId === definition.id
    );
    if (registrations.length > 0) groups.push({ definition, registrations });
  }
  return groups;
}

/**
 * Brokers the Add panel offers.
 *
 * Every broker the backend returned, including ones already set up — picking one
 * of those adds a second developer app, which is what the old per-broker "Add
 * another registration" button did. Collapsing both into one list is what lets
 * that button go away.
 *
 * <b>No rollout filter here.</b> The backend owns rollout state (FOUND-06) and
 * returns only brokers usable in this deployment, so a STAGING-state broker
 * arrives on staging and never reaches production's browser. Filtering on
 * AVAILABLE again on the client would hide it on staging, where it is meant to
 * be soaked, and would be a second copy of a rule that must have one owner.
 */
export function addableBrokers(definitions: BrokerDefinition[]): BrokerDefinition[] {
  return [...definitions];
}

/** Labels already used at this broker — the set a new registration must avoid. */
export function labelsFor(credentials: BrokerCredential[], brokerId: string): string[] {
  return credentials
    .filter((credential) => credential.configured && credential.brokerId === brokerId)
    .map((credential) => credential.label);
}

/**
 * Whether the Add panel must ask for a registration name.
 *
 * Only when that broker already has one. A user's first registration anywhere
 * takes the backend's `default` label silently, because naming a thing you own
 * exactly one of implies a choice that has not been made.
 */
export function needsRegistrationName(
  credentials: BrokerCredential[],
  brokerId: string
): boolean {
  return labelsFor(credentials, brokerId).length > 0;
}

export type AccountState = "connected" | "reconnect";

export interface AccountStatus {
  connectionId: string;
  accountLabel: string;
  state: AccountState;
}

/**
 * The accounts one registration has authorised, each with its live state.
 *
 * `connected` is the field this page used to ignore, printing every account as
 * "Linked" whether or not its token still worked — while the header, which does
 * read it, showed the same user "Partial". Two surfaces, opposite answers.
 */
export function accountsFor(
  connections: BrokerConnection[],
  brokerId: string,
  label: string
): AccountStatus[] {
  return connections
    .filter(
      (connection) =>
        connection.brokerId === brokerId && connection.credentialLabel === label
    )
    .map((connection) => ({
      connectionId: connection.connectionId,
      accountLabel: connection.accountLabel,
      state: connection.connected ? "connected" : "reconnect",
    }));
}

/**
 * Catalogue-keyed form values to the wire body.
 *
 * The single place the two vocabularies meet. `credentialFields` is open-ended
 * by design, but `PUT /api/broker-credentials/{brokerId}/{label}` still takes
 * exactly `apiKey` and `apiSecret` — so a broker whose catalogue names other
 * keys needs a *contract* change, and this function is where that shows up as a
 * missing value rather than as a silently empty secret.
 */
export function toCredentialInput(values: Record<string, string>): BrokerCredentialInput {
  // FOUND-03: an optional clientId for the brokers that need one (Dhan). Sent only when
  // typed, because the backend refuses one for a broker that does not declare it, so a
  // stale value carried across brokers fails loudly instead of being stored.
  const clientId = (values.clientId ?? "").trim();
  return {
    apiKey: (values.apiKey ?? "").trim(),
    apiSecret: (values.apiSecret ?? "").trim(),
    ...(clientId ? { clientId } : {}),
  };
}

/** Every required field filled. Blank-means-unchanged is not offered: see BrokerCredentialForm. */
export function isComplete(
  definition: BrokerDefinition,
  values: Record<string, string>
): boolean {
  return (definition.credentialFields ?? [])
    .filter((field) => field.required)
    .every((field) => (values[field.key] ?? "").trim() !== "");
}

/** Why a proposed registration name is unusable, or null when it is fine. */
export function labelProblem(
  raw: string,
  existingLabels: string[]
): "empty" | "invalid" | "taken" | null {
  const label = raw.trim();
  if (label === "") return "empty";
  if (!LABEL_PATTERN.test(label)) return "invalid";
  if (existingLabels.includes(label)) return "taken";
  return null;
}
