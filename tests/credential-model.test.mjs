import assert from "node:assert/strict";
import test from "node:test";
import {
  accountsFor,
  addableBrokers,
  groupRegistrations,
  isComplete,
  labelProblem,
  labelsFor,
  needsRegistrationName,
  toCredentialInput,
} from "../src/features/credentials/model.ts";

const keyAndSecret = (keyLabel) => [
  { key: "apiKey", label: keyLabel, secret: false, required: true },
  { key: "apiSecret", label: "API secret", secret: true, required: true },
];

const definitions = [
  {
    id: "aliceblue",
    displayName: "Alice Blue",
    developerConsoleUrl: "https://ant.aliceblueonline.com/",
    authType: "REDIRECT_CALLBACK",
    credentialFields: keyAndSecret("App code"),
    capabilities: ["POSITIONS"],
    availability: "AVAILABLE",
  },
  {
    id: "kite",
    displayName: "Zerodha Kite",
    developerConsoleUrl: "https://developers.kite.trade/",
    authType: "REDIRECT_CALLBACK",
    credentialFields: keyAndSecret("API key"),
    capabilities: ["POSITIONS"],
    availability: "AVAILABLE",
  },
  {
    id: "hidden",
    displayName: "Not Shipped",
    developerConsoleUrl: "https://example.test/",
    authType: "REDIRECT_CALLBACK",
    credentialFields: keyAndSecret("API key"),
    capabilities: [],
    availability: "INTERNAL",
  },
];

const credentials = [
  { brokerId: "kite", label: "default", apiKey: "abc123xx7f2a", configured: true },
  { brokerId: "kite", label: "HUF", apiKey: "zzz999xxb104", configured: true },
  { brokerId: "aliceblue", label: "default", apiKey: "AAA0000A19C", configured: true },
  // The credentials endpoint returns one of these per unconfigured broker.
  { brokerId: "paytm", label: "default", apiKey: null, configured: false },
];

test("only configured rows are listed, and only under a known broker", () => {
  const groups = groupRegistrations(credentials, definitions);

  assert.deepEqual(
    groups.map((group) => group.definition.id),
    ["aliceblue", "kite"],
    "catalogue order, and the unconfigured paytm placeholder is not a group"
  );
  assert.deepEqual(
    groups[1].registrations.map((row) => row.label),
    ["default", "HUF"]
  );
});

test("a credential for a broker with no catalogue entry is dropped, not rendered raw", () => {
  const orphan = [{ brokerId: "ghost", label: "default", apiKey: "k", configured: true }];
  assert.deepEqual(groupRegistrations(orphan, definitions), []);
});

/**
 * The dropdown keeps brokers that are already set up. That is what lets the
 * per-broker "Add another registration" button go away: adding a second
 * developer app at Kite is the same act as adding a first one at Paytm.
 */
test("the dropdown offers every broker the backend returned, set up or not", () => {
  // Rollout state is the backend's rule (FOUND-06): it returns only brokers usable in
  // this deployment, so whatever arrives is offered, preview states included.
  assert.deepEqual(
    addableBrokers(definitions).map((definition) => definition.id),
    definitions.map((definition) => definition.id)
  );
});

test("the dropdown does not mutate or reorder what the backend sent", () => {
  const before = definitions.map((definition) => definition.id);
  addableBrokers(definitions).reverse();
  assert.deepEqual(definitions.map((definition) => definition.id), before);
});

test("a registration name is asked for only when that broker already has one", () => {
  assert.equal(needsRegistrationName(credentials, "kite"), true);
  assert.equal(needsRegistrationName(credentials, "aliceblue"), true);
  assert.equal(needsRegistrationName(credentials, "paytm"), false,
    "an unconfigured placeholder is not an existing registration");
  assert.deepEqual(labelsFor(credentials, "kite"), ["default", "HUF"]);
});

test("a proposed registration name is checked before the request goes out", () => {
  assert.equal(labelProblem("", ["default"]), "empty");
  assert.equal(labelProblem("   ", ["default"]), "empty");
  assert.equal(labelProblem("HUF/2", ["default"]), "invalid", "path separators are refused");
  assert.equal(labelProblem("x".repeat(33), ["default"]), "invalid");
  assert.equal(labelProblem(" default ", ["default"]), "taken", "trimmed before comparison");
  assert.equal(labelProblem("Family", ["default"]), null);
});

