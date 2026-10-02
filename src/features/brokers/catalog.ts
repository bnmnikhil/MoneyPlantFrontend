import type { BrokerDefinition, CredentialField } from "@/types/api";

/**
 * Labels are installed from the backend-owned catalogue when AppShell loads.
 * The fallback keeps first-paint content readable without reintroducing a
 * broker-id switch in every component.
 */
const labels = new Map<string, string>();

export function installBrokerDefinitions(definitions: BrokerDefinition[]) {
  labels.clear();
  for (const definition of definitions) labels.set(definition.id, definition.displayName);
}

export function brokerName(brokerId: string) {
  return labels.get(brokerId) ?? brokerId;
}

export function definitionById(definitions: BrokerDefinition[], brokerId: string) {
  return definitions.find((definition) => definition.id === brokerId);
}

/**
 * The fields this broker's registration form should render, in catalogue order.
 *
 * Replaces the old `fieldByKey(definition, "apiKey" | "apiSecret")`, which threw
 * when either key was absent. That lookup defeated the catalogue it read from:
 * `credentialFields` is a list precisely so a broker can need something other
 * than a key and a secret, and `BrokerAuthType` already admits `ACCESS_TOKEN`.
 * The first such broker crashed the card on render. Iterating cannot.
 */
export function credentialFields(definition: BrokerDefinition): CredentialField[] {
  return definition.credentialFields ?? [];
}

/**
 * Two letters for a broker's tile, derived rather than configured.
 *
 * "Zerodha Kite" gives ZK, "Alice Blue" AB, "Paytm Money" PM. A new broker
 * therefore needs no frontend change to get a mark, which is the same rule
 * `BrokerRegistry` enforces on the backend. Real broker logos are deliberately
 * not used: they are third-party marks with their own usage terms.
 */
export function brokerInitials(displayName: string) {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
