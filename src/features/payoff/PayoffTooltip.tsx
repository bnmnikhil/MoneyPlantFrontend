import { formatINRWhole } from "@/lib/format";

const GREEN = "#199e70";
const RED = "#e34948";

export function spotChangeLabel(hoveredSpot: number, referenceSpot: number): string | null {
  if (!Number.isFinite(hoveredSpot) || !Number.isFinite(referenceSpot) || referenceSpot <= 0) {
    return null;
  }

  const change = ((hoveredSpot - referenceSpot) / referenceSpot) * 100;
  const rounded = Math.abs(change) < 0.005 ? 0 : change;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(2)}%`;
}

export function PayoffTooltip({ active, payload, referenceSpot }: {
  active?: boolean;
  payload?: Array<{ payload: { spot: number; pnl: number; baselinePnl?: number } }>;
  referenceSpot: number;
}) {
  if (!active || !payload?.length) return null;
  const { spot, pnl, baselinePnl } = payload[0].payload;
  const change = spotChangeLabel(spot, referenceSpot);

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">
        Spot {formatINRWhole(spot)}{change !== null && <span className="text-muted-foreground"> ({change})</span>}
      </p>
      <p
        className="tabular-nums"
        style={{ color: pnl >= 0 ? GREEN : RED }}
      >
        P&amp;L {pnl >= 0 ? "+" : ""}
        {formatINRWhole(pnl)}
      </p>
      {baselinePnl !== undefined && (
        <>
          <p className="tabular-nums text-muted-foreground">
            Existing {baselinePnl >= 0 ? "+" : ""}{formatINRWhole(baselinePnl)}
          </p>
          <p className="tabular-nums font-medium">
            Change {pnl - baselinePnl >= 0 ? "+" : ""}{formatINRWhole(pnl - baselinePnl)}
          </p>
        </>
      )}
    </div>
  );
}