/**
 * The bug this page shipped with: `connected` was never read, so a dead token
 * rendered exactly like a live one — while the header, which does read it,
 * showed the same user "Partial".
 */
test("accounts carry their live state, per registration", () => {
  const connections = [
    { connectionId: "u:kite:default#1", brokerId: "kite", accountLabel: "ZG1234", credentialLabel: "default", connected: true },
    { connectionId: "u:kite:default#2", brokerId: "kite", accountLabel: "ZG9981", credentialLabel: "default", connected: false },
    { connectionId: "u:kite:HUF#1", brokerId: "kite", accountLabel: "ZH0001", credentialLabel: "HUF", connected: true },
    { connectionId: "u:ab:default#1", brokerId: "aliceblue", accountLabel: "AB44021", credentialLabel: "default", connected: true },
  ];

  assert.deepEqual(accountsFor(connections, "kite", "default"), [
    { connectionId: "u:kite:default#1", accountLabel: "ZG1234", state: "connected" },
    { connectionId: "u:kite:default#2", accountLabel: "ZG9981", state: "reconnect" },
  ]);
  assert.deepEqual(
    accountsFor(connections, "kite", "HUF").map((a) => a.accountLabel),
    ["ZH0001"],
    "a second registration at the same broker does not borrow the first's accounts"
  );
  assert.deepEqual(accountsFor(connections, "paytm", "default"), []);
});

test("every required field must be filled, whatever the broker calls them", () => {
  const tokenBroker = {
    ...definitions[0],
    credentialFields: [
      { key: "accessToken", label: "Access token", secret: true, required: true },
      { key: "totp", label: "TOTP seed", secret: true, required: false },
    ],
  };

  assert.equal(isComplete(tokenBroker, {}), false);
  assert.equal(isComplete(tokenBroker, { accessToken: "   " }), false, "whitespace is not a value");
  assert.equal(isComplete(tokenBroker, { accessToken: "t" }), true, "an optional field may stay empty");
  assert.equal(isComplete(definitions[1], { apiKey: "k" }), false, "the secret is always required");
  assert.equal(isComplete(definitions[1], { apiKey: "k", apiSecret: "s" }), true);
});

test("form values are trimmed on their way to the wire body", () => {
  assert.deepEqual(toCredentialInput({ apiKey: " k ", apiSecret: " s " }), {
    apiKey: "k",
    apiSecret: "s",
  });
  assert.deepEqual(toCredentialInput({}), { apiKey: "", apiSecret: "" });
});

// FOUND-03: Dhan's login needs the user's own client id beside the key and secret.
const dhan = {
  id: "dhan",
  displayName: "Dhan",
  developerConsoleUrl: "https://example.test/dhan",
  authType: "REDIRECT_CALLBACK",
  credentialFields: [
    { key: "apiKey", label: "API key", secret: false, required: true },
    { key: "apiSecret", label: "API secret", secret: true, required: true },
    { key: "clientId", label: "Dhan client ID", secret: false, required: true },
  ],
  capabilities: [],
  availability: "STAGING",
};

test("a broker that declares a client id is not complete without one", () => {
  assert.equal(isComplete(dhan, { apiKey: "k", apiSecret: "s" }), false);
  assert.equal(isComplete(dhan, { apiKey: "k", apiSecret: "s", clientId: "  " }), false);
  assert.equal(isComplete(dhan, { apiKey: "k", apiSecret: "s", clientId: "1100000001" }), true);
});

test("the client id goes on the wire only when typed, and trimmed", () => {
  assert.deepEqual(toCredentialInput({ apiKey: "k", apiSecret: "s", clientId: " 1100000001 " }), {
    apiKey: "k",
    apiSecret: "s",
    clientId: "1100000001",
  });
  // Kite's form never has one, so Kite's body is unchanged and carries no clientId key at all.
  const kiteBody = toCredentialInput({ apiKey: "k", apiSecret: "s" });
  assert.equal("clientId" in kiteBody, false);
  assert.equal("clientId" in toCredentialInput({ apiKey: "k", apiSecret: "s", clientId: "" }), false);
});
