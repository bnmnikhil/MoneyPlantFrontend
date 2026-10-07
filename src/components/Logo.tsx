import { cn } from "@/lib/utils";

/** The mark's two golds: the lit page and the shaded one. Fixed, not themed — it is the brand. */
const GOLD = "#F5B942";
const GOLD_LIGHT = "#FFD677";

/**
 * GoldenBook wordmark + open-book glyph. Purely CSS/SVG primitives (no imagery).
 */
export function Logo({
  className,
  showWordmark = true,
  size = 28,
  variant = "default",
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
  variant?: "default" | "header";
}) {
  if (variant === "header") {
    return (
      <span className={cn("inline-flex shrink-0 items-center gap-2.5", className)}>
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <path d="M20 10C15 6.5 9 5.5 3 6.5V31C9 30 15 31 20 34.5Z" fill={GOLD} />
          <path d="M20 10C25 6.5 31 5.5 37 6.5V31C31 30 25 31 20 34.5Z" fill={GOLD_LIGHT} />
          <path d="M20 10V34.5" stroke="#0F0E0C" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8 13.5C11 13.2 14 13.8 16.5 15M8 19C11 18.7 14 19.3 16.5 20.5" stroke="#0F0E0C" strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {showWordmark && <span className="font-serif text-[1.375rem] font-semibold tracking-tight text-foreground xl:text-[1.5rem]">GoldenBook</span>}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="grid place-items-center rounded-lg bg-[#F5B942]/12 ring-1 ring-inset ring-[#F5B942]/25"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke={GOLD}
          style={{ width: size * 0.62, height: size * 0.62 }}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 7c-2.5-2-5.5-2.5-9-2v13c3.5-.5 6.5 0 9 2" />
          <path d="M12 7c2.5-2 5.5-2.5 9-2v13c-3.5-.5-6.5 0-9 2" />
          <path d="M12 7v13" />
        </svg>
      </span>
      {showWordmark && (
        <span className="font-serif text-[15px] font-semibold tracking-tight text-foreground">
          GoldenBook
        </span>
      )}
    </span>
  );
}
