import type { BrokerGroup } from "./grouping";
import type { GroupMargin } from "./margin";

/** Summarise the displayed book. Only matching account/underlying estimates
 * contribute: old groups in a snapshot cannot inflate today's headline. */
export function positionsSummary(brokers: BrokerGroup[], margins?: Map<string, GroupMargin>) {
  const groups = brokers.flatMap((broker) => broker.groups);
  const positions = groups.flatMap((group) => group.positions);
  const knownPremiums = brokers.flatMap((broker) => broker.premiumLeft === null ? [] : [broker.premiumLeft]);
  let marginTotal: number | null = null;
  let missingMarginLegs = 0;
  for (const group of groups) {
    const margin = margins?.get(group.key);
    if (!margin || margin.attributed === 0 || !Number.isFinite(margin.used)) {
      missingMarginLegs += group.positions.length;
      continue;
    }
    marginTotal = (marginTotal ?? 0) + margin.used;
    missingMarginLegs += margin.unattributed;
  }
  return {
    openCount: positions.filter((position) => position.qty !== 0).length,
    pnl: brokers.reduce((sum, broker) => sum + broker.pnl, 0),
    dayPnl: brokers.reduce((sum, broker) => sum + broker.dayChange, 0),
    premium: knownPremiums.length ? knownPremiums.reduce((sum, value) => sum + value, 0) : null,
    unpricedLegs: brokers.reduce((sum, broker) => sum + broker.unpricedLegs, 0),
    estimatedMargin: marginTotal,
    missingMarginLegs,
  };
}
