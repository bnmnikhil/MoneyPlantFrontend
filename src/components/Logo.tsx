import { cn } from "@/lib/utils";

/**
 * MoneyPlant wordmark + sprout glyph. Purely CSS/SVG primitives (no imagery).
 */
export function Logo({
  className,
  showWordmark = true,
  size = 28,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}) {
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
