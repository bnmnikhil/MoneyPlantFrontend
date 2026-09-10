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
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr><th className="p-2 text-left" colSpan={3}>Calls</th><th className="p-2 text-center">Strike</th><th className="p-2 text-right" colSpan={3}>Puts</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {chain.rows.map((row) => {
                const ceQty = quantityFor(row, "CE"), peQty = quantityFor(row, "PE");
                const callDisabled = row.lotSize === null || row.metadataConflict;
                const putDisabled = row.lotSize === null || row.metadataConflict;
                return (
                  <tr key={row.strike} className={chain.spot !== null && Math.abs(row.strike - chain.spot) === Math.min(...chain.rows.map((r) => Math.abs(r.strike - chain.spot!))) ? "bg-primary/5" : ""}>
                    <td className="p-2"><SideButtons disabled={callDisabled} onBuy={() => onAdd(row, "CE", "BUY")} onSell={() => onAdd(row, "CE", "SELL")} label="CE" strike={row.strike} /></td>
                    <td className="p-2 text-right font-medium">{row.call.priceKnown && row.call.value !== null ? formatINR(row.call.value) : "Quote unavailable"}</td>
                    <td className="p-2 text-muted-foreground">{quantityLabel(ceQty)}</td>
                    <td className="border-x border-border p-2 text-center font-bold tabular-nums">
                      {formatNumber(row.strike)}
                      {row.metadataConflict && <span className="block text-[10px] text-loss">Lot-size conflict</span>}
                    </td>
                    <td className="p-2 text-right text-muted-foreground">{quantityLabel(peQty)}</td>
                    <td className="p-2 font-medium">{row.put.priceKnown && row.put.value !== null ? formatINR(row.put.value) : "Quote unavailable"}</td>
                    <td className="p-2 text-right"><SideButtons disabled={putDisabled} onBuy={() => onAdd(row, "PE", "BUY")} onSell={() => onAdd(row, "PE", "SELL")} label="PE" strike={row.strike} /></td>
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

function SideButtons({ disabled, onBuy, onSell, label, strike }: {
  disabled: boolean;
  onBuy: () => void;
  onSell: () => void;
  label: string;
  strike: number;
}) {
  return <div className="flex gap-1">
    <button type="button" disabled={disabled} aria-label={`Buy ${label} ${strike}`} onClick={onBuy}
      className="rounded bg-profit/10 px-2 py-1 font-semibold text-profit disabled:opacity-35">Buy</button>
    <button type="button" disabled={disabled} aria-label={`Sell ${label} ${strike}`} onClick={onSell}
      className="rounded bg-loss/10 px-2 py-1 font-semibold text-loss disabled:opacity-35">Sell</button>
  </div>;
}

function quantityLabel(value: { existing: number; draft: number }) {
  const parts = [];
  if (value.existing) parts.push(`Held ${value.existing > 0 ? "+" : ""}${value.existing}`);
  if (value.draft) parts.push(`Draft ${value.draft > 0 ? "+" : ""}${value.draft}`);
  return parts.join(" · ") || "";
}
