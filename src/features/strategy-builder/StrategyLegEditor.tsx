import { Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR, formatNumber } from "@/lib/format";
import type { OptionChainResponse, OptionChainRow, ScenarioLeg } from "@/types/api";

export function StrategyLegEditor({ baseline, drafts, expiries, chain, onToggle, onRemove,
  onDirection, onLots, onPrice, onLatest, onExpiry, onContract, onClose }: {
  baseline: ScenarioLeg[];
  drafts: ScenarioLeg[];
  expiries: string[];
  chain?: OptionChainResponse;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onDirection: (id: string) => void;
  onLots: (id: string, lots: number) => void;
  onPrice: (id: string, price: number | null) => void;
  onLatest: (id: string) => void;
  onExpiry: (id: string, expiry: string) => void;
  onContract: (id: string, row: OptionChainRow, type: "CE" | "PE") => void;
  onClose: (leg: ScenarioLeg) => void;
}) {
  return (
    <div className="space-y-5">
      {baseline.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Existing positions</h3>
          <div className="divide-y divide-border rounded-md border border-border">
            {baseline.map((leg) => (
              <div key={leg.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <strong className={leg.qty < 0 ? "text-loss" : "text-profit"}>{leg.qty < 0 ? "SELL" : "BUY"}</strong>{" "}
                  {contractLabel(leg)}
                  <p className="text-xs text-muted-foreground">{Math.abs(leg.qty)} units · Entry {formatINR(leg.entryPrice ?? 0)} · Immutable baseline</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onClose(leg)}>
                  <XCircle className="mr-1 size-3.5" /> Close / reduce
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Draft trades <span className="text-muted-foreground">({drafts.filter((leg) => leg.enabled).length} enabled)</span></h3>
        </div>
        {drafts.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Add buy/sell legs from the option chain. Proposed trades are hypothetical.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {drafts.map((leg) => {
              const lots = leg.lotSize ? Math.max(1, Math.abs(leg.qty) / leg.lotSize) : 1;
              const rows = chain?.expiry === leg.contract.expiry ? chain.rows : [];
              return (
                <div key={leg.id} className={`space-y-3 p-3 ${leg.enabled ? "" : "opacity-45"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input aria-label={`Enable ${contractLabel(leg)}`} type="checkbox" checked={leg.enabled} onChange={() => onToggle(leg.id)} />
                    <button type="button" onClick={() => onDirection(leg.id)}
                      className={`rounded px-2 py-1 text-xs font-bold ${leg.qty < 0 ? "bg-loss/10 text-loss" : "bg-profit/10 text-profit"}`}>
                      {leg.qty < 0 ? "SELL" : "BUY"}
                    </button>
                    <select aria-label="Option type" value={leg.contract.type}
                      onChange={(event) => {
                        const row = rows.find((candidate) => candidate.strike === leg.contract.strike);
                        if (row) onContract(leg.id, row, event.target.value as "CE" | "PE");
                      }} className="rounded border border-border bg-background px-2 py-1 text-xs">
                      <option value="CE">CE</option><option value="PE">PE</option>
                    </select>
                    <select aria-label="Draft expiry" value={leg.contract.expiry ?? ""}
                      onChange={(event) => onExpiry(leg.id, event.target.value)}
                      className="rounded border border-border bg-background px-2 py-1 text-xs">
                      {expiries.map((expiry) => <option key={expiry} value={expiry}>{expiry}</option>)}
                    </select>
                    <select aria-label="Draft strike" value={leg.contract.strike}
                      disabled={rows.length === 0}
                      onChange={(event) => {
                        const row = rows.find((candidate) => candidate.strike === Number(event.target.value));
                        if (row) onContract(leg.id, row, leg.contract.type as "CE" | "PE");
                      }} className="rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50">
                      {rows.length ? rows.map((row) => <option key={row.strike} value={row.strike}>{formatNumber(row.strike)}</option>)
                        : <option value={leg.contract.strike}>{formatNumber(leg.contract.strike)}</option>}
                    </select>
                    <label className="text-xs text-muted-foreground">Lots{" "}
                      <input type="number" min={1} step={1} value={lots}
                        onChange={(event) => onLots(leg.id, Math.max(1, Number(event.target.value) || 1))}
                        className="w-16 rounded border border-border bg-background px-2 py-1 text-foreground" />
                    </label>
                    <label className="text-xs text-muted-foreground">Assumed price{" "}
                      <input type="number" min={0} step="any" value={leg.entryPrice ?? ""}
                        onChange={(event) => onPrice(leg.id, event.target.value === "" ? null : Number(event.target.value))}
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-foreground" />
                    </label>
                    <Button type="button" variant="outline" size="sm" onClick={() => onLatest(leg.id)} disabled={!leg.currentMark?.priceKnown}>
                      Use latest
                    </Button>
                    <button type="button" aria-label="Remove draft leg" onClick={() => onRemove(leg.id)} className="ml-auto rounded p-1 text-muted-foreground hover:text-loss"><Trash2 className="size-4" /></button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {leg.lotSize ? `${Math.abs(leg.qty)} units · Lot size ${leg.lotSize}` : "Lot size unresolved"}
                    {" · "}{leg.priceBasis === "MANUAL" ? "Manual assumption" : `Quote accepted ${leg.entryQuote ? new Date(leg.entryQuote.fetchedAt).toLocaleTimeString("en-IN") : ""}`}
                    {leg.closesLegId ? " · Closes an existing leg" : ""}
                    {leg.entryPrice === null ? <span className="text-loss"> · Price required</span> : null}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function contractLabel(leg: ScenarioLeg) {
  if (leg.contract.type === "EQ") return `${leg.contract.underlying} shares`;
  if (leg.contract.type === "FUT") return `${leg.contract.underlying} ${leg.contract.expiry ?? ""} FUT`;
  return `${leg.contract.underlying} ${formatNumber(leg.contract.strike)} ${leg.contract.type} ${leg.contract.expiry ?? ""}`;
}
