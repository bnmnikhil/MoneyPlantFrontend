import { ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR, formatNumber } from "@/lib/format";
import type { OptionChainResponse, OptionChainRow } from "@/types/api";

export function OptionChainPicker({ chain, isLoading, error, onRetry, onExpand, onAdd, quantityFor, canExpand = true }: {
  chain?: OptionChainResponse;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onExpand: () => void;
  onAdd: (row: OptionChainRow, type: "CE" | "PE", direction: "BUY" | "SELL") => void;
  quantityFor: (row: OptionChainRow, type: "CE" | "PE") => { existing: number; draft: number };
  canExpand?: boolean;
}) {
  // Once for the table, not once per row: a 50-strike chain made this quadratic.
  const atmStrike = atmOf(chain);

  return (
    <div className="builder-chain">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2>Option chain</h2>
          <p className="text-xs text-muted-foreground">
            {chain ? `Last traded price · Retrieved ${new Date(chain.fetchedAt).toLocaleTimeString("en-IN")}` : "Choose an expiry and quote source"}
            {chain?.availability === "STALE" ? " · Stale after failed refresh" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRetry} disabled={isLoading}>
            <RefreshCw className={`mr-1 size-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>
      {chain && <div className="builder-chain-context"><span>{chain.underlying}</span><span>{new Date(`${chain.expiry}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span><span>{chain.rows.length} strikes</span></div>}

      {Boolean(error) && <p role="alert" className="rounded border border-loss/30 bg-loss/5 p-3 text-sm text-loss">Option data unavailable. Your existing draft and manual assumptions are unchanged.</p>}
      {isLoading && !chain && <p className="p-6 text-center text-sm text-muted-foreground">Loading option chain…</p>}
      {chain && (
        // Scrolls inside its own pane so the payoff beside it stays in view
        // however many strikes are expanded.
        <div className="builder-chain-scroll" tabIndex={0} role="region" aria-label="Option chain strikes">
          <table className="builder-chain-table">
            <thead className="sticky top-0 z-10 bg-card text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
              <tr>
                <th className="p-2 text-center font-medium" colSpan={3}>Calls</th>
                <th className="p-2 text-center font-medium">Strike</th>
                <th className="p-2 text-center font-medium" colSpan={3}>Puts</th>
              </tr>
              <tr>{["LTP", "Buy", "Sell", "Strike", "LTP", "Buy", "Sell"].map((label, index) => <th key={index}>{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {chain.rows.map((row) => {
                const disabled = row.lotSize === null || row.metadataConflict;
                const isAtm = row.strike === atmStrike;
                return (
                  <tr key={row.strike} className={isAtm ? "bg-primary/5" : undefined}>
                    <td className="py-1.5 pr-2 text-right">
                      <Quote observation={row.call} quantity={quantityFor(row, "CE")} />
                    </td>
                    <SideButtons disabled={disabled} onBuy={() => onAdd(row, "CE", "BUY")} onSell={() => onAdd(row, "CE", "SELL")} label="CE" strike={row.strike} />
                    <td className={`border-x border-border px-2 py-1.5 text-center tabular-nums ${isAtm ? "font-bold text-primary" : "font-semibold"}`}>
                      {formatNumber(row.strike)}
                      {isAtm && <span className="ml-1 text-[10px] font-medium uppercase tracking-wide">atm</span>}
                      {row.metadataConflict && <span className="block text-[10px] font-normal text-loss">Lot-size conflict</span>}
                    </td>
                    <td className="py-1.5 pl-2 text-left">
                      <Quote observation={row.put} quantity={quantityFor(row, "PE")} align="left" />
                    </td>
                    <SideButtons disabled={disabled} onBuy={() => onAdd(row, "PE", "BUY")} onSell={() => onAdd(row, "PE", "SELL")} label="PE" strike={row.strike} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!chain && !isLoading && !error && <p className="builder-empty">Choose an expiry and an available quote source to load the chain.</p>}
      {chain && <button type="button" className="builder-chain-expand" onClick={onExpand} disabled={!canExpand || isLoading}><ChevronDown className="size-4" />{canExpand ? "Load 10 more strikes each side" : "Maximum strike window loaded"}</button>}
      {chain?.warnings.map((warning) => <p key={warning} role="status" className="text-xs text-amber-600">{warning}</p>)}
    </div>
  );
}

/** Price with any held/draft quantity beneath it, so the pair costs one column. */
function Quote({ observation, quantity, align = "right" }: {
  observation: OptionChainRow["call"];
  quantity: { existing: number; draft: number };
  align?: "left" | "right";
}) {
  const label = quantityLabel(quantity);
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      {observation.priceKnown && observation.value !== null
        ? <span className="font-medium tabular-nums">{formatINR(observation.value)}</span>
        : <span className="text-muted-foreground">No quote</span>}
      {label && <span className="block text-[10px] text-muted-foreground">{label}</span>}
    </div>
  );
}

function SideButtons({ disabled, onBuy, onSell, label, strike }: {
  disabled: boolean;
  onBuy: () => void;
  onSell: () => void;
  label: string;
  strike: number;
}) {
  return <><td>
    <button type="button" disabled={disabled} aria-label={`Buy ${label} ${strike}`} onClick={onBuy}
      className="builder-direction buy">Buy</button></td><td>
    <button type="button" disabled={disabled} aria-label={`Sell ${label} ${strike}`} onClick={onSell}
      className="builder-direction sell">Sell</button>
  </td></>;
}

/** The listed strike nearest spot, or null when nothing could quote spot. */
function atmOf(chain?: OptionChainResponse): number | null {
  if (!chain || chain.spot === null || !chain.rows.length) return null;
  const spot = chain.spot;
  return chain.rows.reduce((best, row) =>
    Math.abs(row.strike - spot) < Math.abs(best - spot) ? row.strike : best, chain.rows[0].strike);
}

function quantityLabel(value: { existing: number; draft: number }) {
  const parts = [];
  if (value.existing) parts.push(`Held ${value.existing > 0 ? "+" : ""}${value.existing}`);
  if (value.draft) parts.push(`Draft ${value.draft > 0 ? "+" : ""}${value.draft}`);
  return parts.join(" · ") || "";
}
