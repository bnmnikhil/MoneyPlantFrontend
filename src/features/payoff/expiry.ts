export function expiryLabel(expiry: string) {
  return new Date(`${expiry}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
