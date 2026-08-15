import { formatSignedINRWhole } from "@/lib/format";

/**
 * Premium still on the table, optionally against what was put on at entry and
 * against the capital the position ties up.
 *
 * Sibling of `MarginFigure`, and shaped like it on purpose — the two sit in
 * adjacent columns and the whole point of the pair is that they be compared.
 * What they are is opposite, though, and the code should not blur it: a margin
 * figure is *allocated* from a bill and carries a provenance dot because there
 * is no single true per-contract number; a premium figure is plain arithmetic on
 * the row's own qty and LTP, exact at every level, so it needs no provenance and
 * appears on the legs too.
 *
 * **Never coloured by sign.** A negative premium is a net debit, not a loss, and
 * `pnlColor` would assert otherwise. P&L is the next column along and already
 * carries the sign that means good or bad.
 *
 * **Whole rupees, so a band can sit a rupee off the sum of its groups.** Every
 * cell rounds independently, and option premiums land on paise: measured live,
 * Kite's four groups were 5300.00 + 2659.50 + 11662.50 + 1638.75 = 21260.75,
 * which displays as 21,261 while the four displayed groups add to 21,262. The
 * underlying arithmetic is exact — this is presentation, and the fix is not a
 * reconciliation but either paise everywhere or nothing. Nothing was chosen:
 * three lines of six-digit figures per cell is already dense, and margin beside
 * it is whole-rupee too.
 */
export function PremiumFigure({
  premiumLeft,
  atEntry,
  marginUsed,
}: {
  /** Positive is a net credit: what you keep if every leg expires worthless. */
  premiumLeft: number;
  /** The same figure at entry. Omit on leg rows — the avg price is already there. */
  atEntry?: number;
  /**
   * Allocated margin for this group, for the reward-on-capital line. Null or
   * omitted renders no line rather than a zero: the ratio is unanswerable
   * without a denominator, which is not the same as it being nothing.
   */
  marginUsed?: number | null;
}) {
  const showEntry = atEntry !== undefined && Math.round(atEntry) !== Math.round(premiumLeft);
  const showRatio = marginUsed !== undefined && marginUsed !== null && marginUsed > 0;

  return (
    <span
      className="inline-flex flex-col items-end leading-tight"
      title={
        premiumLeft >= 0
          ? "Net credit still outstanding: what you keep if every leg here expires worthless. Sum of -(qty × LTP), so a short leg adds and a long leg subtracts."
          : "Net debit: what closing these legs would return to you, and what you lose if they expire worthless. Sum of -(qty × LTP)."
      }
    >
      <span className="tnum font-medium">{formatSignedINRWhole(premiumLeft)}</span>

      {showEntry && (
        <span className="tnum text-xs text-muted-foreground">
          of {formatSignedINRWhole(atEntry)}
        </span>
      )}

      {showRatio && (
        <span
          className="tnum text-xs text-muted-foreground"
          title="Premium left as a share of the margin allocated to this group. A live premium over an allocated bill — see the note under the table."
        >
          {Math.round((premiumLeft / marginUsed) * 100)}% of margin
        </span>
      )}
    </span>
  );
}
