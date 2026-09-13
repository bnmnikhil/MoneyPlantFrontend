import type { PayoffLeg } from "@/types/api";
import { formatINR, formatNumber } from "@/lib/format";

function DirTag({ qty }: { qty: number }) {
  return <span className={`tnum whitespace-nowrap ${qty < 0 ? "text-loss" : "text-primary"}`}>{qty < 0 ? "Short" : "Long"} {formatNumber(Math.abs(qty))}</span>;
}

function TypeTag({ type }: { type: PayoffLeg["type"] }) {
  return <span className={`payoff-leg-type payoff-leg-type-${type.toLowerCase()}`}>{type === "EQ" ? "Shares" : type}</span>;
}

export function LegsTable({ legs }: { legs: PayoffLeg[] }) {
  return <div className="payoff-legs-scroll" tabIndex={0} role="region" aria-label="Position legs, scroll for all">
    <table className="payoff-legs-table">
      <thead><tr><th>Symbol</th><th>Type</th><th>Qty</th><th>Strike</th><th>Avg price</th></tr></thead>
      <tbody>{legs.map((leg, index) => <tr key={leg.legId || `${leg.symbol}:${leg.type}:${index}`}>
        <td title={leg.symbol}>{leg.symbol}</td><td><TypeTag type={leg.type} /></td><td><DirTag qty={leg.qty} /></td>
        <td>{leg.type === "EQ" || leg.type === "FUT" ? "—" : formatNumber(leg.strike)}</td><td>{formatINR(leg.avgPrice)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

export { DirTag };
