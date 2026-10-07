import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Payoff } from "@/types/api";
import { useState, useId } from "react";
import { chartPoints, defaultRange, niceTicks, rangeAnchor, validRange } from "./chartRange";
import type { ChartLeg, PriceRange } from "./chartRange";
import { layoutReferenceLabels } from "./referenceLabels";
import type { ReferenceLabel } from "./referenceLabels";
import { PayoffTooltip } from "./PayoffTooltip";
import { formatINRWhole, formatNumber, formatPrice } from "@/lib/format";

const GREEN = "#3FCB85";
const RED = "#FF6B5E";
const MUTED = "hsl(var(--muted-foreground))";
// Spot is drawn in the text colour: amber would read as the brand gold.
const SPOT = "#F2EDE3";

function ChartReferenceLabel({ viewBox, marker, color }: {
  viewBox?: { x?: number; y?: number };
  marker?: ReferenceLabel;
  color: string;
}) {
  if (!marker || viewBox?.x === undefined || viewBox.y === undefined) return null;
  return <text className="payoff-reference-label" x={viewBox.x + marker.dx}
    y={viewBox.y + 12 + marker.row * 17} textAnchor="middle" fill={color}
    fontSize={marker.fontSize} fontWeight={marker.key === "spot" ? 600 : 400}>
    {marker.text}
  </text>;
}

