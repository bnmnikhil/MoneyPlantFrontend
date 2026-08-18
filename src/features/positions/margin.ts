import type { AccountMargin, InstrumentRiskRow } from "@/types/api";
import { groupKey } from "./grouping";

/**
 * Capital tied up, rolled up from per-contract margin onto the positions table's
 * broker → underlying groups.
 *
 * **What summing these figures does and does not give you.** Since 17 Aug 2026
 * the backend computes margin bottom-up: exchange SPAN scanned once across each
 * `(account, underlying, expiry)` group, then divided among that group's legs,
 * plus exposure charged leg by leg. So the hedge benefit is already taken inside
 * a group, and adding a group's CE and PE legs back together recovers exactly the
 * figure the engine computed for it — safe, and the reason this roll-up is by
 * `(connection, underlying)`, the same shape the engine groups by.
 *
 * **It does not foot to the broker's bill, and must not be presented as if it
 * did.** The old allocator divided the account's real `used`, which guaranteed
 * footing at the cost of every row moving when any other row changed. The
 * estimate ran 8.6% over the bill on a real Zerodha account. The account's own
 * `used` is shown beside these subtotals, unaltered, and the gap between them is
 * information rather than an error to reconcile.
 *
 * The only runtime import is `groupKey`, from a module whose own imports are
 * type-only, so this file still compiles and runs standalone under node — the
 * technique `features/dashboard/aggregate.ts` uses, since the frontend has no
 * test runner.
 */

/**
 * Where a rolled-up margin figure came from.
 *
 * `MIXED` has no per-contract equivalent: it means the group's legs were priced
 * by different methods — some by the broker's own calculator, some by our
 * worst-loss split — so the subtotal cannot claim either provenance alone.
 */
export type MarginProvenance = "BROKER_MODEL" | "ESTIMATED" | "MIXED";

export interface GroupMargin {
  /** Sum over the legs that had a basis. Never includes an unpriced leg as zero. */
  used: number;
  provenance: MarginProvenance;
  /**
   * How many of the group's legs had no basis at all.
   *
   * Non-zero means `used` is a floor, not the group's real charge, and the UI
   * has to say so — three unpriced legs would otherwise leave a confident
   * looking number that describes only the fourth.
   */
  unattributed: number;
  /** Legs that contributed to `used`. Zero means there is nothing to show. */
  attributed: number;
}

/**
 * The key `grouping.ts` builds, rederived from a risk row.
 *
 * A risk row carries the same `underlying`/`symbol` pair with the same meaning,
 * so the shared helper produces the same string for the same contract — which is
 * the whole reason the helper is shared rather than the expression repeated.
 */
function keyOf(row: InstrumentRiskRow): string {
  return groupKey(row.connectionId, row.underlying, row.symbol);
}

/**
 * Per-contract margin rolled up per `(connection, underlying)`.
 *
 * Keyed identically to `UnderlyingGroup.key`, so the positions table can look a
 * group up directly. A group the risk report doesn't know is simply absent —
 * callers must render that as "no figure", never as zero.
 */
export function marginByGroup(
  rows: InstrumentRiskRow[]
): Map<string, GroupMargin> {
  const out = new Map<string, GroupMargin>();

  for (const row of rows) {
    const key = keyOf(row);
    const entry: GroupMargin = out.get(key) ?? {
      used: 0,
      provenance: "ESTIMATED",
      unattributed: 0,
      attributed: 0,
    };

    // UNAVAILABLE is a gap, not a zero charge, so it is counted rather than
    // added. `marginUsed` is checked independently: the basis and the amount are
    // separate fields and a null amount under any basis is still no figure.
    if (row.marginBasis === "UNAVAILABLE" || row.marginUsed === null) {
      entry.unattributed += 1;
    } else {
      // The first priced leg sets the provenance; a later leg priced differently
      // makes the subtotal MIXED and it stays that way.
      if (entry.attributed === 0) entry.provenance = row.marginBasis;
      else if (entry.provenance !== row.marginBasis) entry.provenance = "MIXED";

      entry.used += row.marginUsed;
      entry.attributed += 1;
    }

    out.set(key, entry);
  }

  return out;
}

/**
 * Each account's real margin bill, keyed on connectionId.
 *
 * Not an allocation — this is what the broker charges, and it is what every
 * group subtotal under that broker adds up to. Keyed on connectionId and never
 * on brokerId: two Kite accounts are two separate bills, and folding them would
 * make each account's groups foot to the wrong total.
 */
export function marginByConnection(
  accounts: AccountMargin[]
): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of accounts) out.set(a.connectionId, a.used);
  return out;
}
