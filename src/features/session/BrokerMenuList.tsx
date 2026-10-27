import { Loader2 } from "lucide-react";
import { brokerLabel } from "@/components/BrokerBadge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useBrokerConnectState } from "@/features/session/brokerConnectState";
import { brokerMenuRows, brokerMenuStatusText, type BrokerMenuRow } from "@/features/session/brokerMenuRows";
import { useConnectBroker } from "@/features/session/hooks";
import { cn } from "@/lib/utils";

const dotClass = { connected: "bg-profit", expired: "bg-orange-400", pending: "bg-muted-foreground" } as const;

/** The Brokers dropdown's rows: status for live accounts, Reconnect / Connect for the rest. */
export function BrokerMenuList() {
  const { state, isLoading } = useBrokerConnectState();
  const connect = useConnectBroker();

  if (isLoading) {
    return <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Checking brokers…</p>;
  }

  const rows = brokerMenuRows(state, brokerLabel);
  const pendingFor = (row: BrokerMenuRow) =>
    connect.isPending && connect.variables?.brokerId === row.brokerId && connect.variables?.label === row.label;

  return (
    <div className="flex flex-col gap-0.5 py-1">
      {rows.map((row) => {
        const status = (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className={cn("size-2 shrink-0 rounded-full", dotClass[row.status])} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{row.title}</span>
              <span className={cn("text-xs", row.status === "expired" ? "text-orange-400" : "text-muted-foreground")}>{brokerMenuStatusText[row.status]}</span>
            </span>
          </span>
        );
        if (row.label === null) {
          return <div key={row.key} className="px-2 py-2">{status}</div>;
        }
        const busy = pendingFor(row);
        const label = row.label;
        return (
          <DropdownMenuItem key={row.key} disabled={busy} className="justify-between gap-3 px-2 py-2"
            onSelect={(event) => { event.preventDefault(); connect.mutate({ brokerId: row.brokerId, label }); }}>
            {status}
            <span className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold",
              row.status === "expired" ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-foreground"
            )}>
              {busy && <Loader2 className="size-3 animate-spin" />}
              {row.status === "expired" ? "Reconnect" : "Connect"}
            </span>
          </DropdownMenuItem>
        );
      })}
      {rows.length === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">No brokers configured yet.</p>}
    </div>
  );
}
