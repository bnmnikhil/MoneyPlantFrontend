/**
 * Parses one NSE "Integrated Filing — IndAS" results page (the `..._iXBRL_WEB.html` files under
 * nsearchives.nseindia.com/corporate/ixbrl/) into GoldenBook's own line items, in rupees.
 *
 * Pure: text in, object out, no network and no files, so it is tested like any other logic.
 * The same parser serves every company that files in this format. Banks, NBFCs and insurers
 * file a different statement and are refused here rather than half-read.
 */

const ROUNDING = {
  actual: 1, rupees: 1, hundreds: 1e2, thousands: 1e3, lakhs: 1e5, lacs: 1e5,
  millions: 1e6, crores: 1e7, billions: 1e9,
};

/** Line items read from the results table: our key, and the filing's label (lower case). */
const AMOUNT_LINES = [
  ["revenue", "revenue from operations", "exact"],
  ["otherIncome", "other income", "exact"],
  ["totalIncome", "total income", "exact"],
  ["financeCosts", "finance costs", "exact"],
  ["depreciation", "depreciation, depletion and amortisation expense", "prefix"],
  ["totalExpenses", "total expenses", "exact"],
  ["profitBeforeTax", "total profit before tax", "exact"],
  ["tax", "total tax expenses", "exact"],
  ["netProfit", "total profit (loss) for period", "exact"],
  ["paidUpEquity", "paid-up equity share capital", "exact"],
];

/** Per-share figures: never scaled by the filing's rounding. */
const PER_SHARE_LINES = [
  ["faceValue", "face value of equity share capital", "exact"],
  ["epsBasic", "basic earnings (loss) per share from continuing and discontinued operations", "exact"],
  ["epsDiluted", "diluted earnings (loss) per share from continuing and discontinued operations", "exact"],
];

export class FilingFormatError extends Error {}

function decode(text) {
  return text
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&mdash;/g, "—")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

