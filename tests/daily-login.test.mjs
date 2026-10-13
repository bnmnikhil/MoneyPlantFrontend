import test from "node:test";
import assert from "node:assert/strict";
import { loginRows, loginNote, sessionStatusLabel, todayInIndia } from "../src/features/session/dailyLogin.ts";

const names = { kite: "Zerodha Kite", paytm: "Paytm Money", upstox: "Upstox" };
const nameOf = (id) => names[id] ?? id;

test("one row per registration still to log in, labelled only when a broker has several", () => {
  const rows = loginRows([
    { brokerId: "kite", pending: ["default", "family"], named: true },
    { brokerId: "paytm", pending: ["default"], named: false },
    { brokerId: "upstox", pending: [], named: false },
  ], nameOf);

  assert.deepEqual(rows.map((r) => r.title), ["Zerodha Kite · default", "Zerodha Kite · family", "Paytm Money"]);
  // The label is always carried for login-url, even when it is not shown.
  assert.deepEqual(rows.map((r) => r.label), ["default", "family", "default"]);
});

test("Paytm warns about its daily password and OTP; the others say they come straight back", () => {
  assert.match(loginNote("paytm", "Paytm Money"), /password and an OTP/);
  assert.equal(loginNote("upstox", "Upstox"), "Opens Upstox, then comes straight back");
});

test("the date is India's, so it does not lag a day for a browser set to UTC", () => {
  // 13 Oct 2026, 20:00 UTC is already 14 Oct in IST.
  assert.match(todayInIndia(new Date("2026-10-13T20:00:00Z")), /^Wednesday,? 14 October$/);
});

test("the header says nothing is logged in, rather than Offline", () => {
  const base = { pending: false, error: false, allConnected: false, anyConnected: false };
  assert.deepEqual(sessionStatusLabel({ ...base, configured: true }), { label: "Not logged in", tone: "neutral" });
  assert.deepEqual(sessionStatusLabel({ ...base, configured: false }), { label: "No brokers yet", tone: "neutral" });
  assert.deepEqual(sessionStatusLabel({ ...base, configured: true, anyConnected: true }), { label: "Partial", tone: "partial" });
  assert.deepEqual(sessionStatusLabel({ ...base, configured: true, anyConnected: true, allConnected: true }), { label: "Live", tone: "live" });
  assert.equal(sessionStatusLabel({ ...base, configured: true, pending: true }).label, "Checking");
});
