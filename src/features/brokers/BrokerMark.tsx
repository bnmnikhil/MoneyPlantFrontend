import { brokerInitials } from "@/features/brokers/catalog";
import { cn } from "@/lib/utils";

/**
 * A broker's two-letter tile.
 *
 * The colour is picked from the broker id rather than configured per broker, so
 * a new broker gets a stable, distinct mark with no frontend change — the same
 * "zero changes for a new broker" rule `BrokerRegistry` keeps on the backend.
 * Deterministic, so the same broker is the same colour on every render and in
 * every session.
 */
const TONES = [
  "bg-sky-500/15 text-sky-300 ring-sky-400/25",
  "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/25",
  "bg-cyan-500/15 text-cyan-300 ring-cyan-400/25",
  "bg-violet-500/15 text-violet-300 ring-violet-400/25",
  "bg-orange-500/15 text-orange-300 ring-orange-400/25",
  "bg-lime-500/15 text-lime-300 ring-lime-400/25",
];

function tone(brokerId: string) {
  let hash = 0;
  for (let i = 0; i < brokerId.length; i += 1) {
    hash = (hash * 31 + brokerId.charCodeAt(i)) | 0;
  }
  return TONES[Math.abs(hash) % TONES.length];
}

export function BrokerMark({
  brokerId,
  displayName,
  size = "md",
  className,
}: {
  brokerId: string;
  displayName: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-md font-semibold tracking-tight ring-1 ring-inset",
        size === "sm" ? "size-5 text-[10px]" : "size-7 text-[11px]",
        tone(brokerId),
        className
      )}
    >
      {brokerInitials(displayName)}
    </span>
  );
}
