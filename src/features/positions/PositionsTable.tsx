import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brokerLabel } from "@/components/BrokerBadge";
import { MarginFigure } from "@/components/MarginFigure";
import { PremiumFigure } from "@/components/PremiumFigure";
import { accountLabel } from "@/features/dashboard/aggregate";
import type { Position } from "@/types/api";
import {
  groupPositions,
  premiumLeft,
  type BrokerGroup,
  type OptionRight,
  type RightGroup,
  type UnderlyingGroup,
} from "./grouping";
import type { GroupMargin } from "./margin";
import {
  formatINR,
  formatSignedINR,
  formatSignedINRWhole,
  formatNumber,
  pnlColor,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/** Two brokers can hold the same symbol, so the connection must be part of the key. */
function rowKey(p: Position) {
  return `${p.connectionId}-${p.symbol}-${p.product}`;
}

const COLUMNS = 8;
/** Symbol…LTP, i.e. everything left of the three columns a group subtotals. */
const LABEL_SPAN = COLUMNS - 3;

/** The API's own vocabulary — an options trader reads CE/PE faster than "calls". */
const RIGHT_LABEL: Record<OptionRight, string> = {
  CE: "CE",
  PE: "PE",
  FUT: "FUT",
  EQ: "EQ",
  OTHER: "Unresolved",
};

/*
 * No sticky column header, deliberately.
 *
 * shadcn's `Table` wraps the `<table>` in `<div class="relative w-full
 * overflow-auto">`, and an `overflow` other than `visible` makes that div the
 * sticky containing block. `top-16` therefore offsets 64px from the *wrapper*
 * rather than the viewport, dropping the header onto the first broker band and
 * clipping it — measured, not theorised. Making it work would mean changing a
 * shared UI primitive that every other table relies on for horizontal scroll.
 *
 * It buys little anyway now that groups are collapsed by default: the table
 * opens roughly one line per underlying.
 */

export interface PositionsTableProps {
  positions: Position[];
  /**
   * Allocated margin per `(connection, underlying)`, keyed like
   * `UnderlyingGroup.key`. A missing key renders a dash — the risk report simply
   * does not know that group, which is not the same as a zero charge.
   */
  groupMargin?: Map<string, GroupMargin>;
  /** Each account's real margin bill, keyed on connectionId. */
  connectionMargin?: Map<string, number>;
}

/** P&L and day change, side by side. Used in both group headers and totals. */
function Money({ pnl, dayChange }: { pnl: number; dayChange: number }) {
  return (
    <>
      <span className={cn("tnum font-medium", pnlColor(pnl))}>{formatSignedINR(pnl)}</span>
      <span className={cn("tnum text-xs", pnlColor(dayChange))}>
        {formatSignedINR(dayChange)} today
      </span>
    </>
  );
}

/**
 * One contract.
 *
 * `indent` is a prop rather than a constant because a leg sits one step deeper
 * when its group was split into CE and PE tiers than when it hangs directly off
 * the underlying.
 */
function LegRow({ p, indent }: { p: Position; indent: string }) {
  return (
    <TableRow>
      <TableCell className={cn("font-medium text-muted-foreground", indent)}>
        {p.symbol}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {p.product}
        </Badge>
      </TableCell>
      <TableCell className="tnum text-right">{formatNumber(p.qty)}</TableCell>
      <TableCell className="tnum text-right">{formatINR(p.avgPrice)}</TableCell>
      <TableCell className="tnum text-right">{formatINR(p.ltp)}</TableCell>
      {/*
        Premium IS shown per leg, unlike margin. It is exact here — qty × LTP off
        this very row, which the reader can check against the two cells to the
        left — where a per-leg margin would be the least trustworthy slice of an
        allocation. No `of …` line: the avg price is already two columns away.
      */}
      <TableCell className="text-right text-sm">
        <PremiumFigure premiumLeft={premiumLeft(p)} />
      </TableCell>
      {/*
        Margin is deliberately blank per leg. Every figure is an allocation, and
        it is least trustworthy at the leg — the subtotal above is the number
        worth reading, so nothing competes with it here.
      */}
      <TableCell />
      <TableCell className="text-right">
        <div className="flex flex-col items-end leading-tight">
          <Money pnl={p.pnl} dayChange={p.dayChange} />
        </div>
      </TableCell>
    </TableRow>
  );
}

/** The CE / PE tier and its legs. Rendered only when a group holds more than one right. */
function RightRows({ right }: { right: RightGroup }) {
  return (
    <>
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={LABEL_SPAN} className="py-1.5 pl-9">
          <span
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            title={
              right.right === "OTHER"
                ? "The contract master could not resolve these symbols, so their right is unknown. They are kept in their own bucket rather than being counted as calls or puts."
                : undefined
            }
          >
            {RIGHT_LABEL[right.right]}
          </span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {right.positions.length} leg{right.positions.length === 1 ? "" : "s"}
          </span>
        </TableCell>
        <TableCell className="py-1.5 text-right text-sm">
          <PremiumFigure
            premiumLeft={right.premiumLeft}
            atEntry={right.premiumAtEntry}
          />
        </TableCell>
        {/* Margin is not split by right: the allocation divides a bill per
            contract, and re-splitting it CE/PE would be inventing a number. */}
        <TableCell />
        <TableCell className="py-1.5 text-right">
          <div className="flex flex-col items-end leading-tight">
            <Money pnl={right.pnl} dayChange={right.dayChange} />
          </div>
        </TableCell>
      </TableRow>

      {right.positions.map((p) => (
        <LegRow key={rowKey(p)} p={p} indent="pl-12" />
      ))}
    </>
  );
}

function UnderlyingRows({
  group,
  margin,
  expanded,
  onToggle,
}: {
  group: UnderlyingGroup;
  margin: GroupMargin | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  const attributed = margin && margin.attributed > 0 ? margin.used : null;
  // A single-right group gets no tier: a sub-header that separates nothing is a
  // row that costs scrolling and says nothing.
  const splitByRight = group.rights.length > 1;

  return (
    <>
      <TableRow
        className={cn(
          "border-l-2 border-l-primary/40 bg-muted/30 hover:bg-muted/50",
          expanded && "border-l-primary"
        )}
      >
        <TableCell colSpan={LABEL_SPAN} className="py-2.5">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1.5 text-sm font-medium"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {group.label}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {group.positions.length} leg{group.positions.length === 1 ? "" : "s"}
            </span>
          </button>
        </TableCell>
        <TableCell className="py-2.5 text-right text-sm">
          <PremiumFigure
            premiumLeft={group.premiumLeft}
            atEntry={group.premiumAtEntry}
            marginUsed={attributed}
          />
        </TableCell>
        <TableCell className="py-2.5 text-right text-sm">
          <MarginFigure
            amount={attributed}
            provenance={margin?.provenance ?? "ESTIMATED"}
            unattributed={margin?.unattributed ?? 0}
          />
        </TableCell>
        <TableCell className="py-2.5 text-right">
          <div className="flex flex-col items-end leading-tight">
            <Money pnl={group.pnl} dayChange={group.dayChange} />
          </div>
        </TableCell>
      </TableRow>

      {expanded &&
        (splitByRight
          ? group.rights.map((r) => <RightRows key={r.key} right={r} />)
          : group.positions.map((p) => (
              <LegRow key={rowKey(p)} p={p} indent="pl-9" />
            )))}
    </>
  );
}

export function PositionsTable({
  positions,
  groupMargin,
  connectionMargin,
}: PositionsTableProps) {
  const brokers = useMemo(() => groupPositions(positions), [positions]);

  // A single broker needs no broker header — it would be a heading over the
  // entire table. Same rule the payoff selector uses.
  const showBrokerLevel = brokers.length > 1;

  // Only label the account when this broker holds more than one, so a
  // single-account setup is not cluttered with a label distinguishing nothing.
  const multiAccount = useMemo(() => {
    const count = new Map<string, number>();
    for (const b of brokers) count.set(b.brokerId, (count.get(b.brokerId) ?? 0) + 1);
    return new Set([...count].filter(([, n]) => n > 1).map(([id]) => id));
  }, [brokers]);

  const allKeys = useMemo(
    () => brokers.flatMap((b) => b.groups.map((g) => g.key)),
    [brokers]
  );

  // Collapsed by default, so the table opens as one scannable line per
  // underlying rather than every leg at once. Not when there is a single group,
  // though — collapsing the only thing on the page just hides the table.
  const collapseByDefault = allKeys.length > 1;

  // Null means "untouched, use the default". Once the user expands or collapses
  // anything the explicit set governs, so their choice survives the 30s refetch.
  // In-memory only: persisting it would need a preference store, which is not
  // worth it for a fold.
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const isExpanded = (key: string) =>
    expanded ? expanded.has(key) : !collapseByDefault;

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev ?? (collapseByDefault ? [] : allKeys));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const anyExpanded = allKeys.some(isExpanded);
  const toggleAll = () => setExpanded(anyExpanded ? new Set() : new Set(allKeys));

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          {allKeys.length} underlying{allKeys.length === 1 ? "" : "s"}
          {showBrokerLevel && ` across ${brokers.length} accounts`}
        </span>
        {allKeys.length > 1 && (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={toggleAll}>
            {anyExpanded ? (
              <ChevronsDownUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5" />
            )}
            {anyExpanded ? "Collapse all" : "Expand all"}
          </Button>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Symbol</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Avg price</TableHead>
              <TableHead className="text-right">LTP</TableHead>
              <TableHead className="text-right">Premium left</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="text-right">P&amp;L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brokers.map((b: BrokerGroup) => (
              <Fragment key={b.key}>
                {showBrokerLevel && (
                  <TableRow className="border-t-2 bg-muted/60 hover:bg-muted/60">
                    <TableCell colSpan={LABEL_SPAN} className="py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wide">
                        {brokerLabel(b.brokerId)}
                      </span>
                      {multiAccount.has(b.brokerId) && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {accountLabel(b.connectionId)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-right text-sm">
                      <PremiumFigure
                        premiumLeft={b.premiumLeft}
                        atEntry={b.premiumAtEntry}
                        marginUsed={connectionMargin?.get(b.connectionId) ?? null}
                      />
                    </TableCell>
                    {/*
                      The account's real bill, not an allocation — and every
                      underlying subtotal beneath it is a share of exactly this
                      number, which is what makes the column foot.
                    */}
                    <TableCell className="py-2.5 text-right text-sm">
                      <MarginFigure
                        amount={connectionMargin?.get(b.connectionId) ?? null}
                        provenance="BROKER_MODEL"
                        emptyTitle="No margin reported for this account."
                      />
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <div className="flex flex-col items-end leading-tight">
                        <Money pnl={b.pnl} dayChange={b.dayChange} />
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {b.groups.map((g) => (
                  <UnderlyingRows
                    key={g.key}
                    group={g}
                    margin={groupMargin?.get(g.key)}
                    expanded={isExpanded(g.key)}
                    onToggle={() => toggle(g.key)}
                  />
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list — same grouping, no table semantics */}
      <div className="md:hidden">
        {brokers.map((b) => (
          <div key={b.key}>
            {showBrokerLevel && (
              <div className="flex items-baseline justify-between border-t bg-muted/60 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {brokerLabel(b.brokerId)}
                  {multiAccount.has(b.brokerId) && (
                    <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
                      {accountLabel(b.connectionId)}
                    </span>
                  )}
                </span>
                <span className={cn("tnum text-sm font-medium", pnlColor(b.pnl))}>
                  {formatSignedINR(b.pnl)}
                </span>
              </div>
            )}

            {b.groups.map((g) => {
              const open = isExpanded(g.key);
              const margin = groupMargin?.get(g.key);
              const attributed = margin && margin.attributed > 0 ? margin.used : null;
              return (
                <div key={g.key}>
                  <button
                    type="button"
                    onClick={() => toggle(g.key)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between border-t border-l-2 border-l-primary/40 bg-muted/20 px-4 py-2 text-left"
                  >
                    <span className="flex flex-col items-start leading-tight">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {open ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {g.label}
                      </span>
                      <span className="ml-5 text-xs text-muted-foreground">
                        Margin{" "}
                        <MarginFigure
                          amount={attributed}
                          provenance={margin?.provenance ?? "ESTIMATED"}
                          unattributed={margin?.unattributed ?? 0}
                        />
                      </span>
                      {/*
                        One line rather than nested cards: the phone layout has no
                        columns to line a tier up against, so the CE/PE split rides
                        inline where it can still be compared at a glance.
                      */}
                      {g.rights.length > 1 && (
                        <span className="tnum ml-5 text-xs text-muted-foreground">
                          {g.rights
                            .map(
                              (r) =>
                                `${RIGHT_LABEL[r.right]} ${formatSignedINRWhole(r.premiumLeft)}`
                            )
                            .join(" · ")}
                        </span>
                      )}
                    </span>
                    <span className="flex flex-col items-end leading-tight">
                      <PremiumFigure premiumLeft={g.premiumLeft} marginUsed={attributed} />
                      <Money pnl={g.pnl} dayChange={g.dayChange} />
                    </span>
                  </button>

                  {open &&
                    g.positions.map((p) => (
                      <div key={rowKey(p)} className="border-t p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.symbol}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="font-normal">
                                {p.product}
                              </Badge>
                              <span className="tnum">Qty {formatNumber(p.qty)}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end text-right leading-tight">
                            <Money pnl={p.pnl} dayChange={p.dayChange} />
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <span className="text-muted-foreground">Avg price</span>
                          <span className="tnum text-right">{formatINR(p.avgPrice)}</span>
                          <span className="text-muted-foreground">LTP</span>
                          <span className="tnum text-right">{formatINR(p.ltp)}</span>
                          <span className="text-muted-foreground">Premium left</span>
                          <span className="tnum text-right">
                            {formatSignedINRWhole(premiumLeft(p))}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
