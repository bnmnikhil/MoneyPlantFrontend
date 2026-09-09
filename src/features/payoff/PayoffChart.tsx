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
import { useState, useId } from "react";
import { chartPoints, defaultRange, rangeAnchor, validRange } from "./chartRange";
import type { ChartLeg, PriceRange } from "./chartRange";
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
  legs,
  isIndex,
}: {
  payoff: Payoff;
  spot: number;
  legs: ChartLeg[];
  isIndex: boolean;
}) {
  const [mode, setMode] = useState<"auto" | "custom" | number>("auto");
  const [custom, setCustom] = useState<PriceRange | null>(null);
  const [draftLow, setDraftLow] = useState("");
  const [draftHigh, setDraftHigh] = useState("");
  const [editing, setEditing] = useState(false);
  const anchor = rangeAnchor(spot, legs);
  const auto = defaultRange(spot, isIndex, legs, payoff.breakevens);
  const [xMin, xMax] = mode === "custom" && custom ? custom
    : typeof mode === "number" ? [anchor * (1 - mode), anchor * (1 + mode)] : auto;
  const points = chartPoints(legs, [xMin, xMax], [...payoff.breakevens, spot]);
  const id = useId().replace(/:/g, "");
  const fillId = `payoffFill${id}`, strokeId = `payoffStroke${id}`;
  const draftValid = draftLow.trim() !== "" && draftHigh.trim() !== "" && validRange(Number(draftLow), Number(draftHigh));

  const pnls = points.map((p) => p.pnl);
  const maxPnl = Math.max(...pnls, 0);
  const minPnl = Math.min(...pnls, 0);

  // Fraction (from top) where P&L = 0 sits — used to split the gradient color.
  const gradientOffset =
    maxPnl <= 0 ? 0 : minPnl >= 0 ? 1 : maxPnl / (maxPnl - minPnl);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Price range</span>
        {[0.05, 0.10, 0.15].map((percent) => (
          <button key={percent} type="button" aria-pressed={mode === percent} disabled={anchor <= 0}
            className={`rounded border px-2.5 py-1.5 ${mode === percent ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
            onClick={() => { setMode(percent); setEditing(false); }}>±{percent * 100}%</button>
        ))}
        <button type="button" aria-pressed={mode === "custom" || editing} className="rounded border border-border px-2.5 py-1.5"
          onClick={() => { setDraftLow(xMin.toFixed(2)); setDraftHigh(xMax.toFixed(2)); setEditing(true); }}>Custom</button>
        <button type="button" className="rounded border border-border px-2.5 py-1.5"
          onClick={() => { setMode("auto"); setEditing(false); }}>Reset</button>
        <span className="text-muted-foreground">{mode === "auto" ? `Auto · ${isIndex ? "Index ±10%" : "Stock ±15%"} · includes strikes and breakevens` : "Selected view"}</span>
      </div>
      {editing && <form className="flex flex-wrap items-end gap-2 text-xs" onSubmit={(e) => {
        e.preventDefault();
        if (draftValid) { setCustom([Number(draftLow), Number(draftHigh)]); setMode("custom"); setEditing(false); }
      }}>
        <label>Minimum price<input aria-label="Minimum price" type="number" min="0" step="any" value={draftLow} onChange={(e) => setDraftLow(e.target.value)} className="ml-2 w-28 rounded border border-border bg-background p-1.5" /></label>
        <label>Maximum price<input aria-label="Maximum price" type="number" min="0" step="any" value={draftHigh} onChange={(e) => setDraftHigh(e.target.value)} className="ml-2 w-28 rounded border border-border bg-background p-1.5" /></label>
        <button type="submit" disabled={!draftValid} className="rounded border border-border p-1.5 disabled:opacity-40">Apply</button>
        {!draftValid && <span role="status">Enter a nonnegative minimum and a larger maximum.</span>}
      </form>}
      <p className="text-xs text-muted-foreground">{formatINRWhole(xMin)} – {formatINRWhole(xMax)}. {spot > 0 ? "" : "Spot unavailable; range centred on strategy prices. "}Zoom changes the view only; profit/loss limits remain unchanged.</p>
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={points}
          margin={{ top: 16, right: 16, bottom: 8, left: 8 }}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={GREEN} stopOpacity={0.18} />
              <stop offset={gradientOffset} stopColor={GREEN} stopOpacity={0.04} />
              <stop offset={gradientOffset} stopColor={RED} stopOpacity={0.04} />
              <stop offset={1} stopColor={RED} stopOpacity={0.18} />
            </linearGradient>
            <linearGradient id={strokeId} x1="0" y1="0" x2="0" y2="1">
              <stop offset={gradientOffset} stopColor={GREEN} stopOpacity={1} />
              <stop offset={gradientOffset} stopColor={RED} stopOpacity={1} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="spot"
            type="number"
            domain={[xMin, xMax]}
            allowDataOverflow
            tickFormatter={(v) => formatINRWhole(v)}
            tick={{ fill: MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            minTickGap={48}
          />
          <YAxis
            domain={[minPnl, maxPnl === minPnl ? maxPnl + 1 : maxPnl]}
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
            type="linear"
            dataKey="pnl"
            stroke={`url(#${strokeId})`}
            strokeWidth={2}
            fill={`url(#${fillId})`}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />

          {/* P&L baseline */}
          <ReferenceLine y={0} stroke={MUTED} strokeWidth={1.25} />

          {/* Breakevens */}
          {payoff.breakevens.filter((be) => be >= xMin && be <= xMax).map((be) => (
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
          {spot > 0 && spot >= xMin && spot <= xMax && (
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
    </div>
  );
}
