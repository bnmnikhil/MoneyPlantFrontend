import { useMemo } from "react";
import { RefreshBar } from "@/components/RefreshBar";
import { EmptyState, ErrorState } from "@/components/states";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectBrokerCard } from "@/features/session/ConnectBrokerCard";
import { ConnectError } from "@/features/session/ConnectError";
import { useBrokerStatus, useConnectBroker } from "@/features/session/hooks";
import { useMargins, usePositions } from "@/features/positions/hooks";
import { useHoldings } from "@/features/holdings/hooks";
import { useRiskSummary } from "@/features/risk/hooks";
import { buildBrokerRows } from "@/features/dashboard/aggregate";
import { AccountsTable } from "@/features/dashboard/AccountsTable";
import { AttentionBand } from "@/features/dashboard/AttentionBand";
import { CapitalSummary } from "@/features/dashboard/CapitalSummary";
import { OverviewMoney } from "@/features/dashboard/OverviewFigures";
import { attention as buildAttention } from "@/features/dashboard/attention";
import { capitalUtilisation } from "@/features/dashboard/overview";
import type { BrokerWarning } from "@/types/api";

function mergeWarnings(...lists: (BrokerWarning[] | undefined)[]) {
  const seen = new Map<string, BrokerWarning>();
  for (const list of lists) for (const warning of list ?? []) {
    seen.set(`${warning.connectionId}-${warning.code}`, warning);
  }
  return [...seen.values()];
}

/**
 * The Overview (OVERVIEW-REDESIGN.md): how am I doing (the strip), where is it (one accounts table),
 * and what should I do (Needs attention). The per-account warning banners other pages show are not
 * repeated here: the attention band's "To fix" card carries them, with the action.
 */
export function DashboardPage() {
  const status = useBrokerStatus();
  const positions = usePositions();
  const holdings = useHoldings();
  const margins = useMargins();
  const risk = useRiskSummary();
  const connect = useConnectBroker();
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
  const accountLabels = useMemo(() => new Map(status.connections.map((c) => [c.connectionId, c.accountLabel])), [status.connections]);
  const credentialLabels = useMemo(() => new Map(status.connections.map((c) => [c.connectionId, c.credentialLabel])), [status.connections]);
  const tableProps = { rows, totals, positionWarnings, holdingWarnings, marginWarnings };

  const metrics = [
    { label: "Total P&L", value: pnlFailed || (!positionsKnown && !holdingsKnown) ? null : totals.totalPnl, loading: pnlLoading, partial: positionsPartial || holdingsPartial, hint: "Positions + holdings, since entry" },
    { label: "Positions P&L", value: positions.isError || !positionsKnown ? null : totals.positionsPnl, loading: positions.isLoading, partial: positionsPartial, hint: positionsKnown ? `${totals.positionCount} open leg${totals.positionCount === 1 ? "" : "s"}` : undefined },
    { label: "Holdings P&L", value: holdings.isError || !holdingsKnown ? null : totals.holdingsPnl, loading: holdings.isLoading, partial: holdingsPartial, hint: holdingsKnown ? `${totals.holdingCount} stock${totals.holdingCount === 1 ? "" : "s"}` : undefined },
    { label: "Day P&L", value: positions.isError || !positionsKnown ? null : totals.dayPnl, loading: positions.isLoading, partial: positionsPartial, hint: "Positions only" },
  ];

  // Built only once the inputs it reads have loaded, so a card never appears and vanishes on load.
  const ready = !!positions.data && !!margins.data && !!status.data;
  const attention = ready ? buildAttention({
    rows, positions: positions.data!.items, status: status.data, warnings, now: new Date(),
    risk: risk.data ? { freshness: risk.data.freshness, asOf: risk.data.asOf } : undefined,
  }) : null;

  return <div className="overview-page">
    <h1 className="sr-only">Overview</h1>
    <ConnectError />
    {status.data && !status.anyConnected ? <ConnectBrokerCard /> : <>
      <section className="overview-summary" aria-label="Portfolio summary">
        {metrics.map((metric) => <div className="overview-metric" key={metric.label}>
          <div className="text-base text-muted-foreground">{metric.label}</div>
          <div className="overview-metric-value">
            {metric.loading ? <Skeleton className="h-9 w-32" /> : <OverviewMoney value={metric.value} partial={metric.partial} />}
          </div>
          {metric.hint && <p className="text-sm text-muted-foreground">{metric.hint}</p>}
        </div>)}
        <div className="overview-metric overview-capital" title="Combined view only. Capital remains in separate broker accounts.">
          {margins.isLoading ? <Skeleton className="h-14 w-full" /> : <CapitalSummary rows={rows} utilisation={utilisation} partial={marginsPartial} />}
        </div>
      </section>

      <section className="overview-panel overview-accounts" aria-labelledby="overview-accounts-title">
        <div className="overview-panel-title">
          <h2 id="overview-accounts-title">Accounts</h2>
          <span className="overview-panel-sub">P&amp;L and capital per account. Capital is held separately in each.</span>
          <RefreshBar updatedAt={updatedAt} isFetching={isFetching} onRefresh={refreshAll} />
        </div>
        {pnlLoading || margins.isLoading ? <TableSkeleton headers={["Account", "Positions", "Holdings", "Total P&L", "Day P&L", "Available", "Used", "Utilisation"]} rows={4} />
          : pnlFailed && margins.isError ? <ErrorState title="Couldn't load your accounts" onRetry={refreshAll} />
          : rows.length === 0 ? <EmptyState title="Nothing to report yet" />
          : <AccountsTable {...tableProps} />}
      </section>

      {attention && <AttentionBand attention={attention} rows={rows} accountLabels={accountLabels} credentialLabels={credentialLabels}
        onConnect={(brokerId, label) => connect.mutate({ brokerId, label })}
        connecting={connect.isPending ? connect.variables?.brokerId ?? null : null} />}
    </>}
  </div>;
}
