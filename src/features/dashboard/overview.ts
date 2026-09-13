import type { Holding, Position } from "@/types/api";

/** Same used / (available + used) convention as the existing dashboard totals.
 * Zero/negative funding cannot yield a meaningful utilisation percentage. */
export function capitalUtilisation(available: number, used: number): number | null {
  const total = available + used;
  return Number.isFinite(available) && Number.isFinite(used) && total > 0 && used >= 0
    ? used / total * 100 : null;
}

export function previewGroups<T extends Position | Holding>(items: T[]) {
  const groups = new Map<string, { connectionId: string; brokerId: string; items: T[]; pnl: number }>();
  for (const item of items) {
    let group = groups.get(item.connectionId);
    if (!group) {
      group = { connectionId: item.connectionId, brokerId: item.broker, items: [], pnl: 0 };
      groups.set(item.connectionId, group);
    }
    group.items.push(item);
    group.pnl += item.pnl;
  }
  return [...groups.values()].sort((a, b) => a.connectionId.localeCompare(b.connectionId));
}
