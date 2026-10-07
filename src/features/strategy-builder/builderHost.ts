import { createContext, useContext } from "react";
import type { PayoffResponse } from "@/types/api";

/**
 * How another page hands a live position to the strategy builder.
 *
 * The builder is its own page (/app/builder) but stays mounted in AppShell once it has been opened,
 * so draft trades survive moving between pages. Opening it with a position goes through here rather
 * than through the URL, because a payoff response is far too large for a query string.
 */
export interface BuilderHost {
  openInBuilder: (baseline: PayoffResponse) => void;
}

export const BuilderHostContext = createContext<BuilderHost>({ openInBuilder: () => {} });

export function useBuilderHost(): BuilderHost {
  return useContext(BuilderHostContext);
}
