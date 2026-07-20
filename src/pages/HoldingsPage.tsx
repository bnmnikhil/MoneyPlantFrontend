import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RefreshBar } from "@/components/RefreshBar";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/states";
import { TableSkeleton } from "@/components/TableSkeleton";
import { HoldingsTable } from "@/features/holdings/HoldingsTable";
import { useHoldings } from "@/features/holdings/hooks";

const HEADERS = [
  "Symbol",
  "Qty",
  "Avg cost",
  "LTP",
  "Current value",
  "P&L",
  "P&L %",
];

export function HoldingsPage() {
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } =
    useHoldings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holdings"
        description="Your long-term equity holdings."
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
              title="Couldn't load holdings"
              onRetry={() => refetch()}
            />
          ) : !data || data.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title="No holdings"
              description="Stocks you hold for delivery will be listed here."
            />
          ) : (
            <HoldingsTable holdings={data} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
