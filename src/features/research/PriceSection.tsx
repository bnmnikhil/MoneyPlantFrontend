import { useMemo, useState } from "react";
import { LineChart as LineIcon } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import { useStockPrices } from "@/features/research/hooks";
import {
  PRICE_RANGES, axisTicks, dateLabel, dayMove, daysInRange, priceFigures, pricePoints, rupees, sharesAxisLabel, sharesLabel,
  tickLabel,
  type PricePoint, type PriceRange,
} from "@/features/research/prices";
import { cn } from "@/lib/utils";

const panel = "rounded-lg border border-border bg-card p-4 sm:p-5";
const toneClass = { up: "text-profit", down: "text-loss", flat: "text-muted-foreground" } as const;

// The line takes the direction over the shown range, as traders read it: green up, red down,
// neutral when flat. Volume stays neutral; gold stays for what is the user's.
const LINE = {
  up: "hsl(var(--profit))",
  down: "hsl(var(--loss))",
  flat: "#D8CFBF",
} as const;
const DELIVERED = "#A79E8E";
const NOT_DELIVERED = "#4F483D";
const GRID = "#2C2821";
const MUTED = "hsl(var(--muted-foreground))";
const SYNC = "stock-price";
const AXIS_WIDTH = 60;

/** Keeps recharts' crosshair but draws no box of its own: the readout above the chart is the tooltip. */
const NoTooltip = () => null;

/**
 * Price, volume and delivery for one stock (AN-26): two panels on one date axis, never two scales
 * on one chart. The readout above follows the cursor and rests on the latest day.
 */
