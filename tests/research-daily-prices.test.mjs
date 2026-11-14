import test from "node:test";
import assert from "node:assert/strict";
import { dailyStatusLine } from "../src/features/research/importTools.ts";

const run = (over = {}) => ({
  at: "2026-11-14T14:00:00Z", from: "2026-11-14", to: "2026-11-14",
  loaded: 1, notPublished: 0, failed: 0, note: null, error: null, ...over,
});

test("a good run reads as one quiet line, in India's time", () => {
  const line = dailyStatusLine({ lastFileDate: "2026-11-14", dailyJob: "on", lastRun: run() });
  assert.equal(line.text, "Daily load is on. Latest file: 14 Nov 2026. Last run 14 Nov, 19:30: 1 loaded, 0 not published.");
  assert.equal(line.warn, false);
  const idle = dailyStatusLine({ lastFileDate: "2026-11-14", dailyJob: "on", lastRun: run({ note: "Up to date", loaded: 0 }) });
  assert.match(idle.text, /nothing new\.$/);
  assert.equal(idle.warn, false);
});

test("off, failed days, a failed run and a long gap all ask for attention", () => {
  assert.equal(dailyStatusLine({ lastFileDate: null, dailyJob: "off", lastRun: null }).warn, true);
  assert.match(dailyStatusLine({ lastFileDate: null, dailyJob: "off", lastRun: null }).text, /No price files stored yet/);
  assert.equal(dailyStatusLine({ lastFileDate: "2026-11-13", dailyJob: "on", lastRun: run({ failed: 1 }) }).warn, true);
  const broken = dailyStatusLine({ lastFileDate: "2026-11-13", dailyJob: "on", lastRun: run({ error: "IllegalStateException: down" }) });
  assert.match(broken.text, /failed: IllegalStateException: down$/);
  assert.equal(broken.warn, true);
  const gap = dailyStatusLine({ lastFileDate: "2026-11-13", dailyJob: "on", lastRun: run({ note: "Gap since 2026-01-03 is longer than 62 days" }) });
  assert.equal(gap.warn, true);
});

test("on but not yet run since a restart says when it will", () => {
  const line = dailyStatusLine({ lastFileDate: "2026-11-13", dailyJob: "on", lastRun: null });
  assert.match(line.text, /19:30, 21:30 and 08:00 IST/);
  assert.equal(line.warn, false);
});
