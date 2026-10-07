/** Same used / (available + used) convention as the existing dashboard totals.
 * Zero/negative funding cannot yield a meaningful utilisation percentage. */
export function capitalUtilisation(available: number, used: number): number | null {
  const total = available + used;
  return Number.isFinite(available) && Number.isFinite(used) && total > 0 && used >= 0
    ? used / total * 100 : null;
}
