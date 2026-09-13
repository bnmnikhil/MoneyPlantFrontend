import { formatINRWhole } from "@/lib/format";
import type { HoldingView } from "./holdingView";

export function HoldingsToggle({ holding, included, qty, loading, errored, onToggle, onQty, onRetry }: {
  holding?: HoldingView; included: boolean; qty?: number; loading: boolean; errored: boolean;
  onToggle: (included: boolean) => void; onQty: (qty: number) => void; onRetry: () => void;
}) {
  const available = holding?.availableQty ?? 0;
  const blocked = !!holding?.warning || !available;
  const detail = holding?.warning ?? (available ? `${available} sh @ ${formatINRWhole(holding!.avgCost)}`
    : loading ? "Checking…" : errored ? "Couldn't check" : "None available");
  return <div className="payoff-holdings-control" title={holding?.warning ?? (available ? `${available} shares in the same account at average cost ${formatINRWhole(holding!.avgCost)}` : undefined)}>
    <label className="inline-flex shrink-0 items-center gap-2">
      <input type="checkbox" role="switch" checked={included} disabled={!included && blocked} onChange={(event) => onToggle(event.target.checked)} className="payoff-holdings-switch" />
      Holdings
    </label>
    {included && holding ? <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-muted-foreground">
      <input type="number" aria-label="Shares to include" min={1} max={available} step={1}
        value={qty ?? (holding.includedQty || available)} onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isInteger(value) && value >= 1 && value <= available) onQty(value);
        }} className="w-14 rounded border border-border bg-background px-1 py-0.5 text-right text-foreground outline-none focus:ring-1 focus:ring-ring" />
      of {available} @ {formatINRWhole(holding.avgCost)}
    </span> : <span className="max-w-56 text-xs text-muted-foreground" role={holding?.warning ? "status" : undefined}>{detail}</span>}
    {(holding?.warning || errored) && <button type="button" className="text-xs underline" onClick={onRetry}>Retry</button>}
  </div>;
}
