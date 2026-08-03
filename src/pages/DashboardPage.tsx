import { Link } from "react-router-dom";
import {
  Wallet,
  TrendingUp,
  Layers,
  PiggyBank,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/states";
import { TableSkeleton } from "@/components/TableSkeleton";
import { PositionsTable } from "@/features/positions/PositionsTable";
import { ConnectBrokerCard } from "@/features/session/ConnectBrokerCard";
import { BrokerWarnings } from "@/features/session/BrokerWarnings";
import { useBrokerStatus } from "@/features/session/hooks";
import { useMargins, usePositions } from "@/features/positions/hooks";
import type { BrokerWarning } from "@/types/api";
import {
  formatINRWhole,
  formatSignedINR,
  formatNumber,
  pnlColor,
} from "@/lib/format";

// Matches PositionsTable's columns. P&L and day change now share one column,
// stacked, so the skeleton must not promise a "Day change" header that the
// loaded table does not have.
const POSITION_HEADERS = ["Symbol", "Product", "Qty", "Avg price", "LTP", "P&L"];

/**
 * Positions and margins hit the same brokers, so one dead connection produces
 * the same warning twice. Show it once.
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
  const margins = useMargins();

  // No broker linked at all → prompt to connect, skip the dashboard body.
  if (status.data && !status.anyConnected) {
    return (
      <div className="py-8">
        <ConnectBrokerCard />
      </div>
    );
  }

  const rows = positions.data?.items ?? [];
  const totalPnl = rows.reduce((sum, p) => sum + (p.pnl ?? 0), 0);
  const openCount = rows.length;

  // Summed across every connected broker; the per-broker rows stay in .items.
  const totals = margins.totals;

  const warnings = mergeWarnings(
    positions.data?.warnings,
    margins.data?.warnings
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Your account at a glance." />

      <BrokerWarnings warnings={warnings} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="P&L today"
          icon={<TrendingUp />}
          loading={positions.isLoading}
          value={formatSignedINR(totalPnl)}
          valueClassName={pnlColor(totalPnl)}
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
        />
        <StatCard
          label="Cash available"
          icon={<Wallet />}
          loading={margins.isLoading}
          value={formatINRWhole(totals.cash)}
        />
        <StatCard
          label="Open positions"
          icon={<Layers />}
          loading={positions.isLoading}
          value={formatNumber(openCount)}
        />
      </div>

      {/* Positions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Open positions</CardTitle>
          {openCount > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/positions">
                View all
                <ArrowRight />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {positions.isLoading ? (
            <TableSkeleton headers={POSITION_HEADERS} rows={5} />
          ) : positions.isError ? (
            <ErrorState
              title="Couldn't load positions"
              onRetry={() => positions.refetch()}
            />
          ) : openCount === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title="No open positions"
              description="When you have live positions they'll show up here in real time."
            />
          ) : (
            <PositionsTable positions={rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
