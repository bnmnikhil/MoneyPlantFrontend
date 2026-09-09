export interface HoldingView {
  availableQty: number;
  avgCost: number;
  includedQty: number;
  warning: string | null;
}

/** A displayed curve and its holding details must describe the same response. */
export function holdingView(included: boolean, base?: HoldingView, combined?: HoldingView) {
  return included && combined ? combined : base;
}
