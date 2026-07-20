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

/** Signed currency, e.g. +₹1,234.50 / -₹1,234.50 — used for P&L. */
export function formatSignedINR(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${inr.format(Math.abs(value))}`;
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
