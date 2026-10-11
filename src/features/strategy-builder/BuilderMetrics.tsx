import type { PayoffComparisonResponse } from "@/types/api";
import { formatINRWhole, formatPrice, formatSignedINR, formatSignedINRWhole } from "@/lib/format";

/** Signed money with paise only where they matter: +₹480.50, but +₹12,23,520. */
const signedMoney = (value: number) => Math.abs(value) >= 1000 ? formatSignedINRWhole(value) : formatSignedINR(value);
import { cn } from "@/lib/utils";
import { niceTicks } from "@/features/payoff/chartRange";
import { legPnlAtSpot } from "./payoffMath";

const MARGIN_REASON: Record<PayoffComparisonResponse["margin"]["status"], string> = {
  AVAILABLE: "",
  UNAVAILABLE_SPOT: "unavailable: no current spot",
  UNAVAILABLE_MARKS: "unavailable: a leg has no current price",
  UNSUPPORTED_HOLDINGS: "unavailable: not estimated with shares (unsupported holdings)",
};

/**
 * The strategy's six figures under the legs (Builder layout B): max profit and loss, breakevens,
 * the draft's premium, and the margin with its hedge benefit. Margin is GoldenBook's estimate, never
 * the broker's bill, and when it cannot be estimated no number is shown at all.
 */
export function BuilderMetrics({ comparison, linearTrades = false }: { comparison: PayoffComparisonResponse; linearTrades?: boolean }) {
  const mixed = comparison.expiries.length > 1;
  const margin = comparison.margin;
  const marginKnown = margin?.status === "AVAILABLE" && !!margin.combined;
  const baselineMargin = marginKnown && margin.baseline && margin.baseline.withBenefitMargin > 0 ? margin.baseline.withBenefitMargin : null;
  const metrics: { label: string; value: string; colour: string; title?: string; sub?: string }[] = [
    { label: mixed ? "Scenario max profit" : "Max profit", value: comparison.combined.unboundedProfit ? "Unlimited" : signedMoney(comparison.combined.maxProfit), colour: "text-profit" },
    { label: mixed ? "Scenario max loss" : "Max loss", value: comparison.combined.unboundedLoss ? "Unlimited" : signedMoney(comparison.combined.maxLoss), colour: "text-loss" },
    { label: "Breakevens", value: comparison.combined.breakevens.length ? comparison.combined.breakevens.map(formatPrice).join(" / ") : "—", colour: "" },
    { label: `${linearTrades ? "New cashflow" : "New premium"} (${comparison.adjustmentCashflow >= 0 ? "credit" : "debit"})`, value: signedMoney(comparison.adjustmentCashflow), colour: comparison.adjustmentCashflow >= 0 ? "text-profit" : "text-loss" },
    { label: "Margin", value: marginKnown ? formatINRWhole(margin.combined!.withBenefitMargin) : "—", colour: "",
      title: marginKnown ? "GoldenBook's estimate (SPAN + exposure, after hedge benefit). Premium is separate; this is not the broker's margin bill." : `Margin ${MARGIN_REASON[margin?.status ?? "UNAVAILABLE_SPOT"]}`,
      sub: !marginKnown && margin ? MARGIN_REASON[margin.status] : baselineMargin !== null ? `was ${formatINRWhole(baselineMargin)}` : undefined },
    { label: "Hedge benefit", value: marginKnown ? formatINRWhole(margin.combined!.hedgeBenefit) : "—", colour: marginKnown ? "text-profit" : "" },
  ];
  return <div className="builder-metrics">{metrics.map((metric) => <div key={metric.label} title={metric.title}>
    <p>{metric.label}</p><strong className={metric.colour}>{metric.value}</strong>{metric.sub && <span className="builder-metric-sub">{metric.sub}</span>}
  </div>)}</div>;
}

export interface LadderLeg { type: string; strike: number; price: number; qty: number }

/** Expiry P&L of a set of legs at one underlying price, to the paisa. */
function pnlAt(legs: LadderLeg[], price: number) {
  return Math.round(100 * legs.reduce((sum, leg) => sum + legPnlAtSpot(leg, price), 0)) / 100;
}

/**
 * The P&L table tab (Builder layout B; Opstra's and Sensibull's payoff table): expiry P&L at round
 * prices around spot, the existing positions beside the strategy after adjustments, and the row
 * nearest spot marked. Computed in the browser from the same legs the chart draws.
 */
export function PnlLadder({ spot, isIndex, baseline, combined }: { spot: number | null; isIndex: boolean; baseline: LadderLeg[]; combined: LadderLeg[] }) {
  if (spot === null || spot <= 0) return <p className="builder-empty">A P&amp;L table needs the current spot.</p>;
  const swing = isIndex ? 0.1 : 0.15;
  const prices = niceTicks(spot * (1 - swing), spot * (1 + swing), 14);
  const nearest = prices.reduce((best, price) => Math.abs(price - spot) < Math.abs(best - spot) ? price : best, prices[0]);
  const hasBaseline = baseline.length > 0;
  return <div className="builder-ladder" role="region" aria-label="P&L at expiry by underlying price" tabIndex={0}>
    <table>
      <thead><tr><th>Underlying</th><th>Change</th>{hasBaseline && <th>Existing</th>}<th>{hasBaseline ? "After adjustments" : "Strategy"}</th></tr></thead>
      <tbody>{prices.map((price) => {
        const after = pnlAt(combined, price);
        const before = pnlAt(baseline, price);
        return <tr key={price} className={cn(price === nearest && "builder-ladder-now")}>
          <td>{formatPrice(price)}</td>
          <td className="text-muted-foreground">{((price / spot - 1) * 100).toFixed(1)}%</td>
          {hasBaseline && <td className={before < 0 ? "text-loss" : before > 0 ? "text-profit" : ""}>{formatSignedINRWhole(before)}</td>}
          <td className={after < 0 ? "text-loss" : after > 0 ? "text-profit" : ""}>{formatSignedINRWhole(after)}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