export function PayoffChart({
  payoff,
  spot,
  legs,
  isIndex,
  baseline,
  variant = "default",
  labels = { baseline: "Existing positions", current: "After adjustments" },
  axisTitles = true,
}: {
  payoff: Payoff;
  spot: number;
  legs: ChartLeg[];
  isIndex: boolean;
  baseline?: { payoff: Payoff; legs: ChartLeg[] };
  variant?: "default" | "live" | "builder";
  /** Legend wording when a baseline is drawn: the builder compares adjustments, Payoff a what-if. */
  labels?: { baseline: string; current: string };
  /** False drops the "P&L (₹)" and "Underlying price (₹)" titles; the tick labels already carry the units. */
  axisTitles?: boolean;
}) {
  const styled = variant !== "default";
  const [chartWidth, setChartWidth] = useState(0);
  const [mode, setMode] = useState<"auto" | "custom" | number>("auto");
  const [custom, setCustom] = useState<PriceRange | null>(null);
  const [draftLow, setDraftLow] = useState("");
  const [draftHigh, setDraftHigh] = useState("");
  const [editing, setEditing] = useState(false);
  const rangeLegs = baseline ? [...baseline.legs, ...legs] : legs;
  const anchor = rangeAnchor(spot, rangeLegs);
  const auto = defaultRange(spot, isIndex, rangeLegs,
    baseline ? [...payoff.breakevens, ...baseline.payoff.breakevens] : payoff.breakevens);
  const [xMin, xMax] = mode === "custom" && custom ? custom
    : typeof mode === "number" ? [anchor * (1 - mode), anchor * (1 + mode)] : auto;
  // The plotting area excludes the 72px Y axis and the 8px/16px chart margins.
  const referenceLabels = layoutReferenceLabels([
    ...(spot > 0 ? [{ key: "spot", value: spot, text: `Spot ${formatPrice(spot)}` }] : []),
    ...payoff.breakevens.map((be) => ({ key: `be-${be}`, value: be, text: formatPrice(be) })),
  ], [xMin, xMax], chartWidth - 96);
  const points = chartPoints(legs, [xMin, xMax], [
    ...payoff.breakevens,
    ...(baseline?.payoff.breakevens ?? []),
    spot,
  ]).map((point) => baseline ? { ...point, baselinePnl: pnlAtSpot(baseline.legs, point.spot) } : point);
  const id = useId().replace(/:/g, "");
  const fillId = `payoffFill${id}`, strokeId = `payoffStroke${id}`;
  const draftValid = draftLow.trim() !== "" && draftHigh.trim() !== "" && validRange(Number(draftLow), Number(draftHigh));

  const pnls = points.flatMap((point) => [point.pnl,
    "baselinePnl" in point ? point.baselinePnl : point.pnl]);
  const maxPnl = Math.max(...pnls, 0);
  const minPnl = Math.min(...pnls, 0);

  // Fraction (from top) where P&L = 0 sits — used to split the gradient color.
  const gradientOffset =
    maxPnl <= 0 ? 0 : minPnl >= 0 ? 1 : maxPnl / (maxPnl - minPnl);

  return (
    <div className={styled ? `payoff-chart-live ${variant === "builder" ? "builder-chart" : ""}` : "space-y-3"}>
      <details open={variant === "builder" ? undefined : true} className={variant === "builder" ? "builder-range-menu" : "contents"}>
      <summary className={variant === "builder" ? "" : "hidden"}>Price range · {formatINRWhole(xMin)} – {formatINRWhole(xMax)}</summary>
      <div className={styled ? "payoff-range-controls" : "flex flex-wrap items-center gap-2 text-xs"}>
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
      <p className={styled ? "payoff-range-caption" : "text-xs text-muted-foreground"}>{formatINRWhole(xMin)} – {formatINRWhole(xMax)}. {spot > 0 ? "" : "Spot unavailable; range centred on strategy prices. "}Zoom changes the view only; profit/loss limits remain unchanged.</p>
      </details>
      {baseline && (
        <div className="flex gap-4 text-xs">
          <span className="text-muted-foreground">- - {labels.baseline}</span>
          <span className="font-medium text-primary">— {labels.current}</span>
        </div>
      )}
    {styled && axisTitles && <p className="px-5 pt-2 text-sm text-muted-foreground">P&amp;L (₹)</p>}
    <div className={styled ? "payoff-chart-canvas" : "h-[380px] w-full"}>
      <ResponsiveContainer width="100%" height="100%" onResize={(width) => setChartWidth(width)}>
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

          {styled && <CartesianGrid stroke="#2C2821" strokeOpacity={0.7} />}

          <XAxis
            dataKey="spot"
            type="number"
            domain={[xMin, xMax]}
            ticks={niceTicks(xMin, xMax)}
            allowDataOverflow
            tickFormatter={(v) => styled ? formatNumber(v) : formatINRWhole(v)}
            tick={{ fill: MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            minTickGap={48}
          />
          <YAxis
            domain={[minPnl, maxPnl === minPnl ? maxPnl + 1 : maxPnl]}
            ticks={niceTicks(minPnl, maxPnl === minPnl ? maxPnl + 1 : maxPnl, 5)}
            tickFormatter={(v) => styled ? formatNumber(v) : formatINRWhole(v)}
            tick={{ fill: MUTED, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={72}
          />

          <Tooltip
            content={<PayoffTooltip referenceSpot={spot} />}
            cursor={{ stroke: MUTED, strokeDasharray: "3 3" }}
          />

          <Area
            type="linear"
            dataKey="pnl"
            stroke={`url(#${strokeId})`}
            strokeWidth={2}
            fill={`url(#${fillId})`}
            dot={false}
            activeDot={styled ? { r: 6, stroke: GREEN, strokeWidth: 4, fill: "#F2EDE3" } : { r: 3 }}
            isAnimationActive={false}
          />
          {baseline && (
            <Line type="linear" dataKey="baselinePnl" stroke={MUTED} strokeWidth={1.75}
              strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />
          )}

          {/* P&L baseline */}
          <ReferenceLine y={0} stroke={MUTED} strokeWidth={1.25} strokeDasharray={styled ? "5 4" : undefined} />

          {/* Breakevens */}
          {payoff.breakevens.filter((be) => be >= xMin && be <= xMax).map((be) => (
            <ReferenceLine
              key={be}
              x={be}
              stroke={MUTED}
              strokeDasharray="3 3"
              strokeOpacity={0.7}
              label={styled ? <ChartReferenceLabel marker={referenceLabels.find((label) => label.key === `be-${be}`)} color={MUTED} /> : {
                value: formatPrice(be),
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
              stroke={SPOT}
              strokeDasharray="4 4"
              label={styled ? <ChartReferenceLabel marker={referenceLabels.find((label) => label.key === "spot")} color={SPOT} /> : {
                value: `Spot ${formatPrice(spot)}`,
                position: "insideTopRight",
                fill: SPOT,
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    {styled && axisTitles && <p className="pb-2 text-center text-sm text-muted-foreground">Underlying price (₹)</p>}
    </div>
  );
}

function pnlAtSpot(legs: ChartLeg[], spot: number) {
  return Math.round(100 * legs.reduce((sum, leg) => {
    const value = leg.type === "CE" ? Math.max(spot - leg.strike, 0)
      : leg.type === "PE" ? Math.max(leg.strike - spot, 0) : spot;
    return sum + (value - leg.avgPrice) * leg.qty;
  }, 0)) / 100;
}
