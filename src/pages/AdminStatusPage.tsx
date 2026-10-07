import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import type { AdminStatus } from "@/types/api";

/**
 * The owner's status page: CPU, RAM, storage, user counts and the error log.
 *
 * Not in the navigation. The backend answers 404 to anyone who is not the owner, so for everyone
 * else this page reads "not available" and reveals nothing. Aggregates only: no user is named.
 */
export function AdminStatusPage() {
  const q = useQuery({
    queryKey: ["admin", "status"],
    queryFn: api.adminStatus,
    refetchInterval: 15_000,
    retry: false,
  });

  if (q.isLoading) return <Skeleton className="h-96 w-full" />;
  if (q.error instanceof ApiError && q.error.status === 404) {
    return <ErrorState title="Not available" description="This page is not available for your account." />;
  }
  if (q.error || !q.data) return <ErrorState onRetry={() => q.refetch()} />;

  const s = q.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Status"
        description={`${s.app.environment} - up ${formatUptime(s.app.uptimeSeconds)} - refreshes every 15 seconds`}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Cpu s={s} />
        <Ram s={s} />
        <Storage s={s} />
        <Users s={s} />
      </div>
      <Errors s={s} />
    </div>
  );
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">{children}</CardContent>
    </Card>
  );
}

function Big({ value, tone }: { value: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-loss" : tone === "warn" ? "text-amber-500" : "text-foreground";
  return <div className={`text-3xl font-semibold tabular-nums ${color}`}>{value}</div>;
}

const pct = (v: number | null | undefined) => (v == null ? "-" : `${v.toFixed(0)}%`);
const gb = (mb: number | null | undefined) => (mb == null ? "-" : `${(mb / 1024).toFixed(1)} GB`);

function Cpu({ s }: { s: AdminStatus }) {
  const c = s.host.cpu;
  const per = c.load15PerCore;
  const tone = per == null ? undefined : per >= 2.5 ? "bad" : per >= 1.2 ? "warn" : "ok";
  return (
    <Tile title="CPU">
      <Big value={pct(c.loadPercent)} tone={tone} />
      <p className="text-xs text-muted-foreground">
        Load 1/5/15 min: {[c.load1, c.load5, c.load15].map((v) => (v == null ? "-" : v.toFixed(2))).join(" / ")} on {c.cores} core(s)
      </p>
    </Tile>
  );
}

function Ram({ s }: { s: AdminStatus }) {
  const m = s.host.memory;
  const used = m.usedPercent;
  const tone = used == null ? undefined : used >= 92 ? "bad" : used >= 85 ? "warn" : "ok";
  return (
    <Tile title="RAM">
      <Big value={pct(used)} tone={tone} />
      <p className="text-xs text-muted-foreground">
        {gb(m.totalMb == null || m.availableMb == null ? null : m.totalMb - m.availableMb)} used of {gb(m.totalMb)}; {gb(m.availableMb)} available
      </p>
      <p className="text-xs text-muted-foreground">Swap {gb(m.swapUsedMb)} of {gb(m.swapTotalMb)}</p>
    </Tile>
  );
}

function Storage({ s }: { s: AdminStatus }) {
  return (
    <Tile title="Storage (free)">
      {s.host.disks.map((d) => {
        const tone = d.freePercent == null ? undefined : d.freePercent <= 10 ? "bad" : d.freePercent <= 20 ? "warn" : "ok";
        return (
          <div key={d.path}>
            <Big value={pct(d.freePercent)} tone={tone} />
            <p className="text-xs text-muted-foreground">
              {gb(d.freeMb)} free of {gb(d.totalMb)} on {d.path}
            </p>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Database {s.database.up ? `${gb(s.database.sizeMb)}` : "is DOWN"}
      </p>
    </Tile>
  );
}

function Users({ s }: { s: AdminStatus }) {
  const u = s.users;
  return (
    <Tile title="Users">
      <Big value={u ? String(u.total) : "-"} />
      {u && (
        <p className="text-xs text-muted-foreground">
          {u.active24h} active in 24h; {u.new24h} new in 24h; {u.new7d} new in 7 days
          {u.disabled > 0 ? `; ${u.disabled} disabled` : ""}
        </p>
      )}
    </Tile>
  );
}

function Errors({ s }: { s: AdminStatus }) {
  const e = s.errors;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Error log - {e.lastHour} in the last hour, {e.last24h} in 24 hours
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          The latest {e.recent.length} ERROR lines since the app started. Cleared by a restart.
        </p>
      </CardHeader>
      <CardContent>
        {e.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No errors since the app started.</p>
        ) : (
          <ul className="divide-y">
            {e.recent.map((x, i) => (
              <li key={i} className="space-y-0.5 py-2 text-sm">
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <time>{new Date(x.at).toLocaleString()}</time>
                  {x.logger && <span>{x.logger}</span>}
                  {x.exception && <span>{x.exception}</span>}
                </div>
                <div className="break-words">{x.message}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}
