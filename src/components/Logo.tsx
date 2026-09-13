import { cn } from "@/lib/utils";

/**
 * MoneyPlant wordmark + sprout glyph. Purely CSS/SVG primitives (no imagery).
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
          <path d="M20 13C25 5 32 3 38 3C38 17 33 28 21 31C16 32 12 30 10 27C13 22 17 18 20 13Z" fill="#00E9BF" />
          <path d="M18 14C12 9 6 12 4 18C2 24 7 29 12 29L25 16C23 15 21 15 18 14Z" fill="#00F5C4" />
          <path d="M3 36L29 11" stroke="#061820" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M3 36L12 27" stroke="#00E9BF" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {showWordmark && <span className="text-[22px] font-semibold tracking-tight text-foreground xl:text-[28px]">MoneyPlant</span>}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="grid place-items-center rounded-lg bg-primary/12 ring-1 ring-inset ring-primary/25"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="text-primary"
          style={{ width: size * 0.62, height: size * 0.62 }}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20v-7" />
          <path d="M12 13c0-3.3 2.5-5.5 6-5.5-.2 3.6-2.6 5.5-6 5.5Z" />
          <path d="M12 15c0-2.6-2-4.4-5-4.4.2 2.8 2.2 4.4 5 4.4Z" />
        </svg>
      </span>
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          MoneyPlant
        </span>
      )}
    </span>
  );
}
