import {
  Wallet,
  TrendingUp,
  CalendarDays,
  PiggyBank,
  Landmark,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { RefreshBar } from "@/components/RefreshBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/states";
import { TableSkeleton } from "@/components/TableSkeleton";
import { ConnectBrokerCard } from "@/features/session/ConnectBrokerCard";
import { ConnectError } from "@/features/session/ConnectError";
import { BrokerWarnings } from "@/features/session/BrokerWarnings";
import { useBrokerStatus } from "@/features/session/hooks";
import { useMargins, usePositions } from "@/features/positions/hooks";
import { useHoldings } from "@/features/holdings/hooks";
import { buildBrokerRows } from "@/features/dashboard/aggregate";
import { BrokerPnlTable } from "@/features/dashboard/BrokerPnlTable";
import { BrokerFundsTable } from "@/features/dashboard/BrokerFundsTable";
import type { BrokerWarning } from "@/types/api";
import {
  formatINRWhole,
  formatSignedINR,
  formatNumber,
  pnlColor,
} from "@/lib/format";

const PNL_HEADERS = ["Broker", "Positions", "Holdings", "Total", "Day"];
const FUNDS_HEADERS = [
  "Broker",
  "Available",
  "Used",
  "Total",
  "Cash",
  "Collateral",
];

/**
 * Positions, holdings and margins hit the same brokers, so one dead connection
 * produces the same warning three times. Show it once.
 */
function mergeWarnings(...lists: (BrokerWarning[] | undefined)[]) {
  const seen = new Map<string, BrokerWarning>();
  for (const list of lists) {
    for (const w of list ?? []) {
      seen.set(`${w.connectionId}-${w.code}`, w);
    }
  }
  return [...seen.values()];
}

export function DashboardPage() {
  const status = useBrokerStatus();
  const positions = usePositions();
  const holdings = useHoldings();
  const margins = useMargins();

  // No broker linked at all → prompt to connect, skip the dashboard body.
  const nothingConnected = Boolean(status.data && !status.anyConnected);

  const { rows, totals } = buildBrokerRows(
    positions.data?.items ?? [],
    holdings.data?.items ?? [],
    margins.data?.items ?? []
  );

  const warnings = mergeWarnings(
    positions.data?.warnings,
    holdings.data?.warnings,
    margins.data?.warnings
  );

  const pnlLoading = positions.isLoading || holdings.isLoading;
  const pnlFailed = positions.isError || holdings.isError;

  // The oldest of the three, so the stamp is never optimistic — the same rule
  // BrokerAggregate applies to a mixed-age book.
  const updatedAt = Math.min(
    ...[positions.dataUpdatedAt, holdings.dataUpdatedAt, margins.dataUpdatedAt].filter(
      (t) => t > 0
    )
  );
  const isFetching =
    positions.isFetching || holdings.isFetching || margins.isFetching;

  const refreshAll = () => {
    positions.refetch();
    holdings.refetch();
    margins.refetch();
  };

  return (
    <div className="space-y-6">
      {/* Sits above the branch deliberately. The status query resolves after the
          first render, so a ConnectError mounted inside either arm would be
          torn down mid-transition, taking the ?error= it had already consumed
          with it — the message would flash once and disappear. */}
      <ConnectError />

      {nothingConnected ? (
        <div className="py-4">
          <ConnectBrokerCard />
        </div>
      ) : (
        <>
          <PageHeader
            title="Dashboard"
            description="Your capital and P&L, broker by broker."
            actions={
              <RefreshBar
                updatedAt={Number.isFinite(updatedAt) ? updatedAt : 0}
                isFetching={isFetching}
                onRefresh={refreshAll}
              />
            }
          />

          <BrokerWarnings warnings={warnings} />

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Total P&L"
              icon={<TrendingUp />}
              loading={pnlLoading}
              value={formatSignedINR(totals.totalPnl)}
              valueClassName={pnlColor(totals.totalPnl)}
              hint={`Since entry · ${formatNumber(totals.positionCount)} positions, ${formatNumber(totals.holdingCount)} holdings`}
            />
            <StatCard
              label="Day P&L"
              icon={<CalendarDays />}
              loading={positions.isLoading}
              value={formatSignedINR(totals.dayPnl)}
              valueClassName={pnlColor(totals.dayPnl)}
              hint="Positions only — holdings have no day figure"
            />
            <StatCard
              label="Margin available"
              icon={<Wallet />}
              loading={margins.isLoading}
              value={formatINRWhole(totals.available)}
            />
            <StatCard
              label="Margin used"
              icon={<PiggyBank />}
              loading={margins.isLoading}
              value={formatINRWhole(totals.used)}
              hint={`${totals.utilisationPct.toFixed(0)}% of ${formatINRWhole(totals.total)} total`}
            />
            <StatCard
              label="Collateral"
              icon={<Landmark />}
              loading={margins.isLoading}
              value={formatINRWhole(totals.collateral)}
            />
          </div>

          {/* P&L by broker */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">P&amp;L by broker</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pnlLoading ? (
                <TableSkeleton headers={PNL_HEADERS} rows={3} />
              ) : pnlFailed ? (
                <ErrorState
                  title="Couldn't load P&L"
                  onRetry={() => {
                    positions.refetch();
                    holdings.refetch();
                  }}
                />
              ) : rows.length === 0 ? (
                <EmptyState
                  icon={<Inbox />}
                  title="Nothing to report yet"
                  description="P&L appears here once a connected broker returns positions or holdings."
                />
              ) : (
                <BrokerPnlTable rows={rows} totals={totals} />
              )}
            </CardContent>
          </Card>

          {/* Funds by broker */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Funds by broker</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {margins.isLoading ? (
                <TableSkeleton headers={FUNDS_HEADERS} rows={3} />
              ) : margins.isError ? (
                <ErrorState
                  title="Couldn't load margins"
                  onRetry={() => margins.refetch()}
                />
              ) : rows.length === 0 ? (
                <EmptyState
                  icon={<Inbox />}
                  title="No funds to show"
                  description="Margin and cash appear here once a broker is connected."
                />
              ) : (
                <BrokerFundsTable rows={rows} totals={totals} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
