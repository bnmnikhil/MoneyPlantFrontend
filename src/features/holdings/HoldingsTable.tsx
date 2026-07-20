import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Holding } from "@/types/api";
import {
  formatINR,
  formatSignedINR,
  formatSignedPct,
  formatNumber,
  pnlColor,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export function HoldingsTable({ holdings }: { holdings: Holding[] }) {
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
            {holdings.map((h) => (
              <TableRow key={h.symbol}>
                <TableCell className="font-medium">{h.symbol}</TableCell>
                <TableCell className="tnum text-right">
                  {formatNumber(h.qty)}
                </TableCell>
                <TableCell className="tnum text-right">
                  {formatINR(h.avgCost)}
                </TableCell>
                <TableCell className="tnum text-right">
                  {formatINR(h.ltp)}
                </TableCell>
                <TableCell className="tnum text-right">
                  {formatINR(h.currentValue)}
                </TableCell>
                <TableCell
                  className={cn("tnum text-right font-medium", pnlColor(h.pnl))}
                >
                  {formatSignedINR(h.pnl)}
                </TableCell>
                <TableCell
                  className={cn("tnum text-right", pnlColor(h.pnlPct))}
                >
                  {formatSignedPct(h.pnlPct)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="divide-y divide-border md:hidden">
        {holdings.map((h) => (
          <div key={h.symbol} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{h.symbol}</p>
                <p className="mt-1 text-xs text-muted-foreground tnum">
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
    </>
  );
}
