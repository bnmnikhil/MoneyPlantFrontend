import type { PayoffLeg } from "@/types/api";
import { formatINR, formatNumber, formatSignedINRWhole } from "@/lib/format";
import { legKey, legOpenPnl } from "./legSelection";

function contractText(leg: PayoffLeg): string {
  if (leg.type === "EQ") return `${leg.underlying} shares`;
  if (leg.type === "FUT") return `${leg.underlying} FUT`;
  return `${formatNumber(leg.strike)} ${leg.type}`;
}

function expiryShort(expiry: string | null): string | null {
  if (!expiry) return null;
  return new Date(`${expiry}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/**
 * The position's legs, each with its own open P/L and a checkbox that puts it on or takes it off
 * the graph. Quantities are signed units: "S 75" is short 75, "B 75" long 75.
 */
export function LegsRail({ legs, excluded, onToggle, onShowAll, showExpiry }: {
  legs: PayoffLeg[];
  excluded: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
  showExpiry: boolean;
}) {
  const ticked = legs.length - legs.filter((leg, index) => excluded.has(legKey(leg, index))).length;
  return <>
    <div className="payoff-legs-header">
      <h2 id="live-legs-title">Legs</h2>
      <p>{ticked} of {legs.length} on the graph</p>
    </div>
    <ul className="payoff-legs-list" aria-labelledby="live-legs-title">
      {legs.map((leg, index) => {
        const key = legKey(leg, index);
        const on = !excluded.has(key);
        const last = on && ticked === 1;
        const pnl = legOpenPnl(leg);
        const expiry = showExpiry ? expiryShort(leg.expiry) : null;
        return <li key={key} className={on ? "payoff-leg" : "payoff-leg payoff-leg-off"}>
          <label className="payoff-leg-main" title={last ? "At least one leg stays on the graph" : undefined}>
            <input type="checkbox" checked={on} disabled={last} onChange={() => onToggle(key)}
              aria-label={`${on ? "Remove" : "Add"} ${leg.symbol} ${on ? "from" : "to"} the graph`} />
            <span className={leg.qty < 0 ? "payoff-leg-side payoff-leg-short" : "payoff-leg-side payoff-leg-long"}>
              {leg.qty < 0 ? "S" : "B"} {formatNumber(Math.abs(leg.qty))}
            </span>
            <span className="payoff-leg-contract" title={leg.symbol}>{contractText(leg)}</span>
            <span className={`payoff-leg-pnl ${pnl === null ? "text-muted-foreground" : pnl >= 0 ? "text-profit" : "text-loss"}`}>
              {pnl === null ? "—" : formatSignedINRWhole(pnl)}
            </span>
          </label>
          <span className="payoff-leg-meta">
            {formatINR(leg.avgPrice)} → {leg.currentMarkKnown && leg.currentMark !== null ? formatINR(leg.currentMark) : "no price"}
            {expiry && ` · ${expiry}`}
            {!on && " · not on graph"}
          </span>
        </li>;
      })}
    </ul>
    {ticked < legs.length && <div className="payoff-legs-footer">
      <span>Untick a leg to see the position without it</span>
      <button type="button" className="payoff-link" onClick={onShowAll}>Show all</button>
    </div>}
  </>;
}