export function PriceSection({ symbol }: { symbol: string }) {
  const query = useStockPrices(symbol);
  const [range, setRange] = useState<PriceRange>("1Y");
  const [hovered, setHovered] = useState<number | null>(null);

  const days = useMemo(() => daysInRange(query.data?.days ?? [], range), [query.data, range]);
  const points = useMemo(() => pricePoints(days), [days]);
  const figures = useMemo(() => priceFigures(days, range), [days, range]);
  const ticks = useMemo(() => axisTicks(points, range), [points, range]);
  const shown: PricePoint | undefined = points[hovered ?? points.length - 1];

  const track = (state: { activeTooltipIndex?: number } | undefined) => {
    const index = state?.activeTooltipIndex;
    setHovered(typeof index === "number" && index >= 0 ? index : null);
  };

  if (query.isLoading) return <Skeleton className="h-80 w-full" />;
  if (query.isError) {
    return <div className={panel}><ErrorState title="Couldn't load this stock's prices" onRetry={() => { void query.refetch(); }} /></div>;
  }
  if (!figures || !shown) {
    return (
      <div className={panel}>
        <EmptyState icon={<LineIcon />} title={`No daily prices stored for ${symbol} yet`}
          description="The price chart appears once NSE's daily files covering this stock have been loaded." />
      </div>
    );
  }

  const line = LINE[figures.changeTone];

  return (
    <section aria-label="Price, volume and delivery" className={cn(panel, "space-y-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Price, volume and delivery</h2>
          <p className="text-xs text-muted-foreground">
            <span className={cn("font-semibold", toneClass[figures.changeTone])}>{figures.change}</span> over {range === "1Y" ? "the year" : range}
            {/* Intraday extremes, so they can sit outside the closes the line draws: say so. */}
            {" · "}intraday low {figures.low}, high {figures.high}
          </p>
        </div>
        <div role="group" aria-label="Range" className="flex overflow-hidden rounded-md border border-[var(--gb-control-edge)]">
          {PRICE_RANGES.map((option) => (
            <button key={option} type="button" aria-pressed={option === range}
              onClick={() => { setRange(option); setHovered(null); }}
              className={cn("min-h-11 min-w-11 px-3 text-sm", option === range
                ? "bg-[var(--gb-gold-soft)] font-semibold text-primary" : "text-muted-foreground hover:text-foreground")}>
              {option}
            </button>
          ))}
        </div>
      </div>

      {/* The readout: the hovered day, or the latest. Fixed height so it never shifts the chart. */}
      <dl aria-live="off" className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm tabular-nums sm:flex sm:flex-wrap sm:items-baseline">
        <div className="col-span-2 sm:col-auto">
          <dt className="sr-only">Date</dt>
          <dd className="text-xs text-muted-foreground">{dateLabel(shown.date)}{hovered === null ? " · latest" : ""}</dd>
        </div>
        <Readout label="Close" value={rupees(shown.close)} note={dayMove(shown)}
          noteTone={shown.prevClose === null ? "flat" : shown.close > shown.prevClose ? "up" : shown.close < shown.prevClose ? "down" : "flat"} />
        <Readout label="Volume" value={sharesLabel(shown.volume)} />
        <Readout label="Delivered" value={sharesLabel(shown.delivered)} />
        <Readout label="Delivery" value={shown.deliveryPct === null ? "—" : `${shown.deliveryPct.toFixed(1)}%`} />
      </dl>

      <div onMouseLeave={() => setHovered(null)}>
        <div className="h-52 sm:h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} syncId={SYNC} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
              onMouseMove={track} onMouseLeave={() => setHovered(null)}>
              <defs>
                <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={line} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={line} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="date" hide />
              <YAxis orientation="right" width={AXIS_WIDTH} domain={["auto", "auto"]} axisLine={false} tickLine={false}
                tick={{ fill: MUTED, fontSize: 11 }} tickFormatter={(v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`} />
              <Tooltip content={NoTooltip} cursor={{ stroke: MUTED, strokeWidth: 1, strokeDasharray: "3 3" }} isAnimationActive={false} />
              <Area type="linear" dataKey="close" stroke={line} strokeWidth={2} fill="url(#price-fill)" isAnimationActive={false}
                activeDot={{ r: 4, fill: line, stroke: "hsl(var(--card))", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="h-24 sm:h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} syncId={SYNC} barCategoryGap={1} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}
              onMouseMove={track} onMouseLeave={() => setHovered(null)}>
              <XAxis dataKey="date" axisLine={{ stroke: GRID }} tickLine={false} minTickGap={24} interval="preserveStartEnd"
                ticks={ticks} tick={{ fill: MUTED, fontSize: 11 }} tickFormatter={(v: string) => tickLabel(v, range)} />
              <YAxis orientation="right" width={AXIS_WIDTH} axisLine={false} tickLine={false} tickCount={2}
                tick={{ fill: MUTED, fontSize: 11 }} tickFormatter={(v: number) => (v === 0 ? "" : sharesAxisLabel(v))} />
              <Tooltip content={NoTooltip} cursor={{ fill: "hsl(var(--secondary))" }} isAnimationActive={false} />
              <Bar dataKey="delivered" stackId="volume" fill={DELIVERED} isAnimationActive={false} />
              <Bar dataKey="notDelivered" stackId="volume" fill={NOT_DELIVERED} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-4">
          <span><span aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-sm" style={{ background: DELIVERED }} />Delivered</span>
          <span><span aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-sm" style={{ background: NOT_DELIVERED }} />Traded, not delivered</span>
        </div>
        <p className="tabular-nums">
          Delivery: <span className="font-semibold text-foreground">{figures.deliveryToday}</span> latest
          {" · "}<span className="font-semibold text-foreground">{figures.delivery20}</span> 20-day average
          {" · "}<span className="font-semibold text-foreground">{figures.deliveryRange}</span> over {range === "1Y" ? "the year" : range}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        NSE's daily closing prices, to {figures.asOf}.{figures.shortNote ? ` ${figures.shortNote}.` : ""}
        {query.data?.adjusted ? "" : " As traded: not adjusted for splits or bonuses."} Delivery is the share of the
        day's traded quantity taken as delivery rather than squared off the same day.
      </p>
    </section>
  );
}

function Readout({ label, value, note, noteTone = "flat" }: {
  label: string; value: string; note?: string; noteTone?: keyof typeof toneClass;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">
        {value}
        {note && <span className={cn("ml-1.5 text-xs font-semibold", toneClass[noteTone])}>{note}</span>}
      </dd>
    </div>
  );
}
