import type { BrokerWarning } from "@/types/api";
import { formatINRWhole } from "@/lib/format";
import { accountLabel, needsAccountLabel, type BrokerRow, type DashboardTotals } from "./aggregate";
import { OverviewBroker, OverviewMoney, UtilisationBar } from "./OverviewFigures";
import { capitalUtilisation } from "./overview";

interface Props {
  rows: BrokerRow[];
  totals: DashboardTotals;
  positionWarnings?: BrokerWarning[];
  holdingWarnings?: BrokerWarning[];
  marginWarnings?: BrokerWarning[];
}

export function OverviewPnlTable({ rows, totals, positionWarnings = [], holdingWarnings = [] }: Props) {
  const failedPositions = new Set(positionWarnings.map((warning) => warning.connectionId));
  const failedHoldings = new Set(holdingWarnings.map((warning) => warning.connectionId));
  const positionsPartial = failedPositions.size > 0;
  const holdingsPartial = failedHoldings.size > 0;
  return <div className="overview-table-scroll">
    <table className="overview-table" aria-label="P&L by broker account">
      <thead><tr><th>Broker</th><th>Positions P&amp;L</th><th>Holdings P&amp;L</th><th>Total P&amp;L</th><th>Day P&amp;L</th></tr></thead>
      <tbody>{rows.map((row) => {
        const positionMissing = failedPositions.has(row.connectionId);
        const holdingMissing = failedHoldings.has(row.connectionId);
        return <tr key={row.key}>
          <td><OverviewBroker brokerId={row.brokerId} account={needsAccountLabel(rows, row.brokerId) ? accountLabel(row.connectionId) : undefined} /></td>
          <td><OverviewMoney value={positionMissing ? null : row.positionsPnl} /></td>
          <td><OverviewMoney value={holdingMissing ? null : row.holdingsPnl} /></td>
          <td><OverviewMoney value={positionMissing && holdingMissing ? null : row.totalPnl} partial={positionMissing || holdingMissing} /></td>
          <td><OverviewMoney value={positionMissing ? null : row.dayPnl} /></td>
        </tr>;
      })}</tbody>
      <tfoot><tr><th>Total</th>
        <td><OverviewMoney value={positionsPartial && totals.positionCount === 0 ? null : totals.positionsPnl} partial={positionsPartial} /></td>
        <td><OverviewMoney value={holdingsPartial && totals.holdingCount === 0 ? null : totals.holdingsPnl} partial={holdingsPartial} /></td>
        <td><OverviewMoney value={(positionsPartial || holdingsPartial) && totals.positionCount + totals.holdingCount === 0 ? null : totals.totalPnl} partial={positionsPartial || holdingsPartial} /></td>
        <td><OverviewMoney value={positionsPartial && totals.positionCount === 0 ? null : totals.dayPnl} partial={positionsPartial} /></td>
      </tr></tfoot>
    </table>
  </div>;
}

export function OverviewCapitalTable({ rows, totals, marginWarnings = [] }: Props) {
  const known = rows.some((row) => row.margin !== null);
  const partial = marginWarnings.length > 0 || rows.some((row) => row.margin === null);
  return <div className="overview-table-scroll">
    <table className="overview-table overview-capital-table" aria-label="Capital by broker account">
      <thead><tr><th>Broker</th><th>Available</th><th>Used</th><th>Utilisation</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.key}>
        <td><OverviewBroker brokerId={row.brokerId} account={needsAccountLabel(rows, row.brokerId) ? accountLabel(row.connectionId) : undefined} /></td>
        <td>{row.margin ? formatINRWhole(row.margin.available) : "—"}</td>
        <td>{row.margin ? formatINRWhole(row.margin.used) : "—"}</td>
        <td><UtilisationBar percent={row.margin ? capitalUtilisation(row.margin.available, row.margin.used) : null} /></td>
      </tr>)}</tbody>
      <tfoot><tr title="Combined view only. Capital remains in separate broker accounts."><th>Total{partial && <span className="ml-1 text-amber-300" title="Some account margins are unavailable">*</span>}</th>
        <td>{known ? formatINRWhole(totals.available) : "—"}</td><td>{known ? formatINRWhole(totals.used) : "—"}</td>
        <td><UtilisationBar percent={known ? capitalUtilisation(totals.available, totals.used) : null} /></td>
      </tr></tfoot>
    </table>
  </div>;
}