function clean(fragment) {
  return decode(fragment.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * A table's rows as arrays of non-empty cell texts. Cells are split on their opening tags, not
 * matched open-to-close, because the filings sometimes leave a `<th>` unclosed and a matched
 * pair would then swallow the next cell's number into the label.
 */
function rowsOf(html) {
  const rows = [];
  for (const row of html.split(/<tr\b[^>]*>/i).slice(1)) {
    const cells = row.split(/<t[dh]\b[^>]*>/i).slice(1).map(clean).filter((cell) => cell !== "");
    if (cells.length) rows.push(cells);
  }
  return rows;
}

/** "1,06,839.00" → 106839, "(141.00)" → -141; null for anything that is not a number. */
export function parseAmount(text) {
  const negative = /^\(.*\)$/.test(text);
  const digits = text.replace(/[(),\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(digits)) return null;
  const value = Number(digits);
  return negative ? -value : value;
}

const MONTH_NUMBER = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

/** "30-09-2025" or "30-Sep-2025" (the first integrated filings) → "2025-09-30". */
function isoDate(text) {
  const match = /^(\d{2})-(\d{2}|[A-Za-z]{3})-(\d{4})/.exec(text ?? "");
  if (!match) return null;
  const month = /^\d/.test(match[2]) ? match[2] : MONTH_NUMBER[match[2].toLowerCase()];
  return month ? `${match[3]}-${month}-${match[1]}` : null;
}

function sections(html) {
  const found = [];
  const pattern = /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi;
  for (let match; (match = pattern.exec(html)); ) {
    const title = clean(match[1]);
    if (!/^amount in/i.test(title)) found.push({ title, start: match.index });
  }
  return found.map((section, index) => ({
    title: section.title,
    html: html.slice(section.start, found[index + 1]?.start ?? html.length),
  }));
}

/**
 * The first value in a row whose label matches. A label is the cell before the values, so the
 * serial-number cells in front of it ("1", "(a)") are ignored.
 */
function valueOf(rows, label, mode) {
  for (const cells of rows) {
    const index = cells.findIndex((cell) => {
      const text = cell.toLowerCase();
      return mode === "prefix" ? text.startsWith(label) : text === label;
    });
    if (index >= 0 && index + 1 < cells.length) return cells[index + 1];
  }
  return undefined;
}

/** XBRL element (any namespace prefix) for each of our keys. Amounts are filed in full rupees. */
const XBRL_FACTS = {
  revenue: "RevenueFromOperations",
  otherIncome: "OtherIncome",
  totalIncome: "Income",
  financeCosts: "FinanceCosts",
  depreciation: "DepreciationDepletionAndAmortisationExpense",
  totalExpenses: "Expenses",
  profitBeforeTax: "ProfitBeforeTax",
  tax: "TaxExpense",
  netProfit: "ProfitLossForPeriod",
  paidUpEquity: "PaidUpValueOfEquityShareCapital",
  faceValue: "FaceValueOfEquityShareCapital",
  epsBasic: "BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
  epsDiluted: "DilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
};
const XBRL_PER_SHARE = new Set(["faceValue", "epsBasic", "epsDiluted"]);

/**
 * Parses one XBRL instance document (the `.xml` files under nsearchives.nseindia.com/corporate/xbrl/,
 * the format for quarters up to December 2024). The quarter's own figures sit in the context
 * named `OneD`; the year-to-date column (`FourD`) and the segment contexts are ignored.
 *
 * @param {string} xml the instance document
 * @returns the same shape as parseFiling
 */
export function parseXbrl(xml) {
  if (!/<(\w+:)?xbrl[\s>]/.test(xml)) throw new FilingFormatError("Not an XBRL instance document");
  if (!/<[\w-]+:RevenueFromOperations\b/.test(xml)) {
    throw new FilingFormatError("No RevenueFromOperations: not the general (Ind-AS) results format");
  }
  const facts = new Map();
  const pattern = /<[\w-]+:(\w+)\s[^>]*\bcontextRef="OneD"[^>]*>([^<]*)</g;
  for (let match; (match = pattern.exec(xml)); ) {
    if (!facts.has(match[1])) facts.set(match[1], decode(match[2]).trim());
  }
  if (!facts.size) throw new FilingFormatError("No facts in the quarter's context (OneD)");

  const lines = {};
  for (const [key, element] of Object.entries(XBRL_FACTS)) {
    const amount = parseAmount(facts.get(element) ?? "");
    lines[key] = amount === null ? null : XBRL_PER_SHARE.has(key) ? amount : Math.round(amount);
  }
  const periodStart = facts.get("DateOfStartOfReportingPeriod");
  const periodEnd = facts.get("DateOfEndOfReportingPeriod");
  const isDate = (text) => /^\d{4}-\d{2}-\d{2}$/.test(text ?? "");
  if (!isDate(periodStart) || !isDate(periodEnd)) throw new FilingFormatError("The reporting period dates are missing");
  if (lines.revenue === null || lines.netProfit === null) {
    throw new FilingFormatError("Revenue or net profit could not be read");
  }
  const basis = (facts.get("NatureOfReportStandaloneConsolidated") ?? "").toLowerCase();
  if (basis !== "consolidated" && basis !== "standalone") throw new FilingFormatError(`Unknown basis: "${basis}"`);
  const approved = facts.get("DateOfBoardMeetingWhenFinancialResultsWereApproved");

  return {
    company: {
      symbol: facts.get("Symbol") ?? null,
      isin: facts.get("ISIN") ?? null,
      name: facts.get("NameOfTheCompany") ?? null,
    },
    quarter: {
      basis,
      periodStart,
      periodEnd,
      audited: (facts.get("WhetherResultsAreAuditedOrUnaudited") ?? "").toLowerCase() === "audited",
      approvedOn: isDate(approved) ? approved : null,
      reportedIn: (facts.get("LevelOfRoundingUsedInFinancialStatements") ?? "").toLowerCase(),
      ...lines,
    },
  };
}

/** Either format, told apart by what the document is. */
export function parseAny(text) {
  return /^\s*<\?xml|<(\w+:)?xbrl[\s>]/.test(text.slice(0, 2000)) ? parseXbrl(text) : parseFiling(text);
}

/**
 * @param {string} html the filing page
 * @returns one quarter of one company, amounts in rupees
 */
export function parseFiling(page) {
  // Some filings carry commented-out markup with tags inside it; left in, its tail ("-->") ends
  // up in a cell.
  const html = page.replace(/<!--[\s\S]*?-->/g, "");
  const heading = clean(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? "");
  if (!/integrated filing/i.test(heading) || !/indas/i.test(heading.replace(/[\s-]/g, ""))) {
    throw new FilingFormatError(`Not an Integrated Filing (IndAS) page: "${heading || "no heading"}"`);
  }

  const parts = sections(html);
  const general = rowsOf(parts.find((part) => /^general information/i.test(part.title))?.html ?? "");
  const resultsHtml = parts.find((part) => /^financial results/i.test(part.title))?.html ?? "";
  const results = rowsOf(resultsHtml);
  if (!general.length || !results.length) {
    throw new FilingFormatError("The general information or financial results table is missing");
  }

  // The unit is stated in one of three places, depending on the filing's vintage: its own row,
  // the "Amount in (Lakhs)" line over the table, or (the first integrated filings, which give
  // full rupees) the currency row reading "INR (in Actuals)".
  const info = (label) => valueOf(general, label, "exact");
  const roundingText = (
    info("level of rounding used in financial results")
    ?? /Amount in \(([^)]+)\)/i.exec(clean(resultsHtml))?.[1]
    ?? /\(in ([^)]+)\)/i.exec(info("description of presentation currency") ?? "")?.[1]
    ?? ""
  ).trim().toLowerCase().replace(/^actuals$/, "actual");
  const multiplier = ROUNDING[roundingText];
  if (!multiplier) throw new FilingFormatError(`Unknown level of rounding: "${roundingText}"`);

  const lines = {};
  for (const [key, label, mode] of AMOUNT_LINES) {
    const amount = parseAmount(valueOf(results, label, mode) ?? "");
    lines[key] = amount === null ? null : Math.round(amount * multiplier);
  }
  for (const [key, label, mode] of PER_SHARE_LINES) {
    lines[key] = parseAmount(valueOf(results, label, mode) ?? "");
  }

  const periodStart = isoDate(valueOf(results, "date of start of reporting period", "exact"));
  const periodEnd = isoDate(valueOf(results, "date of end of reporting period", "exact"));
  if (!periodStart || !periodEnd) throw new FilingFormatError("The reporting period dates are missing");
  if (lines.revenue === null || lines.netProfit === null) {
    throw new FilingFormatError("Revenue or net profit could not be read");
  }

  const basis = (valueOf(results, "nature of report standalone or consolidated", "exact") ?? "").toLowerCase();
  if (basis !== "consolidated" && basis !== "standalone") {
    throw new FilingFormatError(`Unknown basis: "${basis}"`);
  }

  return {
    company: {
      symbol: info("nse symbol") ?? null,
      isin: info("isin") ?? null,
      name: info("name of company") ?? null,
    },
    quarter: {
      basis,
      periodStart,
      periodEnd,
      audited: (valueOf(results, "whether results are audited or unaudited", "exact") ?? "").toLowerCase() === "audited",
      approvedOn: isoDate(info("date of board meeting when results were approved")),
      reportedIn: roundingText,
      ...lines,
    },
  };
}
