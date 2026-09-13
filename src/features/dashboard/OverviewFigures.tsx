import { brokerLabel } from "@/components/BrokerBadge";
import { formatSignedINRWhole, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";

export function OverviewMoney({ value, partial = false }: { value: number | null; partial?: boolean }) {
  return <span className={cn("tnum whitespace-nowrap font-semibold", value === null ? "text-muted-foreground" : pnlColor(value))}>
    {value === null ? "—" : formatSignedINRWhole(value)}
    {partial && value !== null && <span className="ml-1 text-xs text-amber-300" title="Partial total: some accounts could not be loaded" aria-label="Partial total">*</span>}
  </span>;
}

/** Small vector marks matching the supplied mockup; unknown brokers use initials. */
export function OverviewBroker({ brokerId, account }: { brokerId: string; account?: string }) {
  return <span className="inline-flex items-center gap-3 whitespace-nowrap">
    <span className="grid size-8 shrink-0 place-items-center" aria-hidden="true">
      {brokerId === "kite" ? <svg viewBox="0 0 36 32" className="size-8"><path fill="#ff4b22" d="M2 16 15 3h19L21 16l13 13H15Z"/><path fill="#ec2619" d="m2 16 19 0 13 13H15Z"/></svg>
        : brokerId === "aliceblue" ? <svg viewBox="0 0 36 36" className="size-8"><circle cx="18" cy="18" r="14" fill="none" stroke="#0060ff" strokeWidth="6"/><path d="M7 21C4 9 18 0 29 10" fill="none" stroke="#00a1ff" strokeWidth="2"/></svg>
        : brokerId === "paytm" ? <svg viewBox="0 0 36 36" className="size-8"><path fill="#00c5ed" d="M18 2 35 31H1Z"/><path fill="#0050d8" d="m18 12 13 21H5Z"/><path fill="#b0f5ff" d="m18 19 2 5h-4Zm-5 8h3v3h-3Zm7 0h3v3h-3Z"/></svg>
        : <span className="text-sm font-bold text-primary">{brokerId.slice(0, 2).toUpperCase()}</span>}
    </span>
    <span>{brokerId === "paytm" ? "Paytm Money" : brokerLabel(brokerId)}{account && <span className="ml-2 text-xs text-muted-foreground">· {account}</span>}</span>
  </span>;
}

export function UtilisationBar({ percent, large = false }: { percent: number | null; large?: boolean }) {
  if (percent === null) return <span className="text-muted-foreground">—</span>;
  const fill = percent > 85 ? "from-[#ff6666] to-[#ef4444]" : percent >= 60 ? "from-[#ffd451] to-[#ffc329]" : "from-[#00efc2] to-[#00bd92]";
  return <div className={cn("flex items-center gap-3", large && "flex-col items-stretch gap-1") }>
    <span className="tnum whitespace-nowrap">{percent.toFixed(0)}%{large && " utilised"}</span>
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <div role="meter" aria-label="Capital utilisation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, percent)} aria-valuetext={`${percent.toFixed(0)}% utilised`}
        className={cn("min-w-16 flex-1 overflow-hidden rounded-full bg-[#223441]", large ? "h-3.5" : "h-3")}>
        <div className={cn("h-full rounded-full bg-gradient-to-r", fill)} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
      {large && <span className="tnum whitespace-nowrap text-sm text-muted-foreground">{Math.max(0, 100 - percent).toFixed(0)}% free</span>}
    </div>
  </div>;
}
