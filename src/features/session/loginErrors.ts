/** Bounded public messages for Spring's OIDC rejection codes. */
export function loginErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "not_invited":
      return "That Google account is not on the invite list for this instance. Ask the owner to add it.";
    case "signup_closed":
      return "New account sign-up is currently paused. Existing users can still sign in with their Google account.";
    case "account_disabled":
      return "Your GoldenBook account is disabled. Contact support for help.";
    case "email_unverified":
      return "Google did not provide a verified email address. Use a Google account with a verified email.";
    case "auth_unavailable":
      return "Sign-in is temporarily unavailable. Please try again later.";
    default:
      return "Sign-in did not complete. Please try again.";
  }
}
