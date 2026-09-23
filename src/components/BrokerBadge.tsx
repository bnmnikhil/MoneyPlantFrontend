import { Badge } from "@/components/ui/badge";
import { brokerName } from "@/features/brokers/catalog";

export function brokerLabel(brokerId: string) {
  return brokerName(brokerId);
}

/**
 * True when rows come from more than one broker connection.
 *
 * Used to hide the Broker column while only Kite is connected — an extra column
 * repeating "Kite" on every row is noise, not information.
 */
export function hasMultipleSources(rows: { connectionId: string }[]) {
  return new Set(rows.map((r) => r.connectionId)).size > 1;
}

export function BrokerBadge({ brokerId }: { brokerId: string }) {
  return (
    <Badge variant="outline" className="font-normal">
      {brokerLabel(brokerId)}
    </Badge>
  );
}
