import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brokerLabel } from "@/components/BrokerBadge";
import { formatSignedINR, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  accountLabel,
  needsAccountLabel,
  type BrokerRow,
  type DashboardTotals,
} from "./aggregate";

/** Signed money in the right colour, right-aligned. Em dash when there is nothing to show. */
function Money({ value, show = true }: { value: number; show?: boolean }) {
  if (!show) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("tnum", pnlColor(value))}>{formatSignedINR(value)}</span>
  );
}

function BrokerName({ row, withAccount }: { row: BrokerRow; withAccount: boolean }) {
  return (
    <>
      <span className="font-medium">{brokerLabel(row.brokerId)}</span>
      {withAccount && (
        <span className="ml-2 text-xs text-muted-foreground">
          {accountLabel(row.connectionId)}
        </span>
      )}
    </>
  );
}

/**
 * P&L per broker connection.
 *
 * Positions and holdings stay in separate columns rather than being merged.
 * They are different horizons — an F&O book turns over weekly while delivered
 * equity is held for months — so one summed figure would let a long-running
 * equity gain hide a bad day in the options book.
 */
export function BrokerPnlTable({
  rows,
  totals,
}: {
  rows: BrokerRow[];
  totals: DashboardTotals;
}) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Broker</TableHead>
              <TableHead className="text-right">Positions</TableHead>
              <TableHead className="text-right">Holdings</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Day</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell>
                  <BrokerName row={r} withAccount={needsAccountLabel(rows, r.brokerId)} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={r.positionsPnl} show={r.positionCount > 0} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={r.holdingsPnl} show={r.holdingCount > 0} />
                </TableCell>
                <TableCell className="text-right font-medium">
                  <Money value={r.totalPnl} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={r.dayPnl} show={r.positionCount > 0} />
                </TableCell>
              </TableRow>
            ))}

            <TableRow className="border-t-2 hover:bg-transparent">
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-right">
                <Money value={totals.positionsPnl} />
              </TableCell>
              <TableCell className="text-right">
                <Money value={totals.holdingsPnl} />
              </TableCell>
              <TableCell className="text-right font-semibold">
                <Money value={totals.totalPnl} />
              </TableCell>
              <TableCell className="text-right">
                <Money value={totals.dayPnl} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {rows.map((r) => (
          <div key={r.key} className="border-t p-4">
            <div className="flex items-baseline justify-between">
              <BrokerName row={r} withAccount={needsAccountLabel(rows, r.brokerId)} />
              <Money value={r.totalPnl} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Positions</span>
              <span className="text-right">
                <Money value={r.positionsPnl} show={r.positionCount > 0} />
              </span>
              <span className="text-muted-foreground">Holdings</span>
              <span className="text-right">
                <Money value={r.holdingsPnl} show={r.holdingCount > 0} />
              </span>
              <span className="text-muted-foreground">Day</span>
              <span className="text-right">
                <Money value={r.dayPnl} show={r.positionCount > 0} />
              </span>
            </div>
          </div>
        ))}

        <div className="flex items-baseline justify-between border-t-2 bg-muted/30 p-4">
          <span className="font-semibold">Total</span>
          <Money value={totals.totalPnl} />
        </div>
      </div>
    </>
  );
}
