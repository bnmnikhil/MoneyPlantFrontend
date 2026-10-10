import { formatINRWhole } from "@/lib/format";

const GREEN = "#3FCB85";
const RED = "#FF6B5E";
const TODAY = "#6AA9FF";

const signed = (value: number) => `${value >= 0 ? "+" : ""}${formatINRWhole(value)}`;

export function spotChangeLabel(hoveredSpot: number, referenceSpot: number): string | null {
  if (!Number.isFinite(hoveredSpot) || !Number.isFinite(referenceSpot) || referenceSpot <= 0) {
    return null;
  }

  const change = ((hoveredSpot - referenceSpot) / referenceSpot) * 100;
  const rounded = Math.abs(change) < 0.005 ? 0 : change;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(2)}%`;
}

export function PayoffTooltip({ active, payload, referenceSpot, showExpiry = true, showToday = false }: {
  active?: boolean;
  payload?: Array<{ payload: { spot: number; pnl: number; baselinePnl?: number; todayPnl?: number } }>;
  referenceSpot: number;
  showExpiry?: boolean;
  showToday?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const { spot, pnl, baselinePnl, todayPnl } = payload[0].payload;
  const today = showToday ? todayPnl : undefined;
  const change = spotChangeLabel(spot, referenceSpot);

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">
        Spot {formatINRWhole(spot)}{change !== null && <span className="text-muted-foreground"> ({change})</span>}
      </p>
      {today !== undefined && (
        <p className="tabular-nums" style={{ color: TODAY }}>Today {signed(today)}</p>
      )}
      {showExpiry && (
        <p
          className="tabular-nums"
          style={{ color: pnl >= 0 ? GREEN : RED }}
        >
          {today !== undefined ? "At expiry" : "P&L"} {signed(pnl)}
        </p>
      )}
      {baselinePnl !== undefined && (
        <>
          <p className="tabular-nums text-muted-foreground">
            Existing{today !== undefined ? " at expiry" : ""} {signed(baselinePnl)}
          </p>
          <p className="tabular-nums font-medium">
            Change{today !== undefined ? " at expiry" : ""} {signed(pnl - baselinePnl)}
          </p>
        </>
      )}
    </div>
  );
}
