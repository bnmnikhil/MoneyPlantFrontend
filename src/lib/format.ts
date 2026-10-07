/**
 * Indian-locale number & currency formatting (lakh/crore grouping: ₹1,23,456.50).
 */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("en-IN");

/** ₹1,23,456.50 */
export function formatINR(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return inr.format(value);
}

/** ₹1,23,457 (no paise) — for large aggregates like margins. */
export function formatINRWhole(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return inrCompact.format(value);
}

/**
 * An underlying price, e.g. a breakeven or spot: whole rupees from ₹1,000 up, where paise are noise
 * (NIFTY ₹24,280), and paise below it, where they are the answer (ITC's breakeven is ₹266.25, not
 * ₹266). A price with no paise drops the ".00".
 */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 100) / 100;
  return Math.abs(rounded) >= 1000 || Number.isInteger(rounded) ? inrCompact.format(rounded) : inr.format(rounded);
}

/** Signed currency, e.g. +₹1,234.50 / -₹1,234.50 — used for P&L. */
export function formatSignedINR(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${inr.format(Math.abs(value))}`;
}

/** Signed, no paise — e.g. +₹52,300 / -₹1,238. For signed aggregates like premium. */
export function formatSignedINRWhole(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${inrCompact.format(Math.abs(value))}`;
}

/** 1,23,456 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return number.format(value);
}

/** +2.34% / -2.34% */
export function formatSignedPct(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Tailwind text color class keyed to sign. Zero is neutral (muted). */
export function pnlColor(value: number): string {
  if (value > 0) return "text-profit";
  if (value < 0) return "text-loss";
  return "text-muted-foreground";
}
