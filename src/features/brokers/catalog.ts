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

export function fieldByKey(definition: BrokerDefinition, key: string): CredentialField {
  const field = definition.credentialFields.find((candidate) => candidate.key === key);
  if (!field) throw new Error(`${definition.id} has no credential field '${key}'`);
  return field;
}
