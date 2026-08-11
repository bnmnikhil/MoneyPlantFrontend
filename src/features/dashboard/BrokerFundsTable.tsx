import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brokerLabel } from "@/components/BrokerBadge";
import { formatINRWhole } from "@/lib/format";
import {
  accountLabel,
  needsAccountLabel,
  type BrokerRow,
  type DashboardTotals,
} from "./aggregate";

/**
 * Alice Blue's `cash` is `openingCashLimit` — a start-of-day figure. Kite's is
 * `available.liveBalance` and Paytm's is `available_cash`, both live and both
 * legitimately negative when a book is funded against collateral.
 *
 * Three different quantities, so they are shown per broker and never summed:
 * a total would silently mix a morning balance with two current ones.
 */
const OPENING_CASH_BROKERS = new Set(["aliceblue"]);

const Dash = () => <span className="text-muted-foreground">—</span>;

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

export function BrokerFundsTable({
  rows,
  totals,
}: {
  rows: BrokerRow[];
  totals: DashboardTotals;
}) {
  const showOpeningCashNote = rows.some(
    (r) => r.margin && OPENING_CASH_BROKERS.has(r.brokerId)
  );

  const cash = (r: BrokerRow) =>
    r.margin === null ? (
      <Dash />
    ) : (
      <span className="tnum">
        {formatINRWhole(r.margin.cash)}
        {OPENING_CASH_BROKERS.has(r.brokerId) && (
          <span className="text-muted-foreground">*</span>
        )}
      </span>
    );

  const money = (r: BrokerRow, pick: (m: NonNullable<BrokerRow["margin"]>) => number) =>
    r.margin === null ? <Dash /> : <span className="tnum">{formatINRWhole(pick(r.margin))}</span>;

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Broker</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Used</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Cash</TableHead>
              <TableHead className="text-right">Collateral</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell>
                  <BrokerName row={r} withAccount={needsAccountLabel(rows, r.brokerId)} />
                </TableCell>
                <TableCell className="text-right">{money(r, (m) => m.available)}</TableCell>
                <TableCell className="text-right">{money(r, (m) => m.used)}</TableCell>
                <TableCell className="text-right">{money(r, (m) => m.total)}</TableCell>
                <TableCell className="text-right">{cash(r)}</TableCell>
                <TableCell className="text-right">{money(r, (m) => m.collateral)}</TableCell>
              </TableRow>
            ))}

            <TableRow className="border-t-2 hover:bg-transparent">
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="tnum text-right font-semibold">
                {formatINRWhole(totals.available)}
              </TableCell>
              <TableCell className="tnum text-right font-semibold">
                {formatINRWhole(totals.used)}
              </TableCell>
              <TableCell className="tnum text-right font-semibold">
                {formatINRWhole(totals.total)}
              </TableCell>
              {/* Deliberately not summed — see OPENING_CASH_BROKERS above. */}
              <TableCell className="text-right">
                <Dash />
              </TableCell>
              <TableCell className="tnum text-right font-semibold">
                {formatINRWhole(totals.collateral)}
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
              <span className="tnum text-sm font-medium">
                {r.margin === null ? <Dash /> : formatINRWhole(r.margin.available)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Used</span>
              <span className="text-right">{money(r, (m) => m.used)}</span>
              <span className="text-muted-foreground">Total</span>
              <span className="text-right">{money(r, (m) => m.total)}</span>
              <span className="text-muted-foreground">Cash</span>
              <span className="text-right">{cash(r)}</span>
              <span className="text-muted-foreground">Collateral</span>
              <span className="text-right">{money(r, (m) => m.collateral)}</span>
            </div>
          </div>
        ))}

        <div className="flex items-baseline justify-between border-t-2 bg-muted/30 p-4">
          <span className="font-semibold">Total available</span>
          <span className="tnum font-semibold">{formatINRWhole(totals.available)}</span>
        </div>
      </div>

      {showOpeningCashNote && (
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          * opening balance — Alice Blue exposes no live cash figure. Cash is not
          totalled because the three brokers report it as of different times.
        </p>
      )}
    </>
  );
}
