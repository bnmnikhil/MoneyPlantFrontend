import { StrategyBuilderView } from "@/features/strategy-builder/StrategyBuilderView";
import type { PayoffResponse } from "@/types/api";

/**
 * The strategy builder as its own page. Rendered by AppShell, not by the route, so it stays mounted
 * (and keeps its drafts) while the user is on other pages; `active` pauses its live queries then.
 */
export function BuilderPage({ prefill, active }: { prefill: PayoffResponse | null; active: boolean }) {
  return <div className="payoff-page page-fit">
    <h1 className="sr-only">Strategy builder</h1>
    <StrategyBuilderView initialBaseline={prefill} active={active} />
  </div>;
}

/** The route element for /app/builder. The page itself is mounted by AppShell. */
export function BuilderRoute() {
  return null;
}
