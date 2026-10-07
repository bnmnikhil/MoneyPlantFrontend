import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { brokerLabel } from "@/components/BrokerBadge";
import { formatINRWhole, formatNumber, formatSignedINRWhole, pnlColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Position } from "@/types/api";
import { accountLabel, type BrokerRow } from "./aggregate";
import type { Attention, FixItem } from "./attention";
import { UtilisationBar } from "./OverviewFigures";

const MAX_GROUPS = 2;
const MAX_LEGS = 3;

function expiryText(expiry: string) {
  return new Date(`${expiry}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function daysText(days: number) {
  return days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`;
}

/** "NIFTY 25,800 PE", "HAL FUT", "ITC shares": the leg as a trader names it. */
function contractText(leg: Position) {
  const name = leg.underlyingLabel ?? leg.symbol;
  if (leg.instrumentType === "FUT") return `${name} FUT`;
  if (leg.instrumentType === "EQ") return `${name} shares`;
  if (leg.contract && (leg.instrumentType === "CE" || leg.instrumentType === "PE")) return `${name} ${formatNumber(leg.contract.strike)} ${leg.instrumentType}`;
  return leg.symbol;
}

function Side({ qty }: { qty: number }) {
  return <span className={cn("overview-side", qty < 0 ? "overview-side-short" : "overview-side-long")}>{qty < 0 ? "S" : "B"} {formatNumber(Math.abs(qty))}</span>;
}

function Card({ title, count, tone, children, link }: { title: string; count?: string; tone: "warn" | "info" | "plain"; children: ReactNode; link?: { to: string; label: string } }) {
  return <section className={cn("overview-att", `overview-att-${tone}`)} aria-label={title}>
    <div className="overview-att-head"><h3>{title}</h3>{count && <span className="overview-att-count">{count}</span>}</div>
    <div className="overview-att-body">{children}</div>
    {link && <Link to={link.to} className="overview-att-link">{link.label} →</Link>}
  </section>;
}

export interface AttentionBandProps {
  attention: Attention;
  rows: BrokerRow[];
  /** connectionId → the account name the broker reported. */
  accountLabels: Map<string, string>;
  /** Starts a broker connect (or reconnect). `label` is the registration to use. */
  onConnect: (brokerId: string, label?: string) => void;
  /** connectionId → the registration that authorised it, for reconnecting an expired session. */
  credentialLabels: Map<string, string>;
  connecting?: string | null;
}

/**
 * The Overview's Needs attention band (OVERVIEW-REDESIGN.md OV-4). Up to four cards, each hidden
 * when empty; when nothing needs attention it collapses to one line saying what was checked, and
 * the moves card (information, not a problem) may sit beside it.
 */
export function AttentionBand({ attention, rows, accountLabels, onConnect, credentialLabels, connecting }: AttentionBandProps) {
  const account = (connectionId: string, brokerId: string) => {
    const label = accountLabels.get(connectionId) ?? accountLabel(connectionId);
    return rows.filter((row) => row.brokerId === brokerId).length > 1 ? `${brokerLabel(brokerId)} ${label}` : brokerLabel(brokerId);
  };
  const { margin, expiring, moves, fixes, allClear, checks } = attention;
  const nextExpiry = expiring.next ? `${expiryText(expiring.next.expiry)}, ${expiring.next.legCount} leg${expiring.next.legCount === 1 ? "" : "s"}` : null;

  const cards: ReactNode[] = [];
  if (margin.length) cards.push(<Card key="margin" title="Margin pressure" tone="warn" count={`${margin.length} account${margin.length === 1 ? "" : "s"}`} link={{ to: "/app/positions", label: "Positions" }}>
    {margin.slice(0, 3).map((a) => <div key={a.connectionId} className="overview-att-item">
      <div className="overview-att-line"><span>{account(a.connectionId, a.brokerId)}</span></div>
      <UtilisationBar percent={a.pct} />
      <span className="overview-att-sub">{formatINRWhole(a.free)} available of {formatINRWhole(a.free + a.used)}</span>
    </div>)}
  </Card>);

  if (expiring.soon.length) {
    const legs = expiring.soon.reduce((n, g) => n + g.legs.length, 0);
    cards.push(<Card key="expiry" title="Expiring soon" tone="warn" count={`${legs} leg${legs === 1 ? "" : "s"}`} link={{ to: "/app/payoff", label: "Payoff" }}>
      {expiring.soon.slice(0, MAX_GROUPS).map((g) => <div key={`${g.connectionId}|${g.expiry}`} className="overview-att-item">
        <div className="overview-att-line">
          <span className="overview-days">{daysText(g.daysLeft)}</span>
          <span className="overview-att-sub">{expiryText(g.expiry)} · {account(g.connectionId, g.brokerId)}</span>
        </div>
        {g.legs.slice(0, MAX_LEGS).map((leg, i) => <div key={`${leg.symbol}-${i}`} className="overview-att-leg">
          <span><Side qty={leg.qty} />{contractText(leg)}</span>
          {leg.priceKnown ? <span className={cn("tnum", pnlColor(leg.pnl))}>{formatSignedINRWhole(leg.pnl)}</span> : <span className="text-muted-foreground">no price</span>}
        </div>)}
        {g.legs.length > MAX_LEGS && <span className="overview-att-sub">and {g.legs.length - MAX_LEGS} more</span>}
      </div>)}
      {expiring.soon.length > MAX_GROUPS && <span className="overview-att-sub">and {expiring.soon.length - MAX_GROUPS} more expir{expiring.soon.length - MAX_GROUPS === 1 ? "y" : "ies"}</span>}
      {nextExpiry && <span className="overview-att-sub">Next after that: {nextExpiry}</span>}
    </Card>);
  }

  if (moves.length) cards.push(<Card key="moves" title="Biggest moves today" tone="plain" count="Day P&L" link={{ to: "/app/positions", label: "Positions" }}>
    {moves.map((leg, i) => <div key={`${leg.connectionId}-${leg.symbol}-${i}`} className="overview-att-leg">
      <span><Side qty={leg.qty} />{contractText(leg)} <span className="overview-att-sub">{account(leg.connectionId, leg.broker)}</span></span>
      <span className={cn("tnum", pnlColor(leg.dayChange))}>{formatSignedINRWhole(leg.dayChange)}</span>
    </div>)}
  </Card>);

  if (fixes.length) cards.push(<Card key="fix" title="To fix" tone="info" count={String(fixes.length)}>
    {fixes.map((fix, i) => <FixRow key={i} fix={fix} account={account} onConnect={onConnect} credentialLabels={credentialLabels} connecting={connecting} />)}
  </Card>);

  return <section className="overview-attention" aria-labelledby="overview-attention-title">
    <h2 id="overview-attention-title" className="overview-attention-title">Needs attention</h2>
    {allClear && <div className="overview-clear" role="status">
      <CheckCircle2 className="size-5 shrink-0 text-profit" />
      <div><p className="font-medium">Nothing needs attention</p>
        <p className="overview-clear-checks">{checks.map((check, i) => <span key={check}>✓ {i === 1 && nextExpiry ? `${check} (next: ${nextExpiry})` : check}</span>)}</p></div>
    </div>}
    {cards.length > 0 && <div className="overview-att-grid">{cards}</div>}
  </section>;
}

function FixRow({ fix, account, onConnect, credentialLabels, connecting }: {
  fix: FixItem;
  account: (connectionId: string, brokerId: string) => string;
  onConnect: (brokerId: string, label?: string) => void;
  credentialLabels: Map<string, string>;
  connecting?: string | null;
}) {
  const button = (key: string, label: string, act: () => void) =>
    <button type="button" className="overview-att-button" disabled={connecting === key} onClick={act}>{connecting === key ? "Redirecting…" : label}</button>;
  switch (fix.kind) {
    case "not-connected":
      return <div className="overview-att-item">
        <div className="overview-att-line"><span>{brokerLabel(fix.brokerId)} is not connected</span>{button(fix.brokerId, "Connect", () => onConnect(fix.brokerId))}</div>
        <span className="overview-att-sub">Its positions and holdings are missing from every total.</span>
      </div>;
    case "session-expired":
      return <div className="overview-att-item">
        <div className="overview-att-line"><span>{account(fix.connectionId, fix.brokerId)} needs reconnecting</span>{button(fix.brokerId, "Reconnect", () => onConnect(fix.brokerId, credentialLabels.get(fix.connectionId)))}</div>
        <span className="overview-att-sub">The broker ended the session; its figures are missing.</span>
      </div>;
    case "load-failed":
      return <div className="overview-att-item">
        <div className="overview-att-line"><span>Couldn't load {account(fix.connectionId, fix.brokerId)}</span></div>
        <span className="overview-att-sub">Usually temporary. It retries on the next refresh.</span>
      </div>;
    case "unpriced":
      return <div className="overview-att-item">
        <div className="overview-att-line"><span>{fix.count} leg{fix.count === 1 ? " has" : "s have"} no current price</span></div>
        <span className="overview-att-sub">P&amp;L totals leave {fix.count === 1 ? "it" : "them"} out.</span>
      </div>;
    case "stale-estimates":
      return <div className="overview-att-item">
        <div className="overview-att-line"><span>Margin estimates are {fix.freshness === "STALE" ? "stale" : "from a snapshot"}</span><Link to="/app/risk" className="overview-att-link">Risk →</Link></div>
        <span className="overview-att-sub">Calculated from positions held {fix.asOf ? new Date(fix.asOf).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "at an unknown time"}. Live P&amp;L is current.</span>
      </div>;
  }
}

