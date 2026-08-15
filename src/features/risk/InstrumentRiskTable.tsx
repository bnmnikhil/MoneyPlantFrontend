import { Infinity as InfinityIcon, HelpCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brokerLabel } from "@/components/BrokerBadge";
import { MarginFigure } from "@/components/MarginFigure";
import { accountLabel } from "@/features/dashboard/aggregate";
import type { MarginProvenance } from "@/features/positions/margin";
import { formatINRWhole, formatSignedINR, formatNumber, pnlColor } from "@/lib/format";
import type { InstrumentRiskRow } from "@/types/api";

/**
 * A contract's display name.
 *
 * Prefers the structural key over the broker's trading symbol, because the
 * symbol is a vendor spelling and the whole point of `InstrumentKey` is that
 * the app speaks its own vocabulary. Falls back to the symbol when nothing
 * resolved it — which is the normal case for Alice Blue, whose `getInstruments`
 * returns empty.
 */
function contractName(row: InstrumentRiskRow) {
  const k = row.key;
  if (!k) return row.symbol;
  if (k.type === "EQ") return row.underlyingLabel ?? k.underlying;
  if (k.type === "FUT") return `${row.underlyingLabel ?? k.underlying} FUT`;
  return `${row.underlyingLabel ?? k.underlying} ${formatNumber(k.strike)} ${k.type}`;
}

/**
 * The worst case, or an honest refusal to state one.
 *
 * Three renderings for three different facts. A number means held-to-expiry
 * arithmetic we can stand behind. The infinity mark means we know it is
 * unbounded — a short call or short future. The question mark means no contract
 * master resolved the symbol, so there is no strike to reason from at all.
 * Rendering the last two the same way would let a gap read as safety.
 */
function MaxLoss({ row }: { row: InstrumentRiskRow }) {
  if (row.lossBound === "UNBOUNDED") {
    return (
      <span
        className="inline-flex items-center gap-1 text-destructive"
        title="Short call or short future — loss rises without limit as spot does."
      >
        <InfinityIcon className="h-3.5 w-3.5" />
        Unbounded
      </span>
    );
  }
  if (row.lossBound === "UNKNOWN") {
    return (
      <span
        className="inline-flex items-center gap-1 text-muted-foreground"
        title="No contract master resolved this symbol, so there is no strike to reason from. This is a gap, not a guarantee."
      >
        <HelpCircle className="h-3.5 w-3.5" />
        Unknown
      </span>
    );
  }
  return <span className="tnum">{formatINRWhole(row.maxLoss ?? 0)}</span>;
}

/**
 * Capital tied up, with its provenance.
 *
 * Rendering lives in the shared {@link MarginFigure} so the positions table's
 * per-underlying subtotal and this per-contract figure — both allocations of the
 * same bill — cannot describe themselves differently.
 */
function Margin({ row }: { row: InstrumentRiskRow }) {
  const attributed = row.marginBasis !== "UNAVAILABLE" && row.marginUsed !== null;
  // UNAVAILABLE has no provenance to report; the dash is rendered off `amount`,
  // so anything is unused there. Narrowing explicitly keeps the union honest.
  const provenance: MarginProvenance =
    row.marginBasis === "BROKER_MODEL" ? "BROKER_MODEL" : "ESTIMATED";
  return (
    <MarginFigure
      amount={attributed ? row.marginUsed : null}
      provenance={provenance}
      emptyTitle="No basis to divide the account's margin on — no margin data for this account, or nothing this contract loses under any scenario considered."
    />
  );
}

function Qty({ row }: { row: InstrumentRiskRow }) {
  if (row.netQty === 0 && row.grossQty > 0) {
    return (
      <span
        className="text-muted-foreground"
        title={`Held both ways in this account — ${row.grossQty} gross, netting to flat. No market risk, but margin is charged on both sides.`}
      >
        0 <span className="text-xs">(flat, {row.grossQty} gross)</span>
      </span>
    );
  }
  return (
    <span className={row.netQty < 0 ? "text-destructive" : undefined}>
      {row.netQty > 0 ? `+${row.netQty}` : row.netQty}
    </span>
  );
}

export function InstrumentRiskTable({ rows }: { rows: InstrumentRiskRow[] }) {
  // Only label the account when this broker actually holds more than one, so a
  // single-account setup is not cluttered with a label that distinguishes
  // nothing. Same rule as needsAccountLabel on the dashboard, but counting
  // distinct connections rather than rows — one account can contribute many.
  const connectionsPerBroker = new Map<string, Set<string>>();
  for (const r of rows) {
    const seen = connectionsPerBroker.get(r.brokerId) ?? new Set<string>();
    seen.add(r.connectionId);
    connectionsPerBroker.set(r.brokerId, seen);
  }
  const multiAccount = new Set(
    [...connectionsPerBroker].filter(([, ids]) => ids.size > 1).map(([id]) => id)
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Contract</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Net qty</TableHead>
            <TableHead className="text-right">Avg entry</TableHead>
            <TableHead className="text-right">LTP</TableHead>
            <TableHead className="text-right">Market value</TableHead>
            <TableHead className="text-right">Max loss</TableHead>
            <TableHead className="text-right">Margin</TableHead>
            <TableHead className="text-right">P&amp;L</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.connectionId}|${row.symbol}`}>
              <TableCell className="font-medium">
                {contractName(row)}
                {row.key?.expiry && (
                  <span className="ml-2 text-xs text-muted-foreground">{row.key.expiry}</span>
                )}
                {/*
                  Kite returns the same contract once per product. Showing the
                  split is what makes a surprising net traceable.
                */}
                {row.legs.length > 1 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({row.legs.map((l) => `${l.product} ${l.qty}`).join(", ")})
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {brokerLabel(row.brokerId)}
                {multiAccount.has(row.brokerId) && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {accountLabel(row.connectionId)}
                  </span>
                )}
              </TableCell>
              <TableCell className="tnum text-right">
                <Qty row={row} />
              </TableCell>
              <TableCell className="tnum text-right">{formatNumber(row.avgEntry)}</TableCell>
              <TableCell className="tnum text-right">{formatNumber(row.ltp)}</TableCell>
              <TableCell className="tnum text-right">{formatINRWhole(row.marketValue)}</TableCell>
              <TableCell className="text-right">
                <MaxLoss row={row} />
              </TableCell>
              <TableCell className="text-right">
                <Margin row={row} />
              </TableCell>
              <TableCell className={`tnum text-right ${pnlColor(row.pnl)}`}>
                {formatSignedINR(row.pnl)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
