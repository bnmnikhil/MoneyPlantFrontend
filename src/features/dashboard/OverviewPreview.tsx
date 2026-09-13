import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Holding, Position } from "@/types/api";
import { brokerLabel } from "@/components/BrokerBadge";
import { EmptyState, ErrorState } from "@/components/states";
import { TableSkeleton } from "@/components/TableSkeleton";
import { formatINR, formatINRWhole, formatNumber } from "@/lib/format";
import { accountLabel } from "./aggregate";
import { OverviewBroker, OverviewMoney } from "./OverviewFigures";
import { previewGroups } from "./overview";

type Props = {
  loading: boolean;
  failed: boolean;
  retry: () => void;
  accountLabels: Map<string, string>;
} & ({ kind: "positions"; items: Position[] } | { kind: "holdings"; items: Holding[] });

export function OverviewPreview(props: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isPositions = props.kind === "positions";
  const title = isPositions ? "Open positions" : "Holdings";
  const groups = previewGroups<Position | Holding>(props.items);
  const headers = isPositions ? ["Symbol", "Account", "Qty", "LTP", "P&L", "Day P&L"] : ["Symbol", "Account", "Qty", "Current value", "P&L"];

  return <section className="overview-panel overview-preview" aria-label={title}>
    <h2 className="overview-panel-title"><Link className="rounded outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring" to={`/app/${props.kind}`}>{title}</Link></h2>
    {props.loading ? <TableSkeleton headers={headers} rows={6} />
      : props.failed ? <ErrorState title={`Couldn't load ${props.kind}`} onRetry={props.retry} />
      : groups.length === 0 ? <EmptyState title={`No ${isPositions ? "open positions" : "holdings"}`} description={`Your ${props.kind} will appear here when available.`} />
      : <div className="overview-preview-scroll" tabIndex={0} role="region" aria-label={`${title} table, scroll for more rows`}>
        <table className="overview-table overview-preview-table">
          <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{groups.map((group, groupIndex) => {
            const open = expanded[group.connectionId] ?? groupIndex === 0;
            const sameBrokerAccounts = groups.filter((item) => item.brokerId === group.brokerId).length;
            const label = props.accountLabels.get(group.connectionId) ?? accountLabel(group.connectionId);
            const totalValue = group.items.reduce((sum, item) => sum + ("dayChange" in item ? item.dayChange : item.currentValue), 0);
            return <Fragment key={group.connectionId}>
              <tr className="overview-account-row">
                <td colSpan={isPositions ? 4 : 3}>
                  <button type="button" aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${brokerLabel(group.brokerId)} ${label} ${props.kind}`}
                    onClick={() => setExpanded((previous) => ({ ...previous, [group.connectionId]: !open }))}
                    className="flex w-full items-center gap-3 rounded py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                    <OverviewBroker brokerId={group.brokerId} account={sameBrokerAccounts > 1 ? label : undefined} />
                    <span className="whitespace-nowrap text-xs text-muted-foreground">· {group.items.length} {props.kind}</span>
                  </button>
                </td>
                {isPositions ? <><td><OverviewMoney value={group.pnl} /></td><td><OverviewMoney value={totalValue} /></td></>
                  : <><td className="font-semibold">{formatINRWhole(totalValue)}</td><td><OverviewMoney value={group.pnl} /></td></>}
              </tr>
              {open && group.items.map((item, index) => <tr key={`${item.symbol}:${"product" in item ? item.product : "holding"}:${index}`}>
                <td><span className="overview-tree-symbol">{item.symbol}</span></td>
                <td className="text-muted-foreground">{sameBrokerAccounts > 1 ? label : brokerLabel(item.broker)}</td>
                <td>{formatNumber(item.qty)}</td>
                {"dayChange" in item ? <>
                  <td>{item.priceKnown ? formatINR(item.ltp) : <span title="Quote unavailable">—</span>}</td>
                  <td><OverviewMoney value={item.pnl} /></td><td><OverviewMoney value={item.dayChange} /></td>
                </> : <><td>{formatINRWhole(item.currentValue)}</td><td><OverviewMoney value={item.pnl} /></td></>}
              </tr>)}
            </Fragment>;
          })}</tbody>
        </table>
      </div>}
  </section>;
}
