import { useMemo } from "react";
import { Info, Inbox } from "lucide-react";
import { RefreshBar } from "@/components/RefreshBar";
import { PremiumFigure } from "@/components/PremiumFigure";
import { EmptyState, ErrorState } from "@/components/states";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { PositionsTable } from "@/features/positions/PositionsTable";
import { groupPositions } from "@/features/positions/grouping";
import { positionsSummary } from "@/features/positions/summary";
import { marginByConnection, marginByGroup } from "@/features/positions/margin";
import { BrokerWarnings } from "@/features/session/BrokerWarnings";
import { useBrokerStatus } from "@/features/session/hooks";
import { usePositions } from "@/features/positions/hooks";
import { useRiskSummary } from "@/features/risk/hooks";
import { formatINRWhole, formatNumber, formatSignedINRWhole, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";

const HEADERS = ["Instrument", "Product", "Qty", "Avg price", "LTP", "Premium left", "Margin", "P&L", "Day P&L"];

export function PositionsPage() {
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } = usePositions();
  const status = useBrokerStatus();
  // Advisory estimates and the account bills still come from the same risk
  // report. The live positions remain usable if that separate request fails.
  const risk = useRiskSummary();
  const report = risk.data;
  const groupMargin = useMemo(() => report ? marginByGroup(report.instruments) : undefined, [report]);
  const connectionMargin = useMemo(() => report ? marginByConnection(report.margin.accounts) : undefined, [report]);
  const brokers = useMemo(() => groupPositions(data?.items ?? []), [data]);
  const summary = useMemo(() => positionsSummary(brokers, groupMargin), [brokers, groupMargin]);
  const positions = data?.items ?? [];
  const warnings = data?.warnings ?? [];
  const partial = warnings.length > 0;
  const known = !!data && !isError && !(partial && positions.length === 0);
  const accountLabels = new Map(status.connections.map((connection) => [connection.connectionId, connection.accountLabel]));
  const refresh = <RefreshBar updatedAt={dataUpdatedAt} isFetching={isFetching} onRefresh={() => { void refetch(); }} />;
  const partialMarker = partial && known ? <span className="ml-1 text-sm text-amber-300" title="Partial total: some broker accounts could not be loaded" aria-label="Partial total">*</span> : null;
  const metrics = [
    { label: "Open positions", value: known ? formatNumber(summary.openCount) : "—", className: "" },
    { label: "Positions P&L", value: known ? formatSignedINRWhole(summary.pnl) : "—", className: known ? pnlColor(summary.pnl) : "" },
    { label: "Day P&L", value: known ? formatSignedINRWhole(summary.dayPnl) : "—", className: known ? pnlColor(summary.dayPnl) : "" },
  ];

  return <div className="positions-page">
    <BrokerWarnings warnings={warnings} />
    <section className="positions-summary" aria-label="Positions summary">
      {metrics.map((metric) => <div className="positions-metric" key={metric.label}>
        <div className="text-base text-muted-foreground">{metric.label}</div>
        <div className={cn("positions-metric-value", metric.className)}>{isLoading ? <Skeleton className="h-9 w-28" /> : <>{metric.value}{partialMarker}</>}</div>
      </div>)}
      <div className="positions-metric">
        <div className="text-base text-muted-foreground">Premium left</div>
        <div className="positions-metric-value">{isLoading ? <Skeleton className="h-9 w-32" /> : <><PremiumFigure compact premiumLeft={known ? summary.premium : null} unpricedLegs={summary.unpricedLegs} />{partialMarker}</>}</div>
      </div>
      <div className="positions-metric">
        <div className="text-base text-muted-foreground">Estimated margin</div>
        <div className="positions-metric-value" title="Sum of the available underlying estimates for displayed groups; not the sum of broker account bills.">
          {isLoading || risk.isLoading ? <Skeleton className="h-9 w-32" /> : <>
            {known && summary.estimatedMargin !== null ? formatINRWhole(summary.estimatedMargin) : "—"}
            {known && summary.estimatedMargin !== null && summary.missingMarginLegs > 0 && <span className="ml-1 text-sm text-amber-300" title="Some displayed positions have no margin estimate" aria-label="Incomplete margin estimate">+?</span>}
            {partialMarker}
          </>}
        </div>
      </div>
    </section>

    <section className="positions-panel" aria-label="Position details">
      {isLoading || isError || positions.length === 0 ? <>
        <div className="positions-toolbar"><h1 className="text-2xl font-semibold tracking-tight">Positions</h1>{refresh}</div>
        {isLoading ? <TableSkeleton headers={HEADERS} rows={8} />
          : isError ? <ErrorState title="Couldn't load positions" onRetry={() => { void refetch(); }} />
          : <EmptyState icon={<Inbox />} title={partial ? "Positions unavailable" : "No open positions"} description={partial ? "Some broker accounts could not be loaded. Retry or reconnect using the warning above." : "Your positions will appear here when available."} />}
      </> : <PositionsTable positions={positions} groupMargin={groupMargin} connectionMargin={connectionMargin} accountLabels={accountLabels} refresh={refresh} />}
      <div className="positions-notes">
        <p className="flex items-start gap-2"><Info className="mt-0.5 size-4 shrink-0" /><span>Margin is estimated per underlying; broker account bills can differ.</span></p>
        {report && report.freshness !== "LIVE" && <p>
          Margin estimates use positions held <strong className="font-medium text-foreground">{report.asOf ? new Date(report.asOf).toLocaleString("en-IN") : "at an unknown time"}</strong> · {report.freshness}. The positions above are live; their quantities can differ from the estimate's inputs.
        </p>}
        {risk.isError && <p role="status">Could not refresh margin estimates.{report ? " Previously loaded estimates are shown." : " Position data remains available."}</p>}
        {partial && <p>* Totals cover the accounts that responded. Missing accounts can change them in either direction.</p>}
      </div>
    </section>
  </div>;
}
