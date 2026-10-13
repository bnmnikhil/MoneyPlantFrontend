import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// The real SetupGuide, rendered on the server: what a user reads, not pixels.
function component(file, name = file) {
  const result = buildSync({
    entryPoints: [fileURLToPath(new URL(`../src/features/credentials/${file}.tsx`, import.meta.url))],
    bundle: true, platform: "node", format: "cjs", packages: "external", write: false, logLevel: "silent",
  });
  const loaded = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, createRequire(import.meta.url));
  return loaded.exports[name];
}
const SetupGuide = component("SetupGuide");
const render = (props) => renderToStaticMarkup(React.createElement(SetupGuide, props));

const dhan = {
  id: "dhan",
  displayName: "Dhan",
  developerConsoleUrl: "https://web.dhan.co/",
  authType: "REDIRECT_CALLBACK",
  credentialFields: [],
  capabilities: ["POSITIONS", "HOLDINGS"],
  availability: "AVAILABLE",
  setup: {
    notes: ["Live prices need Dhan's Data API, ₹499 + GST a month."],
    steps: ["Log in to Dhan.", "Generate a new key.", "Copy the API key and API secret."],
  },
  redirectUrl: "https://goldenbook.in/dhan/callback",
};

test("an open guide puts the notes before step 1, then the steps, then the redirect URL", () => {
  const html = render({ definition: dhan, defaultOpen: true });

  const note = html.indexOf("₹499");
  const first = html.indexOf("Log in to Dhan.");
  const last = html.indexOf("Copy the API key and API secret.");
  const url = html.indexOf("https://goldenbook.in/dhan/callback");
  assert.ok(note > -1 && first > note, "the cost is read before the first step");
  assert.ok(last > first && url > last, "the redirect URL follows the steps");
  assert.match(html, /Before you start/);
  assert.match(html, /Open Dhan developer portal/);
  assert.match(html, /Copy/);
  assert.match(html, /aria-expanded="true"/);
});

test("a folded guide says what it holds and shows none of it", () => {
  const html = render({ definition: dhan, defaultOpen: false });

  assert.match(html, /How to get these from Dhan/);
  assert.match(html, /3 steps · redirect URL/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /Log in to Dhan\./);
  assert.doesNotMatch(html, /goldenbook\.in\/dhan\/callback/);
});

test("a guide with no notes shows no empty callout", () => {
  const html = render({ definition: { ...dhan, setup: { notes: [], steps: ["One."] } }, defaultOpen: true });

  assert.doesNotMatch(html, /Before you start/);
  assert.match(html, /One\./);
});

test("an older backend that sends no guide renders nothing rather than failing", () => {
  const { setup, redirectUrl, ...older } = dhan;
  assert.equal(render({ definition: older, defaultOpen: true }), "");
});
