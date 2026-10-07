import { brokerLabel } from "@/components/BrokerBadge";
import { formatINRWhole } from "@/lib/format";
import { cn } from "@/lib/utils";
import { accountLabel, needsAccountLabel, type BrokerRow } from "./aggregate";
import { MARGIN_PRESSURE_PCT, tightestAccount } from "./attention";
import { UtilisationBar } from "./OverviewFigures";

/**
 * The strip's capital cell (OVERVIEW-REDESIGN.md OV-2): the combined utilisation, and under it the
 * account using the largest share of its own capital. Capital is held per account, so "27% used"
 * overall can hide one account close to a margin call; the tightest line is what makes the
 * combined figure safe to read. Amber only from the attention threshold up.
 */
export function CapitalSummary({ rows, utilisation, partial }: {
  rows: BrokerRow[];
  utilisation: number | null;
  partial: boolean;
}) {
  const tight = tightestAccount(rows);
  const hot = !!tight && tight.pct >= MARGIN_PRESSURE_PCT;
  const name = tight && `${brokerLabel(tight.brokerId)}${needsAccountLabel(rows, tight.brokerId) ? ` ${accountLabel(tight.connectionId)}` : ""}`;
  return <>
    <div className="mb-1 text-base text-muted-foreground">
      Capital{partial && utilisation !== null && <span className="ml-1 text-orange-300" aria-label="Partial capital total">*</span>}
    </div>
    <UtilisationBar percent={utilisation} large />
    {tight && <p className={cn("overview-tight", hot && "overview-tight-hot")}
      title="Capital is held separately in each account; this is the account using the largest share of its own.">
      {hot ? "▲ " : ""}Tightest: {name} {tight.pct.toFixed(0)}% · {formatINRWhole(tight.free)} available
    </p>}
  </>;
}
