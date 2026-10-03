import test from "node:test";
import assert from "node:assert/strict";
import { loginErrorMessage } from "../src/features/session/loginErrors.ts";

test("closed sign-up distinguishes existing accounts from new registrations", () => {
  assert.match(loginErrorMessage("signup_closed"), /Existing users can still sign in/);
});

test("disabled, unverified and unavailable sign-in have actionable messages", () => {
  assert.match(loginErrorMessage("account_disabled"), /Contact support/);
  assert.match(loginErrorMessage("email_unverified"), /verified email/);
  assert.match(loginErrorMessage("auth_unavailable"), /try again later/);
  assert.match(loginErrorMessage("not_invited"), /invite list/);
});

test("unknown provider errors never appear in the page", () => {
  assert.equal(loginErrorMessage(null), null);
  assert.equal(loginErrorMessage("provider-secret-detail"), "Sign-in did not complete. Please try again.");
});
