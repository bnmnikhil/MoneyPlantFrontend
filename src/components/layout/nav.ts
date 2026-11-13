import {
  LayoutDashboard,
  Layers,
  Wallet,
  LineChart,
  ListTree,
  BellRing,
  KeyRound,
  Wrench,
  FileSearch,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  soon?: boolean;
  /** end=true matches the route exactly (used for the index /app route). */
  end?: boolean;
  /** Other path prefixes that light the tab up: the stock pages belong to Research. */
  alsoActive?: string[];
  /** Shown only to accounts the Research endpoints admit (owner-only until AN-02 is settled). */
  research?: boolean;
}

export const navItems: NavItem[] = [
  { label: "Overview", to: "/app", icon: LayoutDashboard, end: true },
  { label: "Positions", to: "/app/positions", icon: Layers },
  { label: "Holdings", to: "/app/holdings", icon: Wallet },
  { label: "Payoff", to: "/app/payoff", icon: LineChart },
  { label: "Builder", to: "/app/builder", icon: Wrench },
  { label: "Research", to: "/app/research", icon: FileSearch, alsoActive: ["/app/stocks/"], research: true },
  { label: "Option Chain", to: "/app/option-chain", icon: ListTree, soon: true },
  { label: "Alerts", to: "/app/alerts", icon: BellRing, soon: true },
  // Last, and after the "soon" placeholders on purpose: it is set up once and
  // then rarely revisited, unlike everything above it.
  { label: "Broker credentials", to: "/app/settings", icon: KeyRound },
];

export const primaryNavItems = navItems.filter(
  (item) => !item.soon && item.to !== "/app/settings"
);

/** The tabs this account sees: Research only where the Research endpoints answer. */
export function visibleNavItems(items: NavItem[], researchAvailable: boolean): NavItem[] {
  return items.filter((item) => !item.research || researchAvailable);
}

/** True when the path belongs to the tab through `alsoActive`; NavLink handles `to` itself. */
export function alsoActive(item: NavItem, pathname: string): boolean {
  return (item.alsoActive ?? []).some((prefix) => pathname.startsWith(prefix));
}
