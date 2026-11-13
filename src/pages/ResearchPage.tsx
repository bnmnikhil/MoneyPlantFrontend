import { useMemo } from "react";
import { ArrowDown, ArrowUp, FileSearch, Search } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/states";
import { dateLabel } from "@/features/research/fundamentals";
import { useStockList } from "@/features/research/hooks";
import {
  listingRow, parseSort, searchStocks, sortStocks, type ListingRow, type SortDir, type SortKey, type StockListing, type Tone,
} from "@/features/research/search";
import { cn } from "@/lib/utils";

const toneClass: Record<Tone, string> = { up: "text-profit", down: "text-loss", flat: "" };
const panel = "rounded-lg border border-border bg-card";

interface Column {
  key: SortKey;
  label: string;
  /** Spelled out for screen readers and the header's tooltip. */
  title: string;
  cell: (row: ListingRow) => { text: string; tone?: Tone; note?: string };
}

const COLUMNS: Column[] = [
  { key: "change", label: "Price", title: "Latest daily close and its change on the day before", cell: (r) => ({ text: r.price, note: r.change, tone: r.changeTone }) },
  { key: "pe", label: "P/E", title: "Latest close over the last four quarters' EPS", cell: (r) => ({ text: r.pe }) },
  { key: "revenue", label: "Revenue", title: "Revenue over the last four quarters, ₹ crore", cell: (r) => ({ text: r.revenue }) },
  { key: "profit", label: "Net profit", title: "Net profit over the last four quarters, ₹ crore", cell: (r) => ({ text: r.profit, tone: r.profitTone }) },
  { key: "margin", label: "Op. margin", title: "Operating margin in the latest quarter", cell: (r) => ({ text: r.margin }) },
  { key: "revenueGrowth", label: "Rev. growth", title: "Last four quarters' revenue against the four before", cell: (r) => ({ text: r.revenueGrowth, tone: r.revenueGrowthTone }) },
  { key: "profitGrowth", label: "Profit growth", title: "Last four quarters' net profit against the four before", cell: (r) => ({ text: r.profitGrowth, tone: r.profitGrowthTone }) },
];

