import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR, formatNumber } from "@/lib/format";
import type { OptionChainResponse, OptionChainRow } from "@/types/api";

export function OptionChainPicker({ chain, isLoading, error, onRetry, onExpand, onAdd, quantityFor }: {
  chain?: OptionChainResponse;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onExpand: () => void;
  onAdd: (row: OptionChainRow, type: "CE" | "PE", direction: "BUY" | "SELL") => void;
  quantityFor: (row: OptionChainRow, type: "CE" | "PE") => { existing: number; draft: number };
}) {
  // Once for the table, not once per row: a 50-strike chain made this quadratic.
  const atmStrike = atmOf(chain);

  return (
    <div className="flex h-full flex-col space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Option chain</h3>
          <p className="text-xs text-muted-foreground">
            {chain ? `Last traded price · Retrieved ${new Date(chain.fetchedAt).toLocaleTimeString("en-IN")}` : "Choose an expiry and quote source"}
            {chain?.availability === "STALE" ? " · Stale after failed refresh" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExpand}>Expand strikes</Button>
          <Button variant="outline" size="sm" onClick={onRetry} disabled={isLoading}>
            <RefreshCw className={`mr-1 size-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh quotes
          </Button>
        </div>
      </div>

      {Boolean(error) && <p role="alert" className="rounded border border-loss/30 bg-loss/5 p-3 text-sm text-loss">Option data unavailable. Your existing draft and manual assumptions are unchanged.</p>}
      {isLoading && !chain && <p className="p-6 text-center text-sm text-muted-foreground">Loading option chain…</p>}
      {chain && (
        // Scrolls inside its own pane so the payoff beside it stays in view
        // however many strikes are expanded.
        <div className="max-h-[520px] flex-1 overflow-auto rounded-md border border-border">
          <table className="w-full min-w-[420px] text-xs">
            <thead className="sticky top-0 z-10 bg-card text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
              <tr>
                <th className="p-2 text-left font-medium" colSpan={2}>Calls</th>
                <th className="p-2 text-center font-medium">Strike</th>
                <th className="p-2 text-right font-medium" colSpan={2}>Puts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {chain.rows.map((row) => {
                const disabled = row.lotSize === null || row.metadataConflict;
                const isAtm = row.strike === atmStrike;
                return (
                  <tr key={row.strike} className={isAtm ? "bg-primary/5" : undefined}>
                    <td className="py-1.5 pl-2">
                      <SideButtons disabled={disabled} onBuy={() => onAdd(row, "CE", "BUY")} onSell={() => onAdd(row, "CE", "SELL")} label="CE" strike={row.strike} />
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      <Quote observation={row.call} quantity={quantityFor(row, "CE")} />
                    </td>
                    <td className={`border-x border-border px-2 py-1.5 text-center tabular-nums ${isAtm ? "font-bold text-primary" : "font-semibold"}`}>
                      {formatNumber(row.strike)}
                      {isAtm && <span className="ml-1 text-[10px] font-medium uppercase tracking-wide">atm</span>}
                      {row.metadataConflict && <span className="block text-[10px] font-normal text-loss">Lot-size conflict</span>}
                    </td>
                    <td className="py-1.5 pl-2 text-left">
                      <Quote observation={row.put} quantity={quantityFor(row, "PE")} align="left" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <SideButtons disabled={disabled} onBuy={() => onAdd(row, "PE", "BUY")} onSell={() => onAdd(row, "PE", "SELL")} label="PE" strike={row.strike} align="right" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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

function SideButtons({ disabled, onBuy, onSell, label, strike, align = "left" }: {
  disabled: boolean;
  onBuy: () => void;
  onSell: () => void;
  label: string;
  strike: number;
  align?: "left" | "right";
}) {
  return <div className={`flex gap-1 ${align === "right" ? "justify-end" : ""}`}>
    <button type="button" disabled={disabled} aria-label={`Buy ${label} ${strike}`} onClick={onBuy}
      className="rounded bg-profit/10 px-2 py-1 font-semibold text-profit disabled:opacity-35">Buy</button>
    <button type="button" disabled={disabled} aria-label={`Sell ${label} ${strike}`} onClick={onSell}
      className="rounded bg-loss/10 px-2 py-1 font-semibold text-loss disabled:opacity-35">Sell</button>
  </div>;
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
