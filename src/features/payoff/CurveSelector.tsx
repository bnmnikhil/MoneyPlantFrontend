import { useId, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import type { CurveRef } from "@/types/api";
import { brokerLabel } from "@/components/BrokerBadge";
import { curveKey } from "./curveSelection";

const label = (curve: CurveRef) => `${curve.underlyingLabel} · ${brokerLabel(curve.brokerId)} · ${curve.accountLabel}`;

export function CurveSelector({ curves, selected, onSelect }: { curves: CurveRef[]; selected?: CurveRef; onSelect: (curve: CurveRef) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const filtered = curves.filter((curve) => label(curve).toLowerCase().includes(query.trim().toLowerCase()));
  const close = () => { setOpen(false); setQuery(""); };
  return <div className="payoff-curve-picker" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }} onKeyDown={(event) => { if (event.key === "Escape") { close(); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" className="payoff-curve-trigger" aria-label={`Curve: ${selected ? label(selected) : "Select a curve"}`} aria-expanded={open} aria-controls={id}
      onClick={() => { if (open) close(); else setOpen(true); }}>
      <Search className="size-5 shrink-0" /><span className="min-w-0 flex-1 truncate text-left">{selected ? label(selected) : "Select a curve"}</span><ChevronDown className="size-5 shrink-0" />
    </button>
    {open && <div id={id} className="payoff-curve-menu" role="group" aria-label="Select a payoff curve">
      <input autoFocus type="search" aria-label="Search curves" placeholder="Search underlying, broker or account" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
      <div className="mt-2 max-h-64 overflow-y-auto">
        {filtered.map((curve) => <button key={curveKey(curve)} type="button" className="flex w-full items-center justify-between gap-3 rounded px-3 py-2.5 text-left text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" aria-pressed={!!selected && curveKey(selected) === curveKey(curve)}
          onClick={() => { onSelect(curve); close(); trigger.current?.focus(); }}>
          {label(curve)}{selected && curveKey(selected) === curveKey(curve) && <Check className="size-4 shrink-0 text-primary" />}
        </button>)}
        {!filtered.length && <p className="px-3 py-4 text-sm text-muted-foreground">No matching curves.</p>}
      </div>
    </div>}
  </div>;
}