/** The date most rows' prices are from: one line under the table instead of a date in every cell. */
function commonPriceDate(stocks: StockListing[]): string | null {
  const counts = new Map<string, number>();
  for (const s of stocks) if (s.priceDate) counts.set(s.priceDate, (counts.get(s.priceDate) ?? 0) + 1);
  let best: string | null = null;
  for (const [date, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = date;
  return best;
}

/**
 * Research: find a company by symbol or name, and compare the loaded ones on figures worked out
 * from their filings. Each row opens the stock page.
 */
export function ResearchPage() {
  const list = useStockList();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const { key, dir } = parseSort(params.get("sort"));
  const state = list.data;
  const stocks = state?.status === "loaded" ? state.stocks : undefined;

  const shown = useMemo(() => {
    if (!stocks) return [];
    // A query ranks by how well each company matches; without one, the chosen column decides.
    return query.trim() ? searchStocks(sortStocks(stocks, key, dir), query) : sortStocks(stocks, key, dir);
  }, [stocks, query, key, dir]);
  const rows = useMemo(() => shown.map((stock) => listingRow(stock)), [shown]);
  const priceDate = stocks ? commonPriceDate(stocks) : null;

  const update = (next: { q?: string; sort?: string }) => {
    const merged = new URLSearchParams(params);
    for (const [name, value] of Object.entries(next)) {
      if (value) merged.set(name, value);
      else merged.delete(name);
    }
    setParams(merged, { replace: true });
  };
  const sortBy = (column: SortKey) => {
    const nextDir: SortDir = column === key ? (dir === "asc" ? "desc" : "asc") : column === "symbol" ? "asc" : "desc";
    update({ sort: column === "symbol" && nextDir === "asc" ? "" : `${column}.${nextDir}` });
  };

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
      <PageHeader title="Research"
        description={stocks
          ? `Quarterly results of ${stocks.length} ${stocks.length === 1 ? "company" : "companies"}, from their own filings with NSE.`
          : "Quarterly results from the companies' own filings with NSE."} />

      <form role="search" className="relative max-w-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim() && shown[0]) navigate(`/app/stocks/${encodeURIComponent(shown[0].symbol)}`);
        }}>
        <label htmlFor="research-search" className="sr-only">Search by company name or NSE symbol</label>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="research-search" type="search" value={query} autoComplete="off" spellCheck={false}
          placeholder="Company or symbol, e.g. TCS"
          onChange={(event) => update({ q: event.target.value })}
          className="h-11 pl-9 text-base" />
      </form>

      {list.isLoading && <Skeleton className="h-96 w-full" />}
      {list.isError && (
        <div className={panel}><ErrorState title="Couldn't load the companies" onRetry={() => { void list.refetch(); }} /></div>
      )}

      {stocks && stocks.length === 0 && (
        <div className={panel}>
          <EmptyState icon={<FileSearch />} title="No companies loaded yet"
            description="Companies appear here once their results have been imported." />
        </div>
      )}

      {stocks && stocks.length > 0 && rows.length === 0 && (
        <div className={panel}>
          <EmptyState icon={<Search />} title={`No loaded company matches “${query.trim()}”`}
            description="Only companies whose results have been imported are listed. Banks, NBFCs and insurers are not loaded yet." />
        </div>
      )}

      {rows.length > 0 && (
        <section aria-label="Companies" className={cn(panel, "space-y-3 p-2 sm:p-3")}>
          <p aria-live="polite" className="px-2 pt-1 text-xs text-muted-foreground">
            {query.trim() ? `${rows.length} of ${stocks?.length} companies match` : `${rows.length} companies`}
            {" · "}₹ crore over the last four quarters
          </p>
          <div className="relative overflow-x-auto [scrollbar-color:var(--gb-thumb)_transparent] [scrollbar-width:thin]">
            <table className="w-full min-w-[52rem] border-collapse text-sm tabular-nums">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <SortHeader column="symbol" label="Company" title="NSE symbol" active={key} dir={dir} onSort={sortBy}
                    className="sticky left-0 z-10 w-44 min-w-44 bg-card text-left sm:w-auto" />
                  {COLUMNS.map((c) => (
                    <SortHeader key={c.key} column={c.key} label={c.label} title={c.title} active={key} dir={dir} onSort={sortBy}
                      className="text-right" />
                  ))}
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Latest</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.symbol} className="group cursor-pointer border-b border-border last:border-b-0 hover:bg-secondary/60"
                    onClick={() => navigate(`/app/stocks/${encodeURIComponent(row.symbol)}`)}>
                    <th scope="row" className="sticky left-0 w-44 min-w-44 bg-card px-3 py-2.5 text-left font-normal group-hover:bg-secondary sm:w-auto">
                      <Link to={`/app/stocks/${encodeURIComponent(row.symbol)}`} onClick={(event) => event.stopPropagation()}
                        className="font-semibold text-primary underline-offset-2 hover:underline">
                        {row.symbol}
                      </Link>
                      <span className="block max-w-[14rem] truncate text-xs text-muted-foreground" title={row.name}>{row.name}</span>
                    </th>
                    {COLUMNS.map((c) => {
                      const cell = c.cell(row);
                      return (
                        <td key={c.key} className="whitespace-nowrap px-3 py-2.5 text-right">
                          <span className={cn(cell.tone && !cell.note && toneClass[cell.tone])}>{cell.text}</span>
                          {cell.note && <span className={cn("block text-xs", cell.tone ? toneClass[cell.tone] : "text-muted-foreground")}>{cell.note}</span>}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-muted-foreground" title={row.basis}>{row.latest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {stocks && stocks.length > 0 && (
        <p className="pb-4 text-xs text-muted-foreground">
          {priceDate ? `Prices are the close of ${dateLabel(priceDate)}. ` : ""}
          Figures are consolidated where the company files both, worked out by GoldenBook from its filings; a dash means
          fewer than four (or, for growth, eight) consecutive quarters are loaded. Banks, NBFCs and insurers are not loaded yet.
          GoldenBook does not give investment advice or recommendations.
        </p>
      )}
    </div>
  );
}

function SortHeader({ column, label, title, active, dir, onSort, className }: {
  column: SortKey; label: string; title: string; active: SortKey; dir: SortDir;
  onSort: (column: SortKey) => void; className?: string;
}) {
  const on = column === active;
  const numeric = column !== "symbol";
  const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
  const arrow = on ? <Arrow aria-hidden="true" className="size-3.5" /> : <span aria-hidden="true" className="inline-block size-3.5" />;
  return (
    <th scope="col" aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("whitespace-nowrap px-1 py-1 font-medium", className)}>
      <button type="button" title={title} onClick={() => onSort(column)}
        className={cn("inline-flex min-h-11 items-center gap-1 rounded px-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          on && "text-foreground")}>
        {/* The arrow sits on the side away from the numbers, so the label lines up with its column. */}
        {numeric && arrow}
        {label}
        <span className="sr-only">, {title}</span>
        {!numeric && arrow}
      </button>
    </th>
  );
}
