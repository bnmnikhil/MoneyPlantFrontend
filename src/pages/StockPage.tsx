import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSearch } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import { brokerLabel } from "@/components/BrokerBadge";
import { useHoldings } from "@/features/holdings/hooks";
import { spotItem } from "@/features/market/tickerItems";
import { usePositions } from "@/features/positions/hooks";
import {
  basesOf, chartBars, dateLabel, exposureIn, keyFigures, quarterLabel, quartersFor, resultRows, resultsAreStale,
  type Basis, type StockFundamentals,
} from "@/features/research/fundamentals";
import { useStockFundamentals } from "@/features/research/hooks";
import { api } from "@/lib/api";
import { formatSignedINRWhole, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";

const toneClass = { up: "text-profit", down: "text-loss", flat: "text-muted-foreground" } as const;
const panel = "rounded-lg border border-border bg-card p-4 sm:p-5";

/**
 * One stock: its quarterly results as the company filed them, a few figures worked out from
 * them, and the user's own positions and holdings in it. Reached from the Research search page.
 */
export function StockPage() {
  const symbol = (useParams().symbol ?? "").toUpperCase();
  const fundamentals = useStockFundamentals(symbol);
  const spot = useQuery({
    queryKey: ["market-data", "spot", symbol],
    queryFn: () => api.spot([symbol]),
    enabled: !!symbol,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const quote = spot.data?.[0];
  const spotLine = spot.data ? spotItem(symbol, quote, brokerLabel, "No live price for this stock") : undefined;
  const price = quote?.price ?? null;
  const state = fundamentals.data;
  const loaded = state?.status === "loaded" ? state.data : undefined;

  // Outside the page's audience: say nothing about the stock, show none of the user's book.
  if (state?.status === "hidden") {
    return (
      <div className="page-stack">
        <div className={panel}>
          <EmptyState icon={<FileSearch />} title="Research is not available yet"
            description="Stock pages are being prepared and are not open to every account." />
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link to="/app/research" className="underline-offset-2 hover:text-foreground hover:underline">Research</Link><span aria-hidden="true">/</span>
        <span className="text-foreground">{symbol}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{loaded?.name ?? symbol}</h1>
          <p className="text-sm text-muted-foreground">NSE: {symbol}</p>
          {spotLine && (
            <p className="flex items-baseline gap-3 pt-1 tabular-nums" title={spotLine.title}>
              <span className="text-2xl font-semibold">{spotLine.price === "—" ? "—" : `₹${spotLine.price}`}</span>
              {spotLine.change && <span className={cn("font-semibold", toneClass[spotLine.tone])}>{spotLine.change}</span>}
              {spotLine.price === "—" && <span className="text-xs text-muted-foreground">{spotLine.title}</span>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link to="/app/payoff">Open payoff</Link></Button>
          <Button asChild variant="outline"><Link to="/app/builder">Try in Builder</Link></Button>
        </div>
      </header>

      {fundamentals.isLoading && <Skeleton className="h-64 w-full" />}
      {fundamentals.isError && (
        <div className={panel}><ErrorState title="Couldn't load this stock's results" onRetry={() => { void fundamentals.refetch(); }} /></div>
      )}
      {state?.status === "not-loaded" && (
        <div className={panel}>
          <EmptyState icon={<FileSearch />} title={`No results loaded for ${symbol}`}
            description="Quarterly results appear here once this stock's filings have been imported." />
        </div>
      )}
      {loaded && <Results data={loaded} price={price} />}

      <Exposure symbol={symbol} />

      <p className="pb-4 text-xs text-muted-foreground">
        Figures are shown as reported by the company. GoldenBook does not give investment advice or recommendations.
      </p>
    </div>
  );
}

function Results({ data, price }: { data: StockFundamentals; price: number | null }) {
  const bases = basesOf(data);
  const [chosen, setChosen] = useState<Basis>();
  const basis = chosen && bases.includes(chosen) ? chosen : bases[0];
  if (!basis) {
    return <div className={panel}><EmptyState icon={<FileSearch />} title="This stock's results file has no quarters" /></div>;
  }
  const quarters = quartersFor(data, basis);
  const latest = quarters[quarters.length - 1];
  const chart = chartBars(quarters);
  const bars = chart.bars;
  const anyLoss = chart.downPx > 0;

  return (
    <>
      {resultsAreStale(latest.periodEnd) && (
        <p role="note" className="rounded-md border border-[var(--gb-gold-edge)] bg-[var(--gb-gold-soft)] px-4 py-2.5 text-sm">
          The latest results loaded are for the quarter ended {dateLabel(latest.periodEnd)}. Later quarters are not loaded yet, so P/E is not shown.
        </p>
      )}
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {keyFigures(quarters, price, new Date(), data.price ?? null).map((figure) => (
          <div key={figure.label} className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{figure.label}</p>
            <p className="text-xl font-semibold tabular-nums">{figure.value}</p>
            <p className="text-xs text-muted-foreground">{figure.note}</p>
          </div>
        ))}
      </section>

      <section className={cn(panel, "space-y-4")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Revenue and net profit by quarter</h2>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span><span aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-sm bg-[var(--gb-bar)]" />Revenue</span>
            <span><span aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-sm bg-profit" />Net profit</span>
            {anyLoss && <span><span aria-hidden="true" className="mr-1.5 inline-block size-2.5 rounded-sm bg-loss" />Net loss</span>}
            <span>₹ crore</span>
          </div>
        </div>
        {/* relative: the positioning context for anything absolute inside (the sr-only labels), so it scrolls with the box instead of widening the page. */}
        <div className="relative overflow-x-auto [scrollbar-color:var(--gb-thumb)_transparent] [scrollbar-width:thin]">
          <ol className="flex min-w-[28rem] items-end gap-3" aria-label="Revenue and net profit for each quarter">
            {bars.map((bar, index) => (
              // Focusable so the tooltip also opens from the keyboard and, on a phone, with a tap.
              <li key={bar.label} tabIndex={0}
                className="group relative flex min-w-0 flex-1 cursor-default flex-col items-center gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="sr-only">{`${bar.label}: revenue ₹${bar.revenue} crore, ${bar.profitIsLoss ? "net loss" : "net profit"} ₹${bar.amount} crore`}</span>
                <span aria-hidden="true" className="text-[11px] tabular-nums text-muted-foreground">{bar.revenue}</span>
                {/* Above the zero line: revenue and a profit. Below it, only when some quarter is a loss: the loss,
                    under the profit bar's slot and on the same scale, with its amount beneath. */}
                <div aria-hidden="true" className="flex w-full flex-col group-hover:bg-secondary/50 group-focus-visible:bg-secondary/50 rounded-sm">
                  <div className="flex w-full items-end justify-center gap-1 border-b border-border" style={{ height: chart.upPx }}>
                    <div className="w-2/5 max-w-8 rounded-t-sm bg-[var(--gb-bar)]" style={{ height: bar.revenuePx }} />
                    <div className="w-2/5 max-w-8 rounded-t-sm bg-profit" style={{ height: bar.profitPx }} />
                  </div>
                  {anyLoss && (
                    <div className="flex w-full items-start justify-center gap-1" style={{ height: chart.downPx }}>
                      <div className="w-2/5 max-w-8" />
                      <div className="w-2/5 max-w-8 rounded-b-sm bg-loss" style={{ height: bar.lossPx }} />
                    </div>
                  )}
                </div>
                {anyLoss && (
                  <span aria-hidden="true" className="h-4 text-[11px] tabular-nums text-loss">{bar.profitIsLoss ? bar.profit : ""}</span>
                )}
                <span aria-hidden="true" className="text-xs text-muted-foreground">{bar.label}</span>
                {/* Inside the bar area, not above it: the chart's scroll box would clip anything outside.
                    The end columns pin to their outer edge so the tooltip never widens the box. */}
                <div aria-hidden="true" className={cn(
                  "pointer-events-none invisible absolute top-6 z-10 w-max min-w-36 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md",
                  "opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100",
                  index === 0 ? "left-0" : index === bars.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                )}>
                  <p className="mb-1 font-semibold text-foreground">{bar.label}</p>
                  <p className="flex items-center justify-between gap-4 tabular-nums">
                    <span className="text-muted-foreground"><span className="mr-1.5 inline-block size-2 rounded-sm bg-[var(--gb-bar)]" />Revenue</span>
                    <span className="font-semibold text-foreground">₹{bar.revenue} cr</span>
                  </p>
                  <p className="flex items-center justify-between gap-4 tabular-nums">
                    <span className="text-muted-foreground">
                      <span className={cn("mr-1.5 inline-block size-2 rounded-sm", bar.profitIsLoss ? "bg-loss" : "bg-profit")} />
                      {bar.profitIsLoss ? "Net loss" : "Net profit"}
                    </span>
                    <span className={cn("font-semibold", bar.profitIsLoss ? "text-loss" : "text-foreground")}>₹{bar.amount} cr</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={cn(panel, "space-y-3")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Quarterly results</h2>
            <p className="text-xs text-muted-foreground">{basis === "consolidated" ? "Consolidated" : "Standalone"} · ₹ crore, EPS in ₹</p>
          </div>
          {bases.length > 1 && (
            <div role="group" aria-label="Basis" className="flex overflow-hidden rounded-md border border-[var(--gb-control-edge)]">
              {bases.map((option) => (
                <button key={option} type="button" aria-pressed={option === basis} onClick={() => setChosen(option)}
                  className={cn("min-h-11 px-4 text-sm capitalize", option === basis
                    ? "bg-[var(--gb-gold-soft)] font-semibold text-primary" : "text-muted-foreground hover:text-foreground")}>
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative overflow-x-auto [scrollbar-color:var(--gb-thumb)_transparent] [scrollbar-width:thin]">
          <table className="w-full min-w-[36rem] border-collapse text-sm tabular-nums">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="sticky left-0 w-36 min-w-36 bg-card px-3 sm:w-auto py-2.5 text-left font-medium"><span className="sr-only">Line item</span></th>
                {quarters.map((q) => <th key={q.periodEnd} scope="col" className="whitespace-nowrap px-3 py-2.5 text-right font-medium">{quarterLabel(q.periodEnd)}</th>)}
              </tr>
            </thead>
            <tbody>
              {resultRows(quarters).map((row) => (
                <tr key={row.label} className={cn("border-b border-border last:border-b-0", row.strong ? "font-semibold" : "text-foreground/80")}>
                  <th scope="row" className="sticky left-0 w-36 min-w-36 bg-card px-3 sm:w-auto sm:whitespace-nowrap py-2.5 text-left font-[inherit]">{row.label}</th>
                  {row.cells.map((cell, index) => <td key={quarters[index].periodEnd} className="px-3 py-2.5 text-right">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          From the company's filings with NSE. Latest: quarter ended {dateLabel(latest.periodEnd)}, approved {dateLabel(latest.approvedOn)}
          {latest.audited ? "" : ", unaudited"}
          {latest.filing && (
            <> (<a href={latest.filing} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">view the filing</a>)</>
          )}. Ratios are calculated by GoldenBook from these figures and the current price.
        </p>
      </section>
    </>
  );
}

function Exposure({ symbol }: { symbol: string }) {
  const positions = usePositions();
  const holdings = useHoldings();
  const loading = positions.isLoading || holdings.isLoading;
  const failed = positions.isError && holdings.isError;
  const accounts = exposureIn(symbol, positions.data?.items ?? [], holdings.data?.items ?? []);
  const total = accounts.reduce((sum, account) => sum + account.pnl, 0);
  const partial = !failed && (positions.isError || holdings.isError
    || (positions.data?.warnings.length ?? 0) > 0 || (holdings.data?.warnings.length ?? 0) > 0);

  return (
    <section aria-label={`Your exposure in ${symbol}`} className={cn(panel, "space-y-3 border-[var(--gb-gold-edge)]")}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Your exposure in {symbol}</h2>
        {accounts.length > 0 && <span className="text-xs text-muted-foreground">{accounts.length} account{accounts.length > 1 ? "s" : ""}</span>}
      </div>
      {loading && <Skeleton className="h-16 w-full" />}
      {!loading && failed && <p className="text-sm text-muted-foreground">Your positions and holdings could not be loaded.</p>}
      {!loading && !failed && accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">You have no positions or holdings in {symbol} in your connected accounts.</p>
      )}
      {accounts.length > 0 && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {accounts.map((account) => (
              <div key={account.connectionId} className="space-y-1.5 rounded-md border border-border bg-[var(--gb-sunken)] px-3.5 py-3">
                <p className="text-xs text-muted-foreground">{brokerLabel(account.broker)}</p>
                {account.lines.map((line, index) => (
                  <p key={index} className="flex justify-between gap-3 text-sm tabular-nums">
                    <span>{line.text}</span>
                    <span className={cn("font-semibold", pnlColor(line.pnl))}>{formatSignedINRWhole(line.pnl)}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
          <p className="flex justify-between border-t border-border pt-3 text-sm tabular-nums">
            <span className="text-muted-foreground">Total P&amp;L in {symbol}{partial ? " (some accounts missing)" : ""}</span>
            <span className={cn("font-bold", pnlColor(total))}>{formatSignedINRWhole(total)}</span>
          </p>
          <Link to="/app/payoff" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-2 hover:underline">
            See the payoff of your {symbol} position →
          </Link>
        </>
      )}
    </section>
  );
}
