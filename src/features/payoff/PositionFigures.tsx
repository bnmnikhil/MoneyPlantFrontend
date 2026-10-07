import { Skeleton } from "@/components/ui/skeleton";
import { formatINRWhole, formatSignedINRWhole } from "@/lib/format";
import type { Payoff, PayoffComparisonResponse } from "@/types/api";

/** What one set of legs adds up to. `undefined` means still loading; `null` means unavailable. */
export interface FigureSet {
  openPnl: { value: number | null; partial: boolean };
  payoff: Payoff | undefined;
  margin: PayoffComparisonResponse["margin"] | undefined;
}

const MARGIN_REASON: Record<PayoffComparisonResponse["margin"]["status"], string> = {
  AVAILABLE: "",
  UNAVAILABLE_SPOT: "Not estimated: the current spot is unavailable",
  UNAVAILABLE_MARKS: "Not estimated: a leg has no current price",
  UNSUPPORTED_HOLDINGS: "Not estimated when shares are included",
};

function marginText(margin: FigureSet["margin"]): string | undefined {
  if (!margin) return undefined;
  return margin.status === "AVAILABLE" && margin.baseline ? formatINRWhole(margin.baseline.withBenefitMargin) : "—";
}

function maxText(payoff: Payoff | undefined, side: "profit" | "loss"): string | undefined {
  if (!payoff) return undefined;
  if (side === "profit") return payoff.unboundedProfit ? "Unlimited" : formatINRWhole(payoff.maxProfit);
  return payoff.unboundedLoss ? "Unlimited" : formatINRWhole(payoff.maxLoss);
}

function pnlText(pnl: FigureSet["openPnl"]): string {
  if (pnl.value === null) return "—";
  return `${formatSignedINRWhole(pnl.value)}${pnl.partial ? " ?" : ""}`;
}

/**
 * The four figures on the chart's title row: Current P/L, Margin used, Max profit, Max loss.
 *
 * With `real` set (a what-if, some legs unticked) each figure also shows the real position's value
 * struck through underneath, so the two can be compared without leaving the page. A figure that is
 * still loading shows a placeholder, never the previous selection's value.
 */
export function PositionFigures({ shown, real, mixedExpiries }: {
  shown: FigureSet;
  real?: FigureSet;
  mixedExpiries: boolean;
}) {
  const pnlTone = shown.openPnl.value === null ? "" : shown.openPnl.value >= 0 ? "text-profit" : "text-loss";
  const figures: { label: string; value: string | undefined; was?: string; tone: string; title?: string }[] = [
    { label: "Current P/L", value: pnlText(shown.openPnl), was: real && pnlText(real.openPnl), tone: pnlTone,
      title: "Open P/L of the legs shown: (current price − average price) × quantity. Excludes realised P/L."
        + (shown.openPnl.partial ? " ? = a leg has no current price and is left out." : "") },
    { label: "Margin used", value: marginText(shown.margin), was: real && marginText(real.margin), tone: "",
      title: shown.margin ? (MARGIN_REASON[shown.margin.status] || "GoldenBook's estimate for these legs (SPAN + exposure, after hedge benefit). Not your broker's bill.") : undefined },
    { label: mixedExpiries ? "Scenario max profit" : "Max profit", value: maxText(shown.payoff, "profit"),
      was: real && maxText(real.payoff, "profit"), tone: "text-profit" },
    { label: mixedExpiries ? "Scenario max loss" : "Max loss", value: maxText(shown.payoff, "loss"),
      was: real && maxText(real.payoff, "loss"), tone: "text-loss" },
  ];
  return <dl className="payoff-figures" aria-label={real ? "What-if figures" : "Position figures"}>
    {figures.map((figure) => <div className="payoff-figure" key={figure.label} title={figure.title}>
      <dt>{figure.label}</dt>
      <dd className={figure.tone}>{figure.value === undefined ? <Skeleton className="h-5 w-20" /> : figure.value}</dd>
      {real && figure.was !== undefined && figure.was !== figure.value && <dd className="payoff-figure-was"><s>{figure.was}</s></dd>}
    </div>)}
  </dl>;
}
