import { useMemo } from "react";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RefreshBar } from "@/components/RefreshBar";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/states";
import { TableSkeleton } from "@/components/TableSkeleton";
import { PositionsTable } from "@/features/positions/PositionsTable";
import { marginByConnection, marginByGroup } from "@/features/positions/margin";
import { BrokerWarnings } from "@/features/session/BrokerWarnings";
import { usePositions } from "@/features/positions/hooks";
import { useRiskSummary } from "@/features/risk/hooks";

// Matches PositionsTable: P&L and day change are stacked in one column.
const HEADERS = [
  "Symbol",
  "Product",
  "Qty",
  "Avg price",
  "LTP",
  "Premium left",
  "Margin",
  "P&L",
];

export function PositionsPage() {
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } =
    usePositions();

  /*
   * Margin comes entirely from the risk report, and deliberately not from
   * `/api/margins`.
   *
   * The per-contract figures are shares of the *snapshot's* `used`, so pairing
   * them with a live account total would give a broker row that does not equal
   * its own children — destroying the one property that justifies allocating at
   * all. One source keeps the column footing.
   *
   * The query is advisory: if it is loading or fails, the margin cells show a
   * dash and everything else on the page behaves exactly as before. Positions
   * must never fail because risk did.
   */
  const risk = useRiskSummary();
  const report = risk.data;

  const groupMargin = useMemo(
    () => (report ? marginByGroup(report.instruments) : undefined),
    [report]
  );
  const connectionMargin = useMemo(
    () => (report ? marginByConnection(report.margin.accounts) : undefined),
    [report]
  );

  const positions = data?.items ?? [];
  const warnings = data?.warnings ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Positions"
        description="Live intraday & F&O positions across all connected brokers. Auto-refreshes every 30 seconds."
        actions={
          <RefreshBar
            updatedAt={dataUpdatedAt}
            isFetching={isFetching}
            onRefresh={() => refetch()}
          />
        }
      />

      {/* Some brokers failed but the rows below are still real data. */}
      <BrokerWarnings warnings={warnings} />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton headers={HEADERS} rows={8} />
          ) : isError ? (
            <ErrorState
              title="Couldn't load positions"
              onRetry={() => refetch()}
            />
          ) : positions.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title="No open positions"
              description="You have no live positions right now. New positions appear here automatically."
            />
          ) : (
            <PositionsTable
              positions={positions}
              groupMargin={groupMargin}
              connectionMargin={connectionMargin}
            />
          )}
        </CardContent>
      </Card>

      {/*
        The margin column has THREE different ages in it and they must all be
        stated, because the reassuring one is not the one that matters.
        Measured 15 Aug 2026: the bill was hours old while the positions it was
        divided across were four days old, so a caption naming only the bill
        would have read as fresh while the split was stale. The split is the
        weaker link, so it is named first.

        One caption, in one place. Per-row badges would be noise.
      */}
      {report && (report.freshness !== "LIVE" || report.margin.freshness !== "LIVE") && (
        <p className="px-1 text-xs text-muted-foreground">
          Margin is allocated from each account's real bill
          {report.margin.asOf && (
            <> (as of {new Date(report.margin.asOf).toLocaleString()})</>
          )}
          , split across the positions held{" "}
          <strong className="font-medium text-foreground">
            {report.asOf ? new Date(report.asOf).toLocaleString() : "at an unknown time"}
          </strong>{" "}
          · {report.freshness}. The rows above are live, so the two can disagree
          — and the &ldquo;% of margin&rdquo; hint divides a live premium by that
          allocated bill.
        </p>
      )}
    </div>
  );
}
