import {
  LayoutDashboard,
  Layers,
  Wallet,
  LineChart,
  ListTree,
  BellRing,
  KeyRound,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  soon?: boolean;
  /** end=true matches the route exactly (used for the index /app route). */
  end?: boolean;
}

export const navItems: NavItem[] = [
  { label: "Dashboard", to: "/app", icon: LayoutDashboard, end: true },
  { label: "Positions", to: "/app/positions", icon: Layers },
  { label: "Holdings", to: "/app/holdings", icon: Wallet },
  { label: "Option Payoff", to: "/app/payoff", icon: LineChart },
  { label: "Option Chain", to: "/app/option-chain", icon: ListTree, soon: true },
  { label: "Alerts", to: "/app/alerts", icon: BellRing, soon: true },
  // Last, and after the "soon" placeholders on purpose: it is set up once and
  // then rarely revisited, unlike everything above it.
  { label: "Broker credentials", to: "/app/settings", icon: KeyRound },
];
