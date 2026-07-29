import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BrokerBadge, brokerLabel, hasMultipleSources } from "@/components/BrokerBadge";
import type { Position } from "@/types/api";
import { formatINR, formatSignedINR, formatNumber, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";

function signedPoints(v: number) {
  if (!Number.isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
}

/** Two brokers can hold the same symbol, so the connection must be part of the key. */
function rowKey(p: Position) {
  return `${p.connectionId}-${p.symbol}-${p.product}`;
}

export function PositionsTable({ positions }: { positions: Position[] }) {
  const showBroker = hasMultipleSources(positions);

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Symbol</TableHead>
              {showBroker && <TableHead>Broker</TableHead>}
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Avg price</TableHead>
              <TableHead className="text-right">LTP</TableHead>
              <TableHead className="text-right">P&amp;L</TableHead>
              <TableHead className="text-right">Day change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((p) => (
              <TableRow key={rowKey(p)}>
                <TableCell className="font-medium">{p.symbol}</TableCell>
                {showBroker && (
                  <TableCell>
                    <BrokerBadge brokerId={p.broker} />
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {p.product}
                  </Badge>
                </TableCell>
                <TableCell className="tnum text-right">
                  {formatNumber(p.qty)}
                </TableCell>
                <TableCell className="tnum text-right">
                  {formatINR(p.avgPrice)}
                </TableCell>
                <TableCell className="tnum text-right">
                  {formatINR(p.ltp)}
                </TableCell>
                <TableCell
                  className={cn("tnum text-right font-medium", pnlColor(p.pnl))}
                >
                  {formatSignedINR(p.pnl)}
                </TableCell>
                <TableCell
                  className={cn("tnum text-right", pnlColor(p.dayChange))}
                >
                  {signedPoints(p.dayChange)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="divide-y divide-border md:hidden">
        {positions.map((p) => (
          <div key={rowKey(p)} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.symbol}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="font-normal">
                    {p.product}
                  </Badge>
                  <span className="tnum">Qty {formatNumber(p.qty)}</span>
                  {showBroker && <span>· {brokerLabel(p.broker)}</span>}
                </div>
              </div>
              <div className="text-right">
                <p className={cn("tnum font-semibold", pnlColor(p.pnl))}>
                  {formatSignedINR(p.pnl)}
                </p>
                <p className={cn("tnum text-xs", pnlColor(p.dayChange))}>
                  {signedPoints(p.dayChange)} today
                </p>
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
    </>
  );
}
