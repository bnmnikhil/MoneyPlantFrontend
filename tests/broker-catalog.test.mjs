import assert from "node:assert/strict";
import test from "node:test";
import {
  brokerName,
  definitionById,
  fieldByKey,
  installBrokerDefinitions,
} from "../src/features/brokers/catalog.ts";

const definitions = [
  {
    id: "upstox",
    displayName: "Upstox",
    developerConsoleUrl: "https://example.test/upstox",
    authType: "REDIRECT_CALLBACK",
    credentialFields: [
      { key: "apiKey", label: "Client ID", secret: false, required: true },
      { key: "apiSecret", label: "Client secret", secret: true, required: true },
    ],
    capabilities: ["POSITIONS", "HOLDINGS"],
    availability: "INTERNAL",
  },
];

test("backend definitions drive labels and credential field names", () => {
  installBrokerDefinitions(definitions);

  assert.equal(brokerName("upstox"), "Upstox");
  assert.equal(brokerName("unknown"), "unknown");
  assert.equal(definitionById(definitions, "upstox"), definitions[0]);
  assert.equal(fieldByKey(definitions[0], "apiKey").label, "Client ID");
  assert.equal(fieldByKey(definitions[0], "apiSecret").secret, true);
});

test("missing credential metadata fails loudly instead of guessing a field", () => {
  assert.throws(() => fieldByKey(definitions[0], "totp"), /upstox.*totp/);
});
