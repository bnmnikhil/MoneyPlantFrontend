/**
 * Which deployment this build is for (STAGING.md ST-8).
 *
 * Decided at build time from VITE_ENVIRONMENT, never from anything the backend
 * says: /api/me is unchanged, and a production build with the variable unset
 * has no banner, no title prefix and no alternative favicon.
 */
export function isStagingEnvironment(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "staging";
}

export const STAGING_BANNER_TEXT = "STAGING: simulated brokers, no real data";
export const STAGING_TITLE_PREFIX = "[STAGING] ";
export const STAGING_FAVICON = "/favicon-staging.svg";

/** Applies the title prefix and the favicon swap. Idempotent. */
export function applyStagingChrome(doc: Document): void {
  if (!doc.title.startsWith(STAGING_TITLE_PREFIX)) doc.title = STAGING_TITLE_PREFIX + doc.title;
  doc.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute("href", STAGING_FAVICON);
}
