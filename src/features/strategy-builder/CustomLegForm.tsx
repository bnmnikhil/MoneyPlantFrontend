import { useState } from "react";
import { Plus } from "lucide-react";
import type { OptionChainResponse, OptionChainRow } from "@/types/api";
import { formatNumber } from "@/lib/format";

export function CustomLegForm({ chain, onAdd }: { chain?: OptionChainResponse; onAdd: (row: OptionChainRow, type: "CE" | "PE", direction: "BUY" | "SELL") => void }) {
  const [open, setOpen] = useState(false);
  const [strike, setStrike] = useState("");
  const [type, setType] = useState<"CE" | "PE">("CE");
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const rows = chain?.rows.filter((row) => row.lotSize && !row.metadataConflict) ?? [];
  const selected = rows.find((row) => String(row.strike) === strike) ?? rows[0];
  return <div className="builder-custom-leg">
    <button type="button" className="builder-primary-button" disabled={!rows.length} aria-expanded={open} onClick={() => setOpen(!open)}><Plus className="size-4" />Add custom leg</button>
    {open && <form className="builder-custom-form" onSubmit={(event) => { event.preventDefault(); if (selected) { onAdd(selected, type, direction); setOpen(false); } }}>
      <p className="basis-full text-xs text-muted-foreground">{chain?.underlying} · {chain?.expiry} · Add one lot, then edit its quantity and assumed price.</p>
      <select aria-label="Custom leg direction" value={direction} onChange={(event) => setDirection(event.target.value as "BUY" | "SELL")}><option>BUY</option><option>SELL</option></select>
      <select aria-label="Custom leg strike" value={selected?.strike ?? ""} onChange={(event) => setStrike(event.target.value)}>{rows.map((row) => <option key={row.strike} value={row.strike}>{formatNumber(row.strike)}</option>)}</select>
      <select aria-label="Custom leg type" value={type} onChange={(event) => setType(event.target.value as "CE" | "PE")}><option>CE</option><option>PE</option></select>
      <button className="builder-small-button" type="submit" disabled={!selected}>Add leg</button>
    </form>}
  </div>;
}
