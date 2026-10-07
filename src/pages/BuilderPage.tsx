import { useNavigate } from "react-router-dom";
import { StrategyBuilderView } from "@/features/strategy-builder/StrategyBuilderView";
import type { PayoffResponse } from "@/types/api";

/**
 * The strategy builder as its own page. Rendered by AppShell, not by the route, so it stays mounted
 * (and keeps its drafts) while the user is on other pages; `active` pauses its live queries then.
 */
export function BuilderPage({ prefill, active }: { prefill: PayoffResponse | null; active: boolean }) {
  const navigate = useNavigate();
  return <div className="payoff-page">
    <h1 className="sr-only">Strategy builder</h1>
    <div className="payoff-toolbar builder-page-bar">
      <span className="font-semibold">Build &amp; test strategy</span>
      <span className="text-sm text-muted-foreground">Hypothetical · no orders are placed</span>
    </div>
    <StrategyBuilderView initialBaseline={prefill} active={active} onBackToLive={() => navigate("/app/payoff")} />
  </div>;
}

/** The route element for /app/builder. The page itself is mounted by AppShell. */
export function BuilderRoute() {
  return null;
}
