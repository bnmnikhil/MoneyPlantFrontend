/**
 * The facts the privacy policy and terms depend on that only the operator can
 * supply. Kept in one place so the two documents cannot disagree about them.
 *
 * A value still in [square brackets] is an unfilled placeholder: the legal pages
 * render a visible draft notice until `unfilledLegalDetails` returns nothing, so
 * an unfinished policy cannot pass for a finished one.
 */
export const legalDetails = {
  /** Shown as the operator and Data Fiduciary. A legal name, not a brand. */
  operatorName: "[Operator's full legal name]",
  /** City and state; also the seat of the courts named in the terms. */
  operatorLocation: "[City], [State], India",
  /** One monitored address for support, privacy requests and grievances. */
  contactEmail: "[support@your-domain]",
  /** The person who answers grievances under the DPDP Act. */
  grievanceOfficer: "[Grievance officer's name]",
  /** Bump both whenever a document changes materially; L4 re-prompts on a new version. */
  effectiveDate: "[DD Month 2026]",
  termsVersion: "[YYYY-MM-DD]",
  /** Plain statement of price; the terms promise notice before this changes. */
  pricing: "[MoneyPlant is currently free of charge.]",
} as const;

export type LegalDetailKey = keyof typeof legalDetails;

const PLACEHOLDER = /\[[^\]]+\]/;

export function unfilledLegalDetails(
  details: Readonly<Record<string, string>> = legalDetails,
): string[] {
  return Object.entries(details)
    .filter(([, value]) => PLACEHOLDER.test(value))
    .map(([key]) => key);
}
