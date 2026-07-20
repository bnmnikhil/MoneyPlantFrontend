import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RefreshBar } from "@/components/RefreshBar";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/states";
import { TableSkeleton } from "@/components/TableSkeleton";
import { PositionsTable } from "@/features/positions/PositionsTable";
import { usePositions } from "@/features/positions/hooks";

const HEADERS = [
  "Symbol",
  "Product",
  "Qty",
  "Avg price",
  "LTP",
  "P&L",
  "Day change",
];

export function PositionsPage() {
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } =
    usePositions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Positions"
        description="Live intraday & F&O positions. Auto-refreshes every 30 seconds."
        actions={
          <RefreshBar
            updatedAt={dataUpdatedAt}
            isFetching={isFetching}
            onRefresh={() => refetch()}
          />
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton headers={HEADERS} rows={8} />
          ) : isError ? (
            <ErrorState
              title="Couldn't load positions"
              onRetry={() => refetch()}
            />
          ) : !data || data.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title="No open positions"
              description="You have no live positions right now. New positions appear here automatically."
            />
          ) : (
            <PositionsTable positions={data} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
