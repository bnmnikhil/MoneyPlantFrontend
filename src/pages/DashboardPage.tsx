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
import { ConnectKiteCard } from "@/features/session/ConnectKiteCard";
import { useKiteStatus } from "@/features/session/hooks";
import { useMargins, usePositions } from "@/features/positions/hooks";
import {
  formatINRWhole,
  formatSignedINR,
  formatNumber,
  pnlColor,
} from "@/lib/format";

const POSITION_HEADERS = [
  "Symbol",
  "Product",
  "Qty",
  "Avg price",
  "LTP",
  "P&L",
  "Day change",
];

export function DashboardPage() {
  const status = useKiteStatus();
  const positions = usePositions();
  const margins = useMargins();

  // Broker not linked yet → prompt to connect (skip the whole dashboard body).
  if (status.data && !status.kiteConnected) {
    return (
      <div className="py-8">
        <ConnectKiteCard />
      </div>
    );
  }

  const totalPnl =
    positions.data?.reduce((sum, p) => sum + (p.pnl ?? 0), 0) ?? 0;
  const openCount = positions.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your account at a glance."
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          value={formatINRWhole(margins.data?.available ?? 0)}
        />
        <StatCard
          label="Margin used"
          icon={<PiggyBank />}
          loading={margins.isLoading}
          value={formatINRWhole(margins.data?.used ?? 0)}
        />
         <StatCard
          label="cash available"
          icon={<Wallet />}
          loading={margins.isLoading}
          value={formatINRWhole(margins.data?.cash ?? 0)}
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
            <PositionsTable positions={positions.data!} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
