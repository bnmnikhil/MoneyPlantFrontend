import test from "node:test";
import assert from "node:assert/strict";
import { tickerItems } from "../src/features/market/tickerItems.ts";
import { brokerMenuRows } from "../src/features/session/brokerMenuRows.ts";

const names = { paytm: "Paytm Money", aliceblue: "Alice Blue", kite: "Zerodha Kite" };
const nameOf = (id) => names[id] ?? id;

test("a rise is green-toned with the percent in brackets; a fall uses a real minus", () => {
  const [nifty, bank] = tickerItems([
    { underlying: "NIFTY", price: 24812.35, change: 103.2, changePercent: 0.42, source: "paytm" },
    { underlying: "BANKNIFTY", price: 52140.8, change: -94.1, changePercent: -0.18, source: "paytm" },
  ], nameOf);
  assert.deepEqual([nifty.price, nifty.priceWhole, nifty.change, nifty.tone], ["24,812.35", "24,812", "(+0.42%)", "up"]);
  assert.deepEqual([bank.price, bank.change, bank.tone], ["52,140.80", "(−0.18%)", "down"]);
  assert.equal(nifty.title, "NIFTY spot · +103.20 today from your Paytm Money connection");
});

test("Indian grouping above a lakh", () => {
  const [, bank] = tickerItems([{ underlying: "BANKNIFTY", price: 152140.8, change: null, changePercent: null, source: "paytm" }], nameOf);
  assert.equal(bank.price, "1,52,140.80");
});

test("a source with no move shows the price alone, never 0%", () => {
  const [nifty] = tickerItems([{ underlying: "NIFTY", price: 24812.35, change: null, changePercent: null, source: "aliceblue" }], nameOf);
  assert.equal(nifty.change, null);
  assert.equal(nifty.tone, "flat");
  assert.equal(nifty.title, "NIFTY spot from your Alice Blue connection");
});

test("no quote reads as a dash with a reason, in fixed NIFTY-then-BANKNIFTY order", () => {
  const items = tickerItems([{ underlying: "BANKNIFTY", price: null, change: null, changePercent: null, source: null }], nameOf);
  assert.deepEqual(items.map((i) => [i.underlying, i.price]), [["NIFTY", "—"], ["BANKNIFTY", "—"]]);
  assert.match(items[0].title, /connect Paytm Money or Alice Blue/);
});

test("the shared feed is named as such, not as the admin's broker", () => {
  const [nifty] = tickerItems([{ underlying: "NIFTY", price: 1, change: null, changePercent: null, source: "shared" }], nameOf);
  assert.match(nifty.title, /shared market feed/);
});

test("an expired account offers Reconnect through its own registration; live ones offer nothing", () => {
  const rows = brokerMenuRows([
    { brokerId: "kite", accounts: [{ connectionId: "u:kite:default", accountLabel: "ZR1", credentialLabel: "default", connected: true }], pending: [], named: false },
    { brokerId: "paytm", accounts: [{ connectionId: "u:paytm:family", accountLabel: "PT9", credentialLabel: "family", connected: false }], pending: [], named: true },
    { brokerId: "aliceblue", accounts: [], pending: ["default"], named: false },
  ], nameOf);
  assert.deepEqual(rows.map((r) => [r.title, r.status, r.label]), [
    ["Zerodha Kite", "connected", null],
    ["Paytm Money", "expired", "family"],
    ["Alice Blue", "pending", "default"],
  ]);
});

test("several accounts at one broker are told apart by account label", () => {
  const rows = brokerMenuRows([{ brokerId: "kite", accounts: [
    { connectionId: "a", accountLabel: "ZR1", credentialLabel: "default", connected: true },
    { connectionId: "b", accountLabel: "ZR2", credentialLabel: "default", connected: false },
  ], pending: [], named: false }], nameOf);
  assert.deepEqual(rows.map((r) => r.title), ["Zerodha Kite · ZR1", "Zerodha Kite · ZR2"]);
});
