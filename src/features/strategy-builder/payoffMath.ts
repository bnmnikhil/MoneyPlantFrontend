/** Expiry value for options; cash and futures move one-for-one with spot. */
export function legPnlAtSpot(leg: { type: string; strike: number; price: number; qty: number }, spot: number) {
  const value = leg.type === "CE" ? Math.max(spot - leg.strike, 0)
    : leg.type === "PE" ? Math.max(leg.strike - spot, 0) : spot;
  return (value - leg.price) * leg.qty;
}

export function quantityStep(type: string, lotSize: number) {
  return type === "EQ" ? 1 : lotSize;
}
