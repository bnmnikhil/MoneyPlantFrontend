import {
  Area,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Payoff } from "@/types/api";
import { formatINRWhole } from "@/lib/format";

const GREEN = "#199e70";
const RED = "#e34948";
const MUTED = "hsl(var(--muted-foreground))";
const AMBER = "#f5b34a";

function PayoffTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { spot, pnl } = payload[0].payload as { spot: number; pnl: number };
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">Spot {formatINRWhole(spot)}</p>
      <p
        className="tabular-nums"
        style={{ color: pnl >= 0 ? GREEN : RED }}
      >
        P&amp;L {pnl >= 0 ? "+" : ""}
        {formatINRWhole(pnl)}
      </p>
    </div>
  );
}

export function PayoffChart({
  payoff,
  spot,
}: {
  payoff: Payoff;
  spot: number;
}) {
  const points = payoff.points;
  const xMin = points[0]?.spot ?? 0;
  const xMax = points[points.length - 1]?.spot ?? 0;

  const pnls = points.map((p) => p.pnl);
  const maxPnl = Math.max(...pnls, 0);
  const minPnl = Math.min(...pnls, 0);

  // Fraction (from top) where P&L = 0 sits — used to split the gradient color.
  const gradientOffset =
    maxPnl <= 0 ? 0 : minPnl >= 0 ? 1 : maxPnl / (maxPnl - minPnl);

  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={points}
          margin={{ top: 16, right: 16, bottom: 8, left: 8 }}
        >
          <defs>
            <linearGradient id="payoffFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={GREEN} stopOpacity={0.18} />
              <stop offset={gradientOffset} stopColor={GREEN} stopOpacity={0.04} />
              <stop offset={gradientOffset} stopColor={RED} stopOpacity={0.04} />
              <stop offset={1} stopColor={RED} stopOpacity={0.18} />
            </linearGradient>
            <linearGradient id="payoffStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset={gradientOffset} stopColor={GREEN} stopOpacity={1} />
              <stop offset={gradientOffset} stopColor={RED} stopOpacity={1} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="spot"
            type="number"
            domain={[xMin, xMax]}
            tickFormatter={(v) => formatINRWhole(v)}
            tick={{ fill: MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            minTickGap={48}
          />
          <YAxis
            tickFormatter={(v) => formatINRWhole(v)}
            tick={{ fill: MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={72}
          />

          <Tooltip
            content={<PayoffTooltip />}
            cursor={{ stroke: MUTED, strokeDasharray: "3 3" }}
          />

          <Area
            type="monotone"
            dataKey="pnl"
            stroke="url(#payoffStroke)"
            strokeWidth={2}
            fill="url(#payoffFill)"
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />

          {/* P&L baseline */}
          <ReferenceLine y={0} stroke={MUTED} strokeWidth={1.25} />

          {/* Breakevens */}
          {payoff.breakevens.map((be) => (
            <ReferenceLine
              key={be}
              x={be}
              stroke={MUTED}
              strokeDasharray="3 3"
              strokeOpacity={0.7}
              label={{
                value: formatINRWhole(be),
                position: "insideBottom",
                fill: MUTED,
                fontSize: 10,
              }}
            />
          ))}

          {/*
            Spot — only when we actually have one.

            A spot of 0 means no broker could quote it, not that the index is
            at zero. Rendering the line anyway pins it to the far left of the
            chart and labels it "Spot ₹0", which reads as real. Better to show
            no reference line than a confident wrong one.
          */}
          {spot > 0 && (
            <ReferenceLine
              x={spot}
              stroke={AMBER}
              strokeDasharray="4 4"
              label={{
                value: `Spot ${formatINRWhole(spot)}`,
                position: "insideTopRight",
                fill: AMBER,
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
