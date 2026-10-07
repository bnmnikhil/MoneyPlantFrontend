import type { BrokerWarning } from "@/types/api";
import { formatINRWhole } from "@/lib/format";
import { accountLabel, needsAccountLabel, type BrokerRow, type DashboardTotals } from "./aggregate";
import { OverviewBroker, OverviewMoney, UtilisationBar } from "./OverviewFigures";
import { capitalUtilisation } from "./overview";

/**
 * Every account once, P&L and capital side by side (OVERVIEW-REDESIGN.md OV-3).
 *
 * It replaces two tables that listed the same accounts twice. The join rules are aggregate.ts's,
 * unchanged: rows are per connection, a margin that did not load is a dash in all three capital
 * cells and never a zero, and Day P&L is positions-only. An account with nothing open is dimmed to
 * one line but keeps its capital, because free capital is still worth seeing.
 */
export function AccountsTable({ rows, totals, positionWarnings = [], holdingWarnings = [], marginWarnings = [] }: {
  rows: BrokerRow[];
  totals: DashboardTotals;
  positionWarnings?: BrokerWarning[];
  holdingWarnings?: BrokerWarning[];
  marginWarnings?: BrokerWarning[];
}) {
  const failedPositions = new Set(positionWarnings.map((warning) => warning.connectionId));
  const failedHoldings = new Set(holdingWarnings.map((warning) => warning.connectionId));
  const positionsPartial = failedPositions.size > 0;
  const holdingsPartial = failedHoldings.size > 0;
  const capitalKnown = rows.some((row) => row.margin !== null);
  const capitalPartial = marginWarnings.length > 0 || rows.some((row) => row.margin === null);

  return <div className="overview-table-scroll">
    <table className="overview-table overview-accounts-table" aria-label="Accounts: P&L and capital">
      <thead><tr>
        <th>Account</th><th>Positions</th><th>Holdings</th><th>Total P&amp;L</th><th>Day P&amp;L</th>
        <th className="overview-col-group">Available</th><th>Used</th><th>Utilisation</th>
      </tr></thead>
      <tbody>{rows.map((row) => {
        const positionMissing = failedPositions.has(row.connectionId);
        const holdingMissing = failedHoldings.has(row.connectionId);
        const idle = row.positionCount === 0 && row.holdingCount === 0 && !positionMissing && !holdingMissing;
        const pct = row.margin ? capitalUtilisation(row.margin.available, row.margin.used) : null;
        return <tr key={row.key} className={idle ? "overview-idle" : undefined}>
          <td><OverviewBroker brokerId={row.brokerId} account={needsAccountLabel(rows, row.brokerId) ? accountLabel(row.connectionId) : undefined} /></td>
          {idle ? <td colSpan={4} className="overview-idle-note">Nothing open</td> : <>
            <td><OverviewMoney value={positionMissing ? null : row.positionCount ? row.positionsPnl : null} /></td>
            <td><OverviewMoney value={holdingMissing ? null : row.holdingCount ? row.holdingsPnl : null} /></td>
            <td><OverviewMoney value={positionMissing && holdingMissing ? null : row.totalPnl} partial={positionMissing || holdingMissing} /></td>
            <td><OverviewMoney value={positionMissing || !row.positionCount ? null : row.dayPnl} /></td>
          </>}
          <td className="overview-col-group">{row.margin ? formatINRWhole(row.margin.available) : "—"}</td>
          <td>{row.margin ? formatINRWhole(row.margin.used) : "—"}</td>
          <td><UtilisationBar percent={pct} /></td>
        </tr>;
      })}</tbody>
      <tfoot><tr title="Combined view only. Capital remains in separate broker accounts.">
        <th>Total · {rows.length} account{rows.length === 1 ? "" : "s"}</th>
        {/* A total over nothing is a dash, as in the rows: ₹0 would read as "held, and flat". */}
        <td><OverviewMoney value={totals.positionCount === 0 ? null : totals.positionsPnl} partial={positionsPartial} /></td>
        <td><OverviewMoney value={totals.holdingCount === 0 ? null : totals.holdingsPnl} partial={holdingsPartial} /></td>
        <td><OverviewMoney value={(positionsPartial || holdingsPartial) && totals.positionCount + totals.holdingCount === 0 ? null : totals.totalPnl} partial={positionsPartial || holdingsPartial} /></td>
        <td><OverviewMoney value={totals.positionCount === 0 ? null : totals.dayPnl} partial={positionsPartial} /></td>
        <td className="overview-col-group">{capitalKnown ? formatINRWhole(totals.available) : "—"}{capitalPartial && capitalKnown && <span className="ml-1 text-xs text-orange-300" title="Some account margins are unavailable">*</span>}</td>
        <td>{capitalKnown ? formatINRWhole(totals.used) : "—"}</td>
        <td><UtilisationBar percent={capitalKnown ? capitalUtilisation(totals.available, totals.used) : null} /></td>
      </tr></tfoot>
    </table>
  </div>;
}
