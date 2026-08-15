import { Info } from "lucide-react";
import { brokerLabel } from "@/components/BrokerBadge";
import { formatINRWhole, formatNumber, pnlColor } from "@/lib/format";
import type { ScenarioGroup, ScenarioMarker } from "@/types/api";

/** "-10%", "+1σ", "spot". */
function markerLabel(m: ScenarioMarker) {
  if (m.scale === 0) return "spot";
  const sign = m.scale > 0 ? "+" : "";
  return m.kind === "PERCENT" ? `${sign}${m.scale}%` : `${sign}${m.scale}σ`;
}

function Ladder({ group }: { group: ScenarioGroup }) {
  const worst = Math.min(...group.markers.map((m) => m.pnl));

  return (
    <div className="rounded border">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/30 px-3 py-2">
        <div>
          <span className="font-medium">{group.underlyingLabel}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            {group.expiry} · {brokerLabel(group.brokerId)} · {group.rows.length}{" "}
            {group.rows.length === 1 ? "leg" : "legs"}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          spot <span className="tnum text-foreground">{formatNumber(group.spot)}</span>
          {group.iv > 0 && (
            <>
              {" · "}IV{" "}
              <span className="tnum text-foreground">
                {(group.iv * 100).toFixed(1)}%
              </span>
              {/*
                Which strike answered. Load-bearing: the surface is a smile, so a
                vol from an OTM leg is a real number about the wrong strike and
                the band it draws is too wide. The reader cannot judge the band
                without this.
              */}
              <span className="ml-1">from {group.ivSource}</span>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-normal">Move</th>
              {group.markers.map((m, i) => (
                <th
                  key={i}
                  className={`px-3 py-1.5 text-right font-normal ${
                    m.scale === 0 ? "text-foreground" : ""
                  }`}
                >
                  {markerLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="px-3 py-1.5 text-muted-foreground">Spot</td>
              {group.markers.map((m, i) => (
                <td key={i} className="tnum px-3 py-1.5 text-right text-muted-foreground">
                  {formatNumber(m.spot)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium">P&amp;L at expiry</td>
              {group.markers.map((m, i) => (
                <td
                  key={i}
                  className={`tnum px-3 py-2 text-right font-semibold ${pnlColor(m.pnl)} ${
                    m.pnl === worst ? "bg-destructive/10" : ""
                  }`}
                >
                  {formatINRWhole(m.pnl)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ScenarioLadders({ groups }: { groups: ScenarioGroup[] }) {
  const anyWithoutBand = groups.some((g) => g.markers.length > 0 && g.iv === 0);
  const anyWithoutSpot = groups.some((g) => g.markers.length === 0);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <Ladder key={`${g.connectionId}|${g.underlying}|${g.expiry}`} group={g} />
      ))}

      <div className="space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
        <p className="flex items-start gap-1.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Value at expiry, not today's mark — each row is one expiry, so legs
            with different expiries never share a ladder. σ is{" "}
            <span className="tnum">spot × IV × √(T/365)</span>, with IV solved
            from the nearest-the-money leg you actually hold.
          </span>
        </p>
        {anyWithoutBand && (
          <p>
            Some groups show only percentage moves: no leg was close enough to the
            money to solve a volatility from. Far out-of-the-money prices barely
            move with volatility, so a band drawn from one would be guesswork.
          </p>
        )}
        {anyWithoutSpot && (
          <p>
            Some groups show no moves at all: no broker could quote a spot for
            that underlying.
          </p>
        )}
      </div>
    </div>
  );
}
