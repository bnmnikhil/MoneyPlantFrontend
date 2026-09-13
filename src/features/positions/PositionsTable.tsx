import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarginFigure } from "@/components/MarginFigure";
import { PremiumFigure } from "@/components/PremiumFigure";
import { OverviewBroker } from "@/features/dashboard/OverviewFigures";
import { accountLabel } from "@/features/dashboard/aggregate";
import type { Position } from "@/types/api";
import { groupPositions, premiumLeft, type RightGroup, type UnderlyingGroup } from "./grouping";
import type { GroupMargin } from "./margin";
import { formatINR, formatSignedINRWhole, formatNumber, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PositionsTableProps {
  positions: Position[];
  groupMargin?: Map<string, GroupMargin>;
  connectionMargin?: Map<string, number>;
  accountLabels?: Map<string, string>;
  refresh?: ReactNode;
}

const HEADERS = ["Instrument", "Product", "Qty", "Avg price", "LTP", "Premium left", "Margin", "P&L", "Day P&L"];
const price = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantity = (positions: Position[]) => positions.reduce((sum, position) => sum + position.qty, 0);
const rowKey = (p: Position) => `${p.connectionId}:${p.symbol}:${p.product}`;
const knownMargin = (margin?: GroupMargin) => margin && margin.attributed > 0 ? margin.used : null;
const rightLabel = (right: RightGroup) => right.right === "OTHER" ? "Unresolved" : right.right;

function Money({ value }: { value: number }) {
  return <span className={cn("tnum whitespace-nowrap font-medium", pnlColor(value))}>{formatSignedINRWhole(value)}</span>;
}

function FoldIcon({ open }: { open: boolean }) {
  return open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />;
}

function GroupFacts({ positions }: { positions: Position[] }) {
  return <><td title="Net signed units across these rows, not lots or exposure">{formatNumber(quantity(positions))}</td><td className="positions-dash">—</td><td className="positions-dash">—</td></>;
}

function LegRow({ p, nested }: { p: Position; nested: boolean }) {
  return <tr className="positions-leg-row">
    <td><span className={cn("positions-tree-symbol", nested && "positions-tree-deep")}>{p.symbol}</span></td>
    <td>{p.product}</td><td>{formatNumber(p.qty)}</td>
    <td>{price.format(p.avgPrice)}</td><td>{p.priceKnown ? price.format(p.ltp) : <span title="Quote unavailable">—</span>}</td>
    <td><PremiumFigure compact premiumLeft={premiumLeft(p)} /></td>
    <td className="positions-dash" title="Margin is estimated per underlying, not displayed per leg">—</td>
    <td><Money value={p.pnl} /></td><td><Money value={p.dayChange} /></td>
  </tr>;
}

function RightRows({ right }: { right: RightGroup }) {
  return <>
    <tr className="positions-right-row">
      <td colSpan={2}><span className="positions-right-label" title={right.right === "OTHER" ? "These instruments could not be resolved; their type is unknown." : undefined}>
        {rightLabel(right)} <span className="font-normal text-muted-foreground">· {right.positions.length} legs</span>
      </span></td>
      <GroupFacts positions={right.positions} />
      <td><PremiumFigure compact premiumLeft={right.premiumLeft} atEntry={right.premiumAtEntry} unpricedLegs={right.unpricedLegs} /></td>
      <td className="positions-dash" title="No separate margin estimate is available for this instrument-type subtotal">—</td>
      <td><Money value={right.pnl} /></td><td><Money value={right.dayChange} /></td>
    </tr>
    {right.positions.map((p) => <LegRow key={rowKey(p)} p={p} nested />)}
  </>;
}

function UnderlyingRows({ group, margin, open, toggle }: { group: UnderlyingGroup; margin?: GroupMargin; open: boolean; toggle: () => void }) {
  return <>
    <tr className={cn("positions-underlying-row", open && "positions-underlying-open")}>
      <td colSpan={2}>
        <button type="button" onClick={toggle} aria-expanded={open} className="positions-group-button positions-underlying-label">
          <FoldIcon open={open} />{group.label}<span className="font-normal text-muted-foreground">· {group.positions.length} legs</span>
        </button>
      </td>
      <GroupFacts positions={group.positions} />
      <td><PremiumFigure compact premiumLeft={group.premiumLeft} atEntry={group.premiumAtEntry} marginUsed={knownMargin(margin)} unpricedLegs={group.unpricedLegs} /></td>
      <td><MarginFigure amount={knownMargin(margin)} provenance={margin?.provenance ?? "ESTIMATED"} unattributed={margin?.unattributed} /></td>
      <td><Money value={group.pnl} /></td><td><Money value={group.dayChange} /></td>
    </tr>
    {open && (group.rights.length > 1 ? group.rights.map((right) => <RightRows key={right.key} right={right} />)
      : group.positions.map((p) => <LegRow key={rowKey(p)} p={p} nested={false} />))}
  </>;
}

export function PositionsTable({ positions, groupMargin, connectionMargin, accountLabels, refresh }: PositionsTableProps) {
  const brokers = useMemo(() => groupPositions(positions), [positions]);
  // This table mounts when positions arrive. Keep expansion independent of all
  // later polls: no refreshed result is allowed to overwrite the user's folds.
  const [openAccounts, setOpenAccounts] = useState(() => new Set(brokers.slice(0, 1).map((broker) => broker.key)));
  const [openGroups, setOpenGroups] = useState(() => new Set(brokers[0]?.groups.slice(0, 1).map((group) => group.key) ?? []));
  const allGroups = brokers.flatMap((broker) => broker.groups);
  const allOpen = brokers.every((broker) => openAccounts.has(broker.key)) && allGroups.every((group) => openGroups.has(group.key));
  const toggleAccount = (key: string) => setOpenAccounts((previous) => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const toggleGroup = (key: string) => setOpenGroups((previous) => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const toggleAll = () => {
    setOpenAccounts(new Set(allOpen ? [] : brokers.map((broker) => broker.key)));
    setOpenGroups(new Set(allOpen ? [] : allGroups.map((group) => group.key)));
  };
  const labelFor = (connectionId: string) => accountLabels?.get(connectionId) ?? accountLabel(connectionId);

  return <>
    <div className="positions-toolbar">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Positions</h1>
        <p className="text-sm text-muted-foreground">{allGroups.length} underlying{allGroups.length === 1 ? "" : "s"} across {brokers.length} account{brokers.length === 1 ? "" : "s"}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {refresh}
        <Button variant="ghost" size="sm" className="gap-2 border-l border-border pl-5" onClick={toggleAll}>
          {allOpen ? <ChevronsDownUp className="size-4" /> : <ChevronsUpDown className="size-4" />}
          {allOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>
    </div>

    <div className="positions-table-scroll hidden md:block" role="region" aria-label="Positions by account and underlying" tabIndex={0}>
      <table className="positions-table">
        <thead><tr>{HEADERS.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
        <tbody>{brokers.map((broker) => {
          const open = openAccounts.has(broker.key);
          const rows = broker.groups.flatMap((group) => group.positions);
          return <Fragment key={broker.key}>
            <tr className="positions-account-row">
              <td colSpan={2}><button type="button" className="positions-group-button" onClick={() => toggleAccount(broker.key)} aria-expanded={open}>
                <FoldIcon open={open} /><OverviewBroker brokerId={broker.brokerId} account={labelFor(broker.connectionId)} />
                <span className="font-normal text-muted-foreground">· {rows.length} positions</span>
              </button></td>
              <GroupFacts positions={rows} />
              <td><PremiumFigure compact premiumLeft={broker.premiumLeft} atEntry={broker.premiumAtEntry} marginUsed={connectionMargin?.get(broker.connectionId)} unpricedLegs={broker.unpricedLegs} /></td>
              <td><MarginFigure amount={connectionMargin?.get(broker.connectionId) ?? null} provenance="BROKER_MODEL" emptyTitle="No margin reported for this account." sourceTitle="The broker's reported account margin bill. Underlying estimates can differ from this amount." /></td>
              <td><Money value={broker.pnl} /></td><td><Money value={broker.dayChange} /></td>
            </tr>
            {open && broker.groups.map((group) => <UnderlyingRows key={group.key} group={group} margin={groupMargin?.get(group.key)} open={openGroups.has(group.key)} toggle={() => toggleGroup(group.key)} />)}
          </Fragment>;
        })}</tbody>
      </table>
    </div>

    <div className="positions-mobile md:hidden">
      {brokers.map((broker) => <div key={broker.key}>
        <button type="button" className="positions-mobile-account" aria-expanded={openAccounts.has(broker.key)} onClick={() => toggleAccount(broker.key)}>
          <span className="flex items-center gap-2"><FoldIcon open={openAccounts.has(broker.key)} /><OverviewBroker brokerId={broker.brokerId} account={labelFor(broker.connectionId)} /></span>
          <span className="mt-2 flex justify-between gap-3 text-sm"><span>P&amp;L <Money value={broker.pnl} /></span><span>Day <Money value={broker.dayChange} /></span></span>
        </button>
        {openAccounts.has(broker.key) && broker.groups.map((group) => {
          const open = openGroups.has(group.key);
          const margin = groupMargin?.get(group.key);
          return <div key={group.key}>
            <button type="button" onClick={() => toggleGroup(group.key)} aria-expanded={open} className="positions-mobile-group">
              <span className="flex items-center gap-2 font-medium"><FoldIcon open={open} />{group.label}<span className="text-xs text-muted-foreground">· {group.positions.length} legs</span></span>
              <span className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <span>P&amp;L <Money value={group.pnl} /></span><span>Day <Money value={group.dayChange} /></span>
                <span>Premium <PremiumFigure compact premiumLeft={group.premiumLeft} atEntry={group.premiumAtEntry} marginUsed={knownMargin(margin)} unpricedLegs={group.unpricedLegs} /></span>
                <span>Margin <MarginFigure amount={knownMargin(margin)} provenance={margin?.provenance ?? "ESTIMATED"} unattributed={margin?.unattributed} /></span>
              </span>
              {group.rights.length > 1 && <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {group.rights.map((right) => <span key={right.key}>{rightLabel(right)} <PremiumFigure compact premiumLeft={right.premiumLeft} atEntry={right.premiumAtEntry} unpricedLegs={right.unpricedLegs} /></span>)}
              </span>}
            </button>
            {open && group.positions.map((p) => <div key={rowKey(p)} className="border-t border-border px-4 py-3">
              <p className="break-words text-sm font-medium">{p.symbol}</p>
              <p className="mt-1 text-xs text-muted-foreground">{p.product} · Qty {formatNumber(p.qty)}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <dt>P&amp;L</dt><dd className="text-right"><Money value={p.pnl} /></dd>
                <dt>Day P&amp;L</dt><dd className="text-right"><Money value={p.dayChange} /></dd>
                <dt>Avg price</dt><dd className="text-right">{formatINR(p.avgPrice)}</dd>
                <dt>LTP</dt><dd className="text-right">{p.priceKnown ? formatINR(p.ltp) : "—"}</dd>
                <dt>Premium left</dt><dd className="text-right"><PremiumFigure compact premiumLeft={premiumLeft(p)} /></dd>
              </dl>
            </div>)}
          </div>;
        })}
      </div>)}
    </div>
  </>;
}
