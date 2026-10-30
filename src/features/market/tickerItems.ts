/**
 * The header's index ticker, as data. Pure, so the wording and the rise/fall
 * colouring are tested without rendering.
 */
import type { SpotQuote } from "@/types/api";

/** Canonical underlyings, in display order. */
export const TICKER_INDICES = ["NIFTY", "BANKNIFTY"] as const;

export type TickerTone = "up" | "down" | "flat";

export interface TickerItem {
  underlying: string;
  /** "24,812.35", or "—" when nothing could quote it. */
  price: string;
  /** Whole points, for the narrower header: "24,812". */
  priceWhole: string;
  /** "(+0.42%)", or null when the source reports no move. */
  change: string | null;
  tone: TickerTone;
  /** Hover text: where the number came from, or why there is none. */
  title: string;
}

const twoDp = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Where a spot came from, in words. `nameOf` turns a broker id into its name. */
function sourceText(source: string | null, nameOf: (brokerId: string) => string): string {
  if (!source) return "";
  return source === "shared" ? "from the shared market feed" : `from your ${nameOf(source)} connection`;
}

export function tickerItems(
  quotes: SpotQuote[] | undefined,
  nameOf: (brokerId: string) => string,
): TickerItem[] {
  return TICKER_INDICES.map((underlying) =>
    spotItem(underlying, quotes?.find((quote) => quote.underlying === underlying), nameOf));
}

/** One underlying's spot and day move, worded as the ticker words it. Also the payoff header's. */
export function spotItem(
  underlying: string,
  q: SpotQuote | undefined,
  nameOf: (brokerId: string) => string,
  missingTitle = "No index price: connect Paytm Money or Alice Blue to see it",
): TickerItem {
  if (!q || q.price === null || !Number.isFinite(q.price)) {
    return { underlying, price: "—", priceWhole: "—", change: null, tone: "flat", title: missingTitle };
  }
  const pct = q.changePercent;
  const known = pct !== null && Number.isFinite(pct);
  const tone: TickerTone = !known || pct === 0 ? "flat" : pct > 0 ? "up" : "down";
  const sign = known && pct > 0 ? "+" : known && pct < 0 ? "−" : "";
  const moveText = q.change !== null && Number.isFinite(q.change)
    ? ` · ${q.change > 0 ? "+" : q.change < 0 ? "−" : ""}${twoDp.format(Math.abs(q.change))} today`
    : "";
  return {
    underlying,
    price: twoDp.format(q.price),
    priceWhole: whole.format(q.price),
    change: known ? `(${sign}${Math.abs(pct).toFixed(2)}%)` : null,
    tone,
    title: `${underlying} spot${moveText} ${sourceText(q.source, nameOf)}`.trim(),
  };
}
