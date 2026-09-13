import { RefreshBar } from "@/components/RefreshBar";
import { EmptyState, ErrorState } from "@/components/states";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectBrokerCard } from "@/features/session/ConnectBrokerCard";
import { ConnectError } from "@/features/session/ConnectError";
import { BrokerWarnings } from "@/features/session/BrokerWarnings";
import { useBrokerStatus } from "@/features/session/hooks";
import { useMargins, usePositions } from "@/features/positions/hooks";
import { useHoldings } from "@/features/holdings/hooks";
import { buildBrokerRows } from "@/features/dashboard/aggregate";
import { OverviewPnlTable, OverviewCapitalTable } from "@/features/dashboard/OverviewBrokerTables";
import { OverviewMoney, UtilisationBar } from "@/features/dashboard/OverviewFigures";
import { OverviewPreview } from "@/features/dashboard/OverviewPreview";
import { capitalUtilisation } from "@/features/dashboard/overview";
import type { BrokerWarning } from "@/types/api";

function mergeWarnings(...lists: (BrokerWarning[] | undefined)[]) {
  const seen = new Map<string, BrokerWarning>();
  for (const list of lists) for (const warning of list ?? []) {
    seen.set(`${warning.connectionId}-${warning.code}`, warning);
  }
  return [...seen.values()];
}

export function DashboardPage() {
  const status = useBrokerStatus();
  const positions = usePositions();
  const holdings = useHoldings();
  const margins = useMargins();
  const { rows, totals } = buildBrokerRows(positions.data?.items ?? [], holdings.data?.items ?? [], margins.data?.items ?? []);
  const positionWarnings = positions.data?.warnings ?? [];
  const holdingWarnings = holdings.data?.warnings ?? [];
  const marginWarnings = margins.data?.warnings ?? [];
  const warnings = mergeWarnings(positionWarnings, holdingWarnings, marginWarnings);
  const pnlLoading = positions.isLoading || holdings.isLoading;
  const pnlFailed = positions.isError || holdings.isError;
  const positionsPartial = positionWarnings.length > 0;
  const holdingsPartial = holdingWarnings.length > 0;
  const marginsPartial = marginWarnings.length > 0 || rows.some((row) => row.margin === null);
  const positionsKnown = !!positions.data && !(positionsPartial && totals.positionCount === 0);
  const holdingsKnown = !!holdings.data && !(holdingsPartial && totals.holdingCount === 0);
  const knownCapital = !margins.isError && rows.some((row) => row.margin !== null);
  const utilisation = knownCapital ? capitalUtilisation(totals.available, totals.used) : null;
  const updatedTimes = [positions.dataUpdatedAt, holdings.dataUpdatedAt, margins.dataUpdatedAt].filter((time) => time > 0);
  const updatedAt = updatedTimes.length ? Math.min(...updatedTimes) : 0;
  const isFetching = positions.isFetching || holdings.isFetching || margins.isFetching;
  const refreshAll = () => { void positions.refetch(); void holdings.refetch(); void margins.refetch(); };
  const accountLabels = new Map(status.connections.map((connection) => [connection.connectionId, connection.accountLabel]));
  const tableProps = { rows, totals, positionWarnings, holdingWarnings, marginWarnings };
  const metrics = [
    { label: "Total P&L", value: pnlFailed || (!positionsKnown && !holdingsKnown) ? null : totals.totalPnl, loading: pnlLoading, partial: positionsPartial || holdingsPartial },
    { label: "Positions P&L", value: positions.isError || !positionsKnown ? null : totals.positionsPnl, loading: positions.isLoading, partial: positionsPartial },
    { label: "Holdings P&L", value: holdings.isError || !holdingsKnown ? null : totals.holdingsPnl, loading: holdings.isLoading, partial: holdingsPartial },
    { label: "Day P&L", value: positions.isError || !positionsKnown ? null : totals.dayPnl, loading: positions.isLoading, partial: positionsPartial, hint: "(Positions only)" },
  ];

  return <div className="overview-page">
    <h1 className="sr-only">Overview</h1>
    <ConnectError />
    {status.data && !status.anyConnected ? <ConnectBrokerCard /> : <>
      <BrokerWarnings warnings={warnings} />
      <section className="overview-summary" aria-label="Portfolio summary">
        {metrics.map((metric) => <div className="overview-metric" key={metric.label}>
          <div className="text-base text-muted-foreground">{metric.label}</div>
          <div className="mt-1 text-[clamp(1.3rem,1.9vw,2rem)] leading-tight">
            {metric.loading ? <Skeleton className="h-9 w-32" /> : <OverviewMoney value={metric.value} partial={metric.partial} />}
          </div>
          {metric.hint && <p className="text-sm text-muted-foreground">{metric.hint}</p>}
        </div>)}
        <div className="overview-metric overview-capital" title="Combined view only. Capital remains in separate broker accounts.">
          <div className="mb-1 text-base text-muted-foreground">Capital{marginsPartial && knownCapital && <span className="ml-1 text-amber-300" aria-label="Partial capital total">*</span>}</div>
          {margins.isLoading ? <Skeleton className="h-10 w-full" /> : <UtilisationBar percent={utilisation} large />}
        </div>
      </section>

      <div className="overview-broker-grid">
        <section className="overview-panel" aria-labelledby="overview-pnl-title">
          <h2 id="overview-pnl-title" className="overview-panel-title">P&amp;L by broker</h2>
          {pnlLoading ? <TableSkeleton headers={["Broker", "Positions P&L", "Holdings P&L", "Total P&L", "Day P&L"]} rows={4} />
            : pnlFailed ? <ErrorState title="Couldn't load P&L" onRetry={refreshAll} />
            : rows.length === 0 ? <EmptyState title="Nothing to report yet" />
            : <OverviewPnlTable {...tableProps} />}
        </section>
        <section className="overview-panel" aria-labelledby="overview-capital-title">
          <h2 id="overview-capital-title" className="overview-panel-title">Capital by broker</h2>
          {margins.isLoading ? <TableSkeleton headers={["Broker", "Available", "Used", "Utilisation"]} rows={4} />
            : margins.isError ? <ErrorState title="Couldn't load capital" onRetry={() => { void margins.refetch(); }} />
            : rows.length === 0 ? <EmptyState title="No capital to show" />
            : <OverviewCapitalTable {...tableProps} />}
        </section>
      </div>

      <div className="overview-preview-grid">
        <OverviewPreview kind="positions" items={positions.data?.items ?? []} loading={positions.isLoading} failed={positions.isError} retry={() => { void positions.refetch(); }} accountLabels={accountLabels} />
        <OverviewPreview kind="holdings" items={holdings.data?.items ?? []} loading={holdings.isLoading} failed={holdings.isError} retry={() => { void holdings.refetch(); }} accountLabels={accountLabels} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>Capital is held separately in each account.{(positionsPartial || holdingsPartial || marginsPartial) && " * Partial totals: some account data is unavailable."}</p>
        <RefreshBar updatedAt={updatedAt} isFetching={isFetching} onRefresh={refreshAll} />
      </div>
    </>}
  </div>;
}
