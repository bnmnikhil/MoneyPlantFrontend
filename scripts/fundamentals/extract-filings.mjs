#!/usr/bin/env node
/**
 * Builds public/fundamentals/<SYMBOL>.json from a company's quarterly result filings.
 *
 *   node scripts/fundamentals/extract-filings.mjs ITC
 *
 * Reads scripts/fundamentals/links/<SYMBOL>.txt: one filing per line, either an
 * nsearchives.nseindia.com "..._iXBRL_WEB.html" address or a path to a saved copy. Lines
 * starting with # are comments. Each download is kept in scripts/fundamentals/cache/, so a
 * second run asks NSE for nothing it already has.
 *
 * The same script serves every stock: add links/<SYMBOL>.txt and run it with that symbol.
 * It fetches only the filing addresses it is given, one at a time with a pause, and
 * identifies itself; it does not crawl NSE or work around its listing pages.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FilingFormatError, parseAny } from "./parse-filing.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const USER_AGENT = "GoldenBook-fundamentals/0.1 (personal research; goldenbook.in)";
const PAUSE_MS = 2000;
const ALLOWED_HOST = "nsearchives.nseindia.com";

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function fetchFiling(source) {
  if (!/^https?:/i.test(source)) {
    const path = isAbsolute(source) ? source : resolve(here, "links", source);
    return { html: await readFile(path, "utf8"), fetched: false };
  }
  const url = new URL(source);
  if (url.hostname !== ALLOWED_HOST) throw new Error(`Only ${ALLOWED_HOST} addresses are fetched: ${source}`);

  const cacheDir = join(here, "cache");
  const cached = join(cacheDir, `${createHash("sha1").update(source).digest("hex")}.html`);
  if (existsSync(cached)) return { html: await readFile(cached, "utf8"), fetched: false };

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${source}`);
  const html = await response.text();
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cached, html, "utf8");
  return { html, fetched: true };
}

async function main() {
  const symbol = (process.argv[2] ?? "").toUpperCase();
  if (!/^[A-Z0-9&-]+$/.test(symbol)) {
    console.error("Usage: node scripts/fundamentals/extract-filings.mjs <SYMBOL>");
    process.exit(2);
  }
  const linksPath = join(here, "links", `${symbol}.txt`);
  if (!existsSync(linksPath)) {
    console.error(`No ${linksPath}. Create it with one filing address per line.`);
    process.exit(2);
  }
  // A line is a bare address or path, or a row of NSE's own results table pasted or exported as
  // it is (tab- or comma-separated): then the filing address is picked out of the row. Rows whose
  // XBRL column holds no file (NSE prints ".../xbrl/-") are counted and skipped.
  let withoutFile = 0;
  const sources = [];
  for (const raw of (await readFile(linksPath, "utf8")).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const address = /https?:\/\/[^\s",]+/.exec(line)?.[0];
    if (address) {
      if (/\.(xml|html?)$/i.test(address)) sources.push(address);
      else withoutFile += 1;
    } else if (!/[\t,]/.test(line)) {
      sources.push(line);
    }
  }
  if (withoutFile) console.log(`${withoutFile} row(s) have no XBRL file at NSE and were skipped.`);

  let company = null;
  const byQuarter = new Map();
  const problems = [];
  for (const source of sources) {
    try {
      const { html, fetched } = await fetchFiling(source);
      const parsed = parseAny(html);
      if ((parsed.company.symbol ?? "").toUpperCase() !== symbol) {
        throw new FilingFormatError(`This filing is ${parsed.company.symbol}'s, not ${symbol}'s`);
      }
      company ??= parsed.company;
      const quarter = { ...parsed.quarter, filing: /^https?:/i.test(source) ? source : null };
      const key = `${quarter.basis}|${quarter.periodEnd}`;
      const previous = byQuarter.get(key);
      // A revised filing for the same quarter replaces the earlier one.
      if (!previous || (quarter.approvedOn ?? "") >= (previous.approvedOn ?? "")) byQuarter.set(key, quarter);
      console.log(`ok   ${quarter.periodEnd} ${quarter.basis.padEnd(12)} ${source}`);
      if (fetched) await sleep(PAUSE_MS);
    } catch (error) {
      problems.push(`${source}: ${error.message}`);
      console.error(`FAIL ${source}: ${error.message}`);
    }
  }

  if (!company) {
    console.error("No filing could be read; nothing written.");
    process.exit(1);
  }
  const quarters = [...byQuarter.values()]
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd) || a.basis.localeCompare(b.basis));
  const out = join(root, "public", "fundamentals", `${symbol}.json`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify({
    symbol,
    name: company.name,
    isin: company.isin,
    currency: "INR",
    source: "Company filings with NSE",
    generatedAt: new Date().toISOString(),
    quarters,
  }, null, 2)}\n`, "utf8");
  console.log(`\n${quarters.length} quarter rows written to ${out}`);
  if (problems.length) {
    console.error(`${problems.length} filing(s) failed; see above.`);
    process.exit(1);
  }
}

await main();
