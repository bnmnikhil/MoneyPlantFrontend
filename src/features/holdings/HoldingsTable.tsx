import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brokerLabel } from "@/components/BrokerBadge";
import type { Holding } from "@/types/api";
import { groupHoldings } from "./grouping";
import {
  formatINR,
  formatSignedINR,
  formatSignedPct,
  formatNumber,
  pnlColor,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/** The same stock can be held at two brokers, so key on the connection too. */
function rowKey(h: Holding) {
  return `${h.connectionId}-${h.symbol}`;
}

const COLUMNS = 7;

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  const groups = groupHoldings(holdings);

  // With one broker a group header would be a heading over the whole table.
  // Same rule as positions and the payoff selector.
  const showBrokerLevel = groups.length > 1;

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Avg cost</TableHead>
              <TableHead className="text-right">LTP</TableHead>
              <TableHead className="text-right">Current value</TableHead>
              <TableHead className="text-right">P&amp;L</TableHead>
              <TableHead className="text-right">P&amp;L %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => {
              const isCollapsed = collapsed.has(g.key);
              return (
                <Fragment key={g.key}>
                  {showBrokerLevel && (
                    <TableRow className="border-t-2 bg-muted/30 hover:bg-muted/40">
                      <TableCell colSpan={COLUMNS - 3} className="py-2">
                        <button
                          type="button"
                          onClick={() => toggle(g.key)}
                          aria-expanded={!isCollapsed}
                          className="flex items-center gap-1.5 text-sm font-semibold"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {brokerLabel(g.brokerId)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            {g.holdings.length} holding{g.holdings.length === 1 ? "" : "s"}
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="tnum py-2 text-right font-medium">
                        {formatINR(g.currentValue)}
                      </TableCell>
                      <TableCell
                        className={cn("tnum py-2 text-right font-medium", pnlColor(g.pnl))}
                      >
                        {formatSignedINR(g.pnl)}
                      </TableCell>
                      <TableCell className={cn("tnum py-2 text-right", pnlColor(g.pnlPct))}>
                        {formatSignedPct(g.pnlPct)}
                      </TableCell>
                    </TableRow>
                  )}

                  {!isCollapsed &&
                    g.holdings.map((h) => (
                      <TableRow key={rowKey(h)}>
                        <TableCell className={cn("font-medium", showBrokerLevel && "pl-9")}>
                          {h.symbol}
                        </TableCell>
                        <TableCell className="tnum text-right">{formatNumber(h.qty)}</TableCell>
                        <TableCell className="tnum text-right">{formatINR(h.avgCost)}</TableCell>
                        <TableCell className="tnum text-right">{formatINR(h.ltp)}</TableCell>
                        <TableCell className="tnum text-right">
                          {formatINR(h.currentValue)}
                        </TableCell>
                        <TableCell
                          className={cn("tnum text-right font-medium", pnlColor(h.pnl))}
                        >
                          {formatSignedINR(h.pnl)}
                        </TableCell>
                        <TableCell className={cn("tnum text-right", pnlColor(h.pnlPct))}>
                          {formatSignedPct(h.pnlPct)}
                        </TableCell>
                      </TableRow>
                    ))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden">
        {groups.map((g) => {
          const isCollapsed = collapsed.has(g.key);
          return (
            <div key={g.key}>
              {showBrokerLevel && (
                <button
                  type="button"
                  onClick={() => toggle(g.key)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between border-t bg-muted/30 px-4 py-2 text-left"
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {brokerLabel(g.brokerId)}
                  </span>
                  <span className="flex flex-col items-end leading-tight">
                    <span className="tnum text-sm">{formatINR(g.currentValue)}</span>
                    <span className={cn("tnum text-xs", pnlColor(g.pnl))}>
                      {formatSignedINR(g.pnl)}
                    </span>
                  </span>
                </button>
              )}

              {!isCollapsed &&
                g.holdings.map((h) => (
                  <div key={rowKey(h)} className="border-t p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{h.symbol}</p>
                        <p className="tnum mt-1 text-xs text-muted-foreground">
                          Qty {formatNumber(h.qty)} · {formatINR(h.currentValue)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn("tnum font-semibold", pnlColor(h.pnl))}>
                          {formatSignedINR(h.pnl)}
                        </p>
                        <p className={cn("tnum text-xs", pnlColor(h.pnlPct))}>
                          {formatSignedPct(h.pnlPct)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Avg cost</span>
                      <span className="tnum text-right">{formatINR(h.avgCost)}</span>
                      <span className="text-muted-foreground">LTP</span>
                      <span className="tnum text-right">{formatINR(h.ltp)}</span>
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
