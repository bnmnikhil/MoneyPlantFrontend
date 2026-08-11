import { ShieldAlert, TrendingUp, Calendar, Percent } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RefreshBar } from "@/components/RefreshBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton } from "@/components/TableSkeleton";
import { ErrorState, EmptyState } from "@/components/states";
import { useRiskSummary } from "@/features/risk/hooks";

export function RiskPage() {
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } =
    useRiskSummary();

  const exposure = data?.exposure;
  const expiryBuckets = data?.expiryBuckets ?? [];
  const freshness = data?.freshness ?? "NONE";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk & Portfolio Analytics"
        description="Deterministic risk analysis, exposure concentration, and contract expiry bucketing."
        actions={
          <RefreshBar
            updatedAt={dataUpdatedAt}
            isFetching={isFetching}
            onRefresh={() => refetch()}
          />
        }
      />

      {data?.asOf && (
        <div className="text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded border flex items-center justify-between">
          <span>
            Risk data calculated as of:{" "}
            <strong className="text-foreground">{new Date(data.asOf).toLocaleString()}</strong>
          </span>
          <span className="font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
            {freshness}
          </span>
        </div>
      )}

      {isLoading ? (
        <TableSkeleton headers={["Metric", "Value"]} rows={4} />
      ) : isError ? (
        <ErrorState
          title="Couldn't load risk analysis"
          onRetry={() => refetch()}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Exposure Summary Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Portfolio Exposure</CardTitle>
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <div className="text-2xl font-bold">
                  ₹{exposure?.netExposure.toLocaleString("en-IN") ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">Net Portfolio Exposure</p>
              </div>
              <div className="border-t pt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Gross Exposure:</span>
                <span className="font-semibold">
                  ₹{exposure?.grossExposure.toLocaleString("en-IN") ?? 0}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Concentration Breakdown Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Underlying Concentration</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {exposure && Object.keys(exposure.concentrationByUnderlying).length > 0 ? (
                Object.entries(exposure.concentrationByUnderlying).map(([symbol, pct]) => (
                  <div key={symbol} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{symbol}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No open positions to analyze concentration.</p>
              )}
            </CardContent>
          </Card>

          {/* Expiry Time Bucketing Table */}
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiry & Time Bucketing</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-4">
              {expiryBuckets.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp />}
                  title="No contract expiry buckets"
                  description="Open F&O positions will automatically group here by expiry date."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 px-3">Expiry Timeline</th>
                        <th className="py-2 px-3">Positions</th>
                        <th className="py-2 px-3 text-right">Net Exposure (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiryBuckets.map((bucket, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="py-2.5 px-3 font-medium">{bucket.label}</td>
                          <td className="py-2.5 px-3">{bucket.positionCount}</td>
                          <td className="py-2.5 px-3 text-right font-semibold">
                            ₹{bucket.netExposure.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
