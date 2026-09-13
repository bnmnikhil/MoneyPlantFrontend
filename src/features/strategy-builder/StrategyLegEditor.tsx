import { LockKeyhole, Minus, Plus, Trash2 } from "lucide-react";
import { formatINR, formatNumber, formatSignedINR } from "@/lib/format";
import type { OptionChainResponse, OptionChainRow, ScenarioLeg } from "@/types/api";
import { legCashflow, markedPnl, quantitySize } from "./legFigures";

export function StrategyLegEditor({ baseline, drafts, expiries, chain, account, onToggle, onRemove,
  onDirection, onQuantity, onPrice, onLatest, onExpiry, onContract, onClose }: {
  baseline: ScenarioLeg[]; drafts: ScenarioLeg[]; expiries: string[]; chain?: OptionChainResponse; account?: string;
  onToggle: (id: string) => void; onRemove: (id: string) => void; onDirection: (id: string) => void;
  onQuantity: (id: string, units: number) => void; onPrice: (id: string, price: number | null) => void;
  onLatest: (id: string) => void; onExpiry: (id: string, expiry: string) => void;
  onContract: (id: string, row: OptionChainRow, type: "CE" | "PE") => void; onClose: (leg: ScenarioLeg) => void;
}) {
  return <div className="builder-leg-sections">
    <section aria-label="Existing positions">
      <div className="builder-section-heading"><h3>Existing positions{account ? ` · ${account}` : ""}</h3><span><LockKeyhole className="size-3.5" />{baseline.length} locked</span></div>
      {baseline.length ? <div className="builder-table-scroll" tabIndex={0} role="region" aria-label="Existing position legs">
        <table className="builder-baseline-table"><thead><tr><th>Instrument</th><th>Type</th><th>Qty</th><th>Entry price</th><th>LTP</th><th title="Unrealised P&L at the imported mark; realised P&L is not included">Unreal. P&amp;L</th><th><span className="sr-only">Action</span></th></tr></thead>
          <tbody>{baseline.map((leg) => {
            const pnl = markedPnl(leg), size = quantitySize(leg);
            return <tr key={leg.id}>
              <td><span className="inline-flex items-center gap-2" title={`${contractLabel(leg)} · Immutable baseline`}><span>{contractLabel(leg)}</span><LockKeyhole className="size-3 shrink-0 text-muted-foreground" /></span></td>
              <td><span className={`builder-direction ${leg.qty < 0 ? "sell" : "buy"}`}>{leg.qty < 0 ? "SELL" : "BUY"}</span></td>
              <td title={`${leg.qty} units`}>{leg.qty < 0 ? "−" : ""}{formatNumber(size.value)}<small>{size.unit}</small></td>
              <td>{leg.entryPrice === null ? "—" : formatINR(leg.entryPrice)}</td>
              <td title={leg.currentMark ? `Imported ${new Date(leg.currentMark.fetchedAt).toLocaleString("en-IN")}` : "Quote unavailable"}>{leg.currentMark?.priceKnown && leg.currentMark.value !== null ? formatINR(leg.currentMark.value) : "—"}</td>
              <td className={pnl === null ? "" : pnl < 0 ? "text-loss" : "text-profit"}>{pnl === null ? "—" : formatSignedINR(pnl)}</td>
              <td><button type="button" className="builder-small-button" aria-label={`Close or reduce ${contractLabel(leg)}`} onClick={() => onClose(leg)}>Close</button></td>
            </tr>;
          })}</tbody>
        </table></div> : <p className="builder-empty">No baseline. Add existing positions above or build a new strategy.</p>}
    </section>
    <section aria-label="Draft adjustments">
      <div className="builder-section-heading"><h3>Draft adjustments · {drafts.length} legs</h3><span>{drafts.filter((leg) => leg.enabled).length} enabled · assumed prices</span></div>
      {!drafts.length ? <p className="builder-empty">Add Buy/Sell legs from the chain or choose a quick recipe.</p> :
        <div className="builder-table-scroll" tabIndex={0} role="region" aria-label="Draft trade legs">
          <table className="builder-draft-table"><thead><tr><th>On</th><th>Type</th><th>Instrument</th><th>Qty</th><th>Price</th><th>Cashflow</th><th><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>{drafts.map((leg) => {
              const size = quantitySize(leg), cashflow = legCashflow(leg);
              const option = leg.contract.type === "CE" || leg.contract.type === "PE";
              const rows = chain?.expiry === leg.contract.expiry ? chain.rows : [];
              const changeSize = (value: number) => {
                if (Number.isInteger(value) && value >= 1) onQuantity(leg.id, size.unit === "lots" ? value * leg.lotSize! : value);
              };
              return <tr key={leg.id} className={leg.enabled ? "" : "builder-leg-disabled"}>
                <td><input className="payoff-holdings-switch" role="switch" aria-label={`Enable ${contractLabel(leg)}`} type="checkbox" checked={leg.enabled} onChange={() => onToggle(leg.id)} /></td>
                <td><button type="button" aria-label={`Change direction for ${contractLabel(leg)}`} onClick={() => onDirection(leg.id)} className={`builder-direction ${leg.qty < 0 ? "sell" : "buy"}`}>{leg.qty < 0 ? "SELL" : "BUY"}</button></td>
                <td><details className="builder-contract-editor"><summary title="Edit contract and price source">{contractLabel(leg)}</summary>
                  <div className="builder-contract-fields">
                    {option && <>
                      <label>Option type<select aria-label="Option type" value={leg.contract.type} disabled={!rows.some((row) => row.strike === leg.contract.strike)} onChange={(event) => { const row = rows.find((candidate) => candidate.strike === leg.contract.strike); if (row) onContract(leg.id, row, event.target.value as "CE" | "PE"); }}><option value="CE">CE</option><option value="PE">PE</option></select></label>
                      <label>Expiry<select aria-label="Draft expiry" value={leg.contract.expiry ?? ""} onChange={(event) => onExpiry(leg.id, event.target.value)}>
                        {[...new Set([leg.contract.expiry ?? "", ...expiries])].filter(Boolean).map((expiry) => <option key={expiry} value={expiry}>{expiry}</option>)}
                      </select></label>
                      <label>Strike<select aria-label="Draft strike" value={leg.contract.strike} disabled={!rows.length} onChange={(event) => { const row = rows.find((candidate) => candidate.strike === Number(event.target.value)); if (row) onContract(leg.id, row, leg.contract.type as "CE" | "PE"); }}>
                        {!rows.some((row) => row.strike === leg.contract.strike) && <option value={leg.contract.strike}>{formatNumber(leg.contract.strike)}</option>}
                        {rows.map((row) => <option key={row.strike} value={row.strike} disabled={row.metadataConflict || !row.lotSize}>{formatNumber(row.strike)}</option>)}
                      </select></label>
                    </>}
                    <p>{Math.abs(leg.qty)} units{leg.lotSize ? ` · Lot size ${leg.lotSize}` : option ? " · Lot size unresolved" : ""}</p>
                    <p>{leg.priceBasis === "MANUAL" ? "Manual assumption" : `Quote accepted ${leg.entryQuote ? new Date(leg.entryQuote.fetchedAt).toLocaleTimeString("en-IN") : ""}`}{leg.closesLegId ? " · Closes an existing leg" : ""}</p>
                    <button type="button" className="builder-small-button" onClick={() => onLatest(leg.id)} disabled={!leg.currentMark?.priceKnown}>Use latest available mark</button>
                  </div>
                </details>{leg.entryPrice === null && <span className="block text-xs text-loss">Price required</span>}</td>
                <td><div className="builder-stepper"><button type="button" aria-label={`Decrease quantity for ${contractLabel(leg)}`} disabled={size.value <= 1} onClick={() => changeSize(size.value - 1)}><Minus className="size-3" /></button>
                  <input aria-label={`Quantity in ${size.unit} for ${contractLabel(leg)}`} type="number" min={1} step={1} value={size.value} onChange={(event) => changeSize(Number(event.target.value))} />
                  <button type="button" aria-label={`Increase quantity for ${contractLabel(leg)}`} onClick={() => changeSize(size.value + 1)}><Plus className="size-3" /></button></div><small>{size.unit}</small></td>
                <td><input className="builder-price-input" aria-label={`Assumed price for ${contractLabel(leg)}`} type="number" min={0} step="any" value={leg.entryPrice ?? ""} onChange={(event) => onPrice(leg.id, event.target.value === "" ? null : Number(event.target.value))} /></td>
                <td className={cashflow === null || !leg.enabled ? "text-muted-foreground" : cashflow < 0 ? "text-loss" : "text-profit"}>{!leg.enabled ? "Excluded" : cashflow === null ? "—" : formatSignedINR(cashflow)}</td>
                <td><button type="button" aria-label={`Remove ${contractLabel(leg)}`} onClick={() => onRemove(leg.id)} className="p-1 text-muted-foreground hover:text-loss"><Trash2 className="size-4" /></button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
    </section>
  </div>;
}

function contractLabel(leg: ScenarioLeg) {
  if (leg.contract.type === "EQ") return `${leg.contract.underlying} shares`;
  const expiry = leg.contract.expiry ? new Date(`${leg.contract.expiry}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "";
  return `${leg.contract.underlying} ${expiry} ${leg.contract.type === "FUT" ? "FUT" : `${formatNumber(leg.contract.strike)} ${leg.contract.type}`}`;
}
