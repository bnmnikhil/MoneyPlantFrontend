import assert from "node:assert/strict";
import test from "node:test";
import {
  brokerInitials,
  brokerName,
  credentialFields,
  definitionById,
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

  const fields = credentialFields(definitions[0]);
  assert.equal(fields.length, 2);
  assert.equal(fields[0].label, "Client ID");
  assert.equal(fields[1].secret, true);
});

/**
 * The old `fieldByKey(definition, "apiKey")` threw when a broker's catalogue
 * named anything else, which crashed the credential card on render and
 * defeated the point of `credentialFields` being a list. Iterating whatever the
 * catalogue supplies is the fix, so the shape that used to throw must now
 * simply render two differently-named boxes.
 */
test("a broker with neither apiKey nor apiSecret still yields its fields", () => {
  const tokenBroker = {
    ...definitions[0],
    id: "tokenly",
    displayName: "Tokenly",
    authType: "ACCESS_TOKEN",
    credentialFields: [
      { key: "accessToken", label: "Access token", secret: true, required: true },
      { key: "totp", label: "TOTP seed", secret: true, required: false },
    ],
  };

  const fields = credentialFields(tokenBroker);
  assert.deepEqual(
    fields.map((field) => field.label),
    ["Access token", "TOTP seed"]
  );
});

test("credentialFields tolerates a definition with no fields at all", () => {
  assert.deepEqual(credentialFields({ ...definitions[0], credentialFields: undefined }), []);
});

test("broker marks are derived from the display name, not configured", () => {
  assert.equal(brokerInitials("Zerodha Kite"), "ZK");
  assert.equal(brokerInitials("Alice Blue"), "AB");
  assert.equal(brokerInitials("Paytm Money"), "PM");
  assert.equal(brokerInitials("Upstox"), "UP");
  assert.equal(brokerInitials(""), "??");
});
