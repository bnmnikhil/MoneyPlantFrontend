import { ShieldCheck } from "lucide-react";
import type { PayoffComparisonResponse } from "@/types/api";
import { formatINRWhole, formatSignedINR } from "@/lib/format";

export function BuilderMetrics({ comparison, linearTrades = false }: { comparison: PayoffComparisonResponse; linearTrades?: boolean }) {
  const mixed = comparison.expiries.length > 1;
  const metrics = [
    { label: mixed ? "Scenario max profit" : "Max profit", value: comparison.combined.unboundedProfit ? "Unlimited" : formatSignedINR(comparison.combined.maxProfit), colour: "text-profit" },
    { label: mixed ? "Scenario max loss" : "Max loss", value: comparison.combined.unboundedLoss ? "Unlimited" : formatSignedINR(comparison.combined.maxLoss), colour: "text-loss" },
    { label: "Breakevens", value: comparison.combined.breakevens.length ? comparison.combined.breakevens.map(formatINRWhole).join(" / ") : "—", colour: "" },
    { label: `${linearTrades ? "New cashflow" : "New premium"} (${comparison.adjustmentCashflow >= 0 ? "credit" : "debit"})`, value: formatSignedINR(comparison.adjustmentCashflow), colour: comparison.adjustmentCashflow >= 0 ? "text-profit" : "text-loss" },
  ];
  return <div className="builder-metrics">{metrics.map((metric) => <div key={metric.label}><p>{metric.label}</p><strong className={metric.colour}>{metric.value}</strong></div>)}</div>;
}

export function TargetInspector({ spot, target, metrics, onTarget }: {
  spot: number | null; target: number | null;
  metrics: { existing: number; combined: number; change: number } | null;
  onTarget: (value: number | null) => void;
}) {
  const hasSpot = spot !== null && spot > 0;
  const low = hasSpot ? Math.min(spot * 0.9, target ?? spot) : 0;
  const high = hasSpot ? Math.max(spot * 1.1, target ?? spot) : 0;
  return <section className="builder-target" aria-label="Target spot inspector">
    <div className="flex items-center justify-between gap-3"><h3>Target spot inspector</h3>
      <input aria-label="Target underlying price" type="number" min={0} step="any" value={target ?? ""}
        onChange={(event) => { const value = event.target.value === "" ? null : Number(event.target.value); if (value === null || (Number.isFinite(value) && value >= 0)) onTarget(value); }} />
    </div>
    {hasSpot && <><input aria-label="Target price slider" type="range" min={low} max={high} step="any" value={target ?? spot}
      onChange={(event) => onTarget(Number(event.target.value))} />
      <div className="flex justify-between text-xs text-muted-foreground"><span>{((low / spot - 1) * 100).toFixed(0)}%</span><span>Spot {formatINRWhole(spot)}</span><span>+{((high / spot - 1) * 100).toFixed(0)}%</span></div></>}
    <div className="builder-target-values">{([['Existing', metrics?.existing], ['After adjustments', metrics?.combined], ['Change', metrics?.change]] as const).map(([label, value]) =>
      <div key={label}><p>{label}</p><strong className={value === undefined ? "" : value < 0 ? "text-loss" : "text-profit"}>{value === undefined ? "—" : formatSignedINR(value)}</strong></div>)}</div>
  </section>;
}

export function BuilderMargin({ comparison, account }: { comparison: PayoffComparisonResponse; account?: string }) {
  const margin = comparison.margin;
  return <section className="builder-panel builder-margin">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3>Capital &amp; margin{account ? ` (${account})` : ""}</h3><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" />Heuristic estimate</span></div>
    {margin.status === "AVAILABLE" && margin.combined ? <>
      <div className="builder-margin-values">
        <div><p>Existing margin</p><strong>{margin.baseline ? formatINRWhole(margin.baseline.withBenefitMargin) : "—"}</strong></div>
        <div><p>After adjustments</p><strong>{formatINRWhole(margin.combined.withBenefitMargin)}</strong></div>
        <div><p>Hedge benefit</p><strong className="text-primary">{formatINRWhole(margin.combined.hedgeBenefit)}</strong></div>
      </div><p className="mt-2 text-xs text-muted-foreground">Uses known marks. Premium is separate; this is not the broker's margin bill.</p>
    </> : <p className="mt-3 text-sm text-muted-foreground">Unavailable: {margin.status.replace(/_/g, " ").toLowerCase()}.</p>}
  </section>;
}
