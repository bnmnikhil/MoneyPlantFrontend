import test from "node:test";
import assert from "node:assert/strict";
import {
  applyStagingChrome,
  isStagingEnvironment,
  STAGING_BANNER_TEXT,
  STAGING_FAVICON,
  STAGING_TITLE_PREFIX,
} from "../src/lib/environment.ts";

test("only an explicit staging value turns the staging build on", () => {
  assert.equal(isStagingEnvironment("staging"), true);
  assert.equal(isStagingEnvironment(" Staging "), true);
  assert.equal(isStagingEnvironment(undefined), false);
  assert.equal(isStagingEnvironment(""), false);
  assert.equal(isStagingEnvironment("production"), false);
  assert.equal(isStagingEnvironment("stagingx"), false);
});

test("the banner says what staging is", () => {
  assert.match(STAGING_BANNER_TEXT, /simulated brokers/);
  assert.match(STAGING_BANNER_TEXT, /no real data/);
});

test("the title and favicon change once, however often it runs", () => {
  const attrs = {};
  const doc = {
    title: "GoldenBook",
    querySelector: () => ({ setAttribute: (k, v) => { attrs[k] = v; } }),
  };
  applyStagingChrome(doc);
  applyStagingChrome(doc);
  assert.equal(doc.title, STAGING_TITLE_PREFIX + "GoldenBook");
  assert.equal(attrs.href, STAGING_FAVICON);
});
