/**
 * The brokers the public landing page names, and the only place it names them.
 *
 * Every other line of landing copy is written so that it stays true when a
 * broker is added, so adding one is a single line here, made in the same PR
 * that switches the broker on in production (`GB_ROLLOUT_<BROKER>=available`).
 * Names match `BrokerCatalog`'s display names. Alphabetical, so the order
 * implies no ranking.
 *
 * Temporary by design: the landing page cannot read the backend catalogue yet,
 * because `/api/brokers` needs a signed-in user. When a public read of the
 * available brokers exists, this list goes.
 */
export const supportedBrokers: readonly string[] = [
  "Alice Blue",
  "Dhan",
  "Paytm Money",
  "Upstox",
  "Zerodha Kite",
];
