import test from "node:test";
import assert from "node:assert/strict";
import {
  countOutcomes, daysBetween, defaultPriceRange, normaliseSymbol, previewList, splitRange, todayInIndia,
} from "../src/features/research/importTools.ts";

const XBRL = "https://nsearchives.nseindia.com/corporate/xbrl/INDAS_118941_1373614_06022025072019.xml";
const HTML = "https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_208371_02112026185559_iXBRL_WEB.html";
const HTML_XML = "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1751357_02112026065559_WEB.xml";

test("the preview reads NSE's two exported tables the way the backend will", () => {
  const exported = [
    "COMPANY NAME\tAUDITED / UNAUDITED\t** XBRL\tExchange Received Time",
    `ITC Limited\tUn-Audited\tConsolidated\t${XBRL}\t06-02-2025 19:20`,
    "ITC Limited\tAudited\tNon-Consolidated\thttps://nsearchives.nseindia.com/corporate/xbrl/-\t09-06-2017 09:44",
    `ITC Limited\tUn-Audited\tConsolidated\t${XBRL}\t06-02-2025 19:20`,
    "",
    `"ITC","ITC Limited","30-Sep-26","Original","${HTML}","${HTML_XML}"`,
  ].join("\r\n");
  const preview = previewList(exported);
  assert.deepEqual(preview.addresses, [XBRL, HTML], "first address of a row, no repeats");
  assert.equal(preview.withoutFile, 1);
  assert.deepEqual(previewList(""), { addresses: [], withoutFile: 0 });
});

test("symbols are NSE's: upper-cased, with & and - allowed", () => {
  assert.equal(normaliseSymbol(" itc "), "ITC");
  assert.equal(normaliseSymbol("m&m"), "M&M");
  assert.equal(normaliseSymbol("bajaj-auto"), "BAJAJ-AUTO");
  assert.equal(normaliseSymbol("ITC LTD"), null);
  assert.equal(normaliseSymbol(""), null);
  assert.equal(normaliseSymbol("../ITC"), null);
});

test("a year is cut into 62-day loads with no day lost or repeated", () => {
  const pieces = splitRange("2025-11-10", "2026-11-11");
  assert.equal(pieces.length, 6);
  assert.deepEqual(pieces[0], ["2025-11-10", "2026-01-10"]);
  assert.deepEqual(pieces[1], ["2026-01-11", "2026-03-13"]);
  assert.deepEqual(pieces.at(-1), ["2026-09-16", "2026-11-11"]);
  const total = pieces.reduce((sum, [from, to]) => sum + daysBetween(from, to), 0);
  assert.equal(total, daysBetween("2025-11-10", "2026-11-11"));
  for (let i = 1; i < pieces.length; i++) assert.equal(daysBetween(pieces[i - 1][1], pieces[i][0]), 2, "consecutive");

  assert.deepEqual(splitRange("2026-11-11", "2026-11-11"), [["2026-11-11", "2026-11-11"]]);
  assert.deepEqual(splitRange("2026-11-12", "2026-11-11"), []);
  assert.equal(daysBetween("2026-11-12", "2026-11-11"), 0);
});

test("the default price range is the last seven days, and today is India's", () => {
  assert.deepEqual(defaultPriceRange("2026-11-11"), { from: "2026-11-05", to: "2026-11-11" });
  assert.equal(todayInIndia(new Date("2026-11-11T19:00:00Z")), "2026-11-12", "00:30 IST is already the next day");
  assert.equal(todayInIndia(new Date("2026-11-11T18:00:00Z")), "2026-11-11");
});

test("outcomes are counted for the result caption", () => {
  assert.deepEqual(countOutcomes([{ outcome: "PARSED" }, { outcome: "FAILED" }, { outcome: "PARSED" }]), { PARSED: 2, FAILED: 1 });
});
