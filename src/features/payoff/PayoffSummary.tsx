import { Skeleton } from "@/components/ui/skeleton";
import type { PayoffResponse } from "@/types/api";
import { formatINRWhole } from "@/lib/format";

export function expiryLabel(expiry: string) {
  return new Date(`${expiry}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function PayoffSummary({ data, loading }: { data?: PayoffResponse; loading: boolean }) {
  const payoff = data?.payoff;
  const mixed = (data?.expiries.length ?? 0) > 1;
  const metrics = [
    { label: "Current spot", value: data && data.spot > 0 ? formatINRWhole(data.spot) : "—", colour: "text-amber-300" },
    { label: mixed ? "Scenario max profit" : "Max profit", value: payoff?.unboundedProfit ? "Unlimited" : payoff ? formatINRWhole(payoff.maxProfit) : "—", colour: "text-profit" },
    { label: mixed ? "Scenario max loss" : "Max loss", value: payoff?.unboundedLoss ? "Unlimited" : payoff ? formatINRWhole(payoff.maxLoss) : "—", colour: "text-loss" },
    { label: "Breakeven", value: payoff?.breakevens.length ? payoff.breakevens.map(formatINRWhole).join(" / ") : "—", colour: "" },
    { label: mixed ? "Expiries" : "Expiry", value: data?.expiries.length ? data.expiries.map(expiryLabel).join(" / ") : "—", colour: "" },
  ];
  return <section className="payoff-summary" aria-label="Payoff summary">
    {metrics.map((metric) => <div className="payoff-metric" key={metric.label}>
      <div className="text-sm text-muted-foreground xl:text-base">{metric.label}</div>
      <div className={`payoff-metric-value ${metric.colour}`} title={metric.value}>{loading ? <Skeleton className="h-8 w-28" /> : metric.value}</div>
    </div>)}
  </section>;
}
