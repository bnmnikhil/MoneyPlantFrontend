import { formatINRWhole } from "@/lib/format";
import type { MarginProvenance } from "@/features/positions/margin";

/**
 * A margin figure with its provenance attached.
 *
 * Shared by the risk table (per contract) and the positions table (per
 * underlying) so the two pages cannot describe the same number differently.
 *
 * The dot is not decoration: it says whether the figure came from the broker's
 * own calculator or from our bottom-up estimate, and those must not read as
 * equally authoritative. Since the estimate stopped being a division of the
 * broker's bill (17 Aug 2026) the dot carries more weight, not less — the
 * column no longer foots to anything the broker would confirm, so the method is
 * the only thing telling the reader how far to trust it. A dash means nothing
 * could be computed — never a zero charge, which would be a claim.
 */
export function MarginFigure({
  amount,
  provenance,
  unattributed = 0,
  emptyTitle,
}: {
  /** Null when nothing could be attributed. Renders a dash. */
  amount: number | null;
  provenance: MarginProvenance;
  /** Legs with no basis. Non-zero makes `amount` a floor, and says so. */
  unattributed?: number;
  emptyTitle?: string;
}) {
  if (amount === null) {
    return (
      <span
        className="text-muted-foreground"
        title={
          emptyTitle ??
          "No basis to divide the account's margin on — no margin data for this account, or nothing here loses under any scenario considered."
        }
      >
        —
      </span>
    );
  }

  const label =
    provenance === "BROKER_MODEL"
      ? "From the broker's own margin calculator."
      : provenance === "MIXED"
        ? "Mixed basis: some legs priced by the broker's calculator, some by our worst-scenario split."
        : "Estimated: the account's real margin, split by how much each contract loses at its own worst scenario. The total is what the broker charges; the split is ours.";

  return (
    <span className="tnum inline-flex items-center gap-1.5" title={label}>
      {formatINRWhole(amount)}
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          provenance === "BROKER_MODEL" ? "bg-primary" : "bg-muted-foreground/50"
        }`}
      />
      {unattributed > 0 && (
        <span
          className="text-xs text-muted-foreground"
          title={`${unattributed} leg${unattributed === 1 ? "" : "s"} here could not be attributed, so this is a floor rather than the full charge.`}
        >
          +?
        </span>
      )}
    </span>
  );
}
