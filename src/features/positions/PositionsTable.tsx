import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brokerLabel } from "@/components/BrokerBadge";
import type { Position } from "@/types/api";
import { groupPositions, type BrokerGroup, type UnderlyingGroup } from "./grouping";
import { formatINR, formatSignedINR, formatNumber, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Two brokers can hold the same symbol, so the connection must be part of the key. */
function rowKey(p: Position) {
  return `${p.connectionId}-${p.symbol}-${p.product}`;
}

const COLUMNS = 6;

/** P&L and day change, side by side. Used in both group headers and totals. */
function Money({ pnl, dayChange }: { pnl: number; dayChange: number }) {
  return (
    <>
      <span className={cn("tnum font-medium", pnlColor(pnl))}>{formatSignedINR(pnl)}</span>
      <span className={cn("tnum text-xs", pnlColor(dayChange))}>
        {formatSignedINR(dayChange)} today
      </span>
    </>
  );
}

function UnderlyingRows({
  group,
  collapsed,
  onToggle,
}: {
  group: UnderlyingGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow className="border-t bg-muted/30 hover:bg-muted/40">
        <TableCell colSpan={COLUMNS - 1} className="py-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1.5 text-sm font-medium"
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {group.label}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {group.positions.length} leg{group.positions.length === 1 ? "" : "s"}
            </span>
          </button>
        </TableCell>
        <TableCell className="py-2 text-right">
          <div className="flex flex-col items-end leading-tight">
            <Money pnl={group.pnl} dayChange={group.dayChange} />
          </div>
        </TableCell>
      </TableRow>

      {!collapsed &&
        group.positions.map((p) => (
          <TableRow key={rowKey(p)}>
            <TableCell className="pl-9 font-medium">{p.symbol}</TableCell>
            <TableCell>
              <Badge variant="outline" className="font-normal">
                {p.product}
              </Badge>
            </TableCell>
            <TableCell className="tnum text-right">{formatNumber(p.qty)}</TableCell>
            <TableCell className="tnum text-right">{formatINR(p.avgPrice)}</TableCell>
            <TableCell className="tnum text-right">{formatINR(p.ltp)}</TableCell>
            <TableCell className="text-right">
              <div className="flex flex-col items-end leading-tight">
                <Money pnl={p.pnl} dayChange={p.dayChange} />
              </div>
            </TableCell>
          </TableRow>
        ))}
    </>
  );
}

export function PositionsTable({ positions }: { positions: Position[] }) {
  const brokers = groupPositions(positions);

  // A single broker needs no broker header — it would be a heading over the
  // entire table. Same rule the payoff selector uses.
  const showBrokerLevel = brokers.length > 1;

  // In-memory only, so it resets on reload. Persisting it would need a
  // preference store, which is not worth it for a fold.
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
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Avg price</TableHead>
              <TableHead className="text-right">LTP</TableHead>
              <TableHead className="text-right">P&amp;L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brokers.map((b: BrokerGroup) => (
              <Fragment key={b.key}>
                {showBrokerLevel && (
                  <TableRow className="border-t-2 hover:bg-transparent">
                    <TableCell colSpan={COLUMNS - 1} className="py-2.5">
                      <span className="text-sm font-semibold">{brokerLabel(b.brokerId)}</span>
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <div className="flex flex-col items-end leading-tight">
                        <Money pnl={b.pnl} dayChange={b.dayChange} />
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {b.groups.map((g) => (
                  <UnderlyingRows
                    key={g.key}
                    group={g}
                    collapsed={collapsed.has(g.key)}
                    onToggle={() => toggle(g.key)}
                  />
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list — same grouping, no table semantics */}
      <div className="md:hidden">
        {brokers.map((b) => (
          <div key={b.key}>
            {showBrokerLevel && (
              <div className="flex items-baseline justify-between border-t bg-muted/40 px-4 py-2">
                <span className="text-sm font-semibold">{brokerLabel(b.brokerId)}</span>
                <span className={cn("tnum text-sm font-medium", pnlColor(b.pnl))}>
                  {formatSignedINR(b.pnl)}
                </span>
              </div>
            )}

            {b.groups.map((g) => {
              const isCollapsed = collapsed.has(g.key);
              return (
                <div key={g.key}>
                  <button
                    type="button"
                    onClick={() => toggle(g.key)}
                    aria-expanded={!isCollapsed}
                    className="flex w-full items-center justify-between border-t bg-muted/20 px-4 py-2 text-left"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {g.label}
                    </span>
                    <span className="flex flex-col items-end leading-tight">
                      <Money pnl={g.pnl} dayChange={g.dayChange} />
                    </span>
                  </button>

                  {!isCollapsed &&
                    g.positions.map((p) => (
                      <div key={rowKey(p)} className="border-t p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.symbol}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="font-normal">
                                {p.product}
                              </Badge>
                              <span className="tnum">Qty {formatNumber(p.qty)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end text-right leading-tight">
                            <Money pnl={p.pnl} dayChange={p.dayChange} />
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <span className="text-muted-foreground">Avg price</span>
                          <span className="tnum text-right">{formatINR(p.avgPrice)}</span>
                          <span className="text-muted-foreground">LTP</span>
                          <span className="tnum text-right">{formatINR(p.ltp)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
