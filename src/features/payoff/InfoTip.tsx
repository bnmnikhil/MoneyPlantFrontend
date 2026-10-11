import { Info } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";

/**
 * An ⓘ that explains a control without spending a line of the panel on it. Opens on hover, focus
 * or tap (touch has no hover), closes on Escape or when focus leaves it.
 */
export function InfoTip({ label, children, align = "start" }: {
  /** What the ⓘ is about, for screen readers: "About the price range". */
  label: string;
  children: ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="info-tip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={label} aria-expanded={open} aria-describedby={open ? id : undefined}
        onClick={() => setOpen((value) => !value)} onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
        <Info className="size-3.5" aria-hidden />
      </button>
      {open && <span id={id} role="tooltip" className={`info-tip-body info-tip-${align}`}>{children}</span>}
    </span>
  );
}
