# Legal copy

The public notices live in `src/pages/TermsPage.tsx` and `PrivacyPage.tsx`.
The footer and sign-in disclosure use the same distinction: broker records are
reported data; GoldenBook calculations are estimates. The pages remain drafts
while `src/features/legal/details.ts` contains operator placeholders.

The 8 October 2026 rewrite describes current limitations rather than promising
unfinished launch features. In particular:

- There is no versioned acceptance prompt (L4).
- Disconnecting or deleting a registration does not erase portfolio history.
- Account erasure is a manual request; the procedure and completion deadline
  are not verified (E3).
- Raw responses and portfolio history have no automatic retention cleanup (L14).
- Off-server routine backups are disabled (D1); manual recovery copies exist.
- Broker sessions are restored only for their creation date in India time;
  that is not a promise of midnight token deletion.
- Market prices may use a separate source; private portfolio records stay
  scoped to the user. All five broker integrations are named.

**Filled on 10 Oct 2026 by owner decision:** operator `GoldenBook` (the brand, until a legal
entity exists), contact and grievances `support@goldenbook.in`, no location (disputes go
to the courts of India), no named grievance officer, price "currently free of charge",
effective 10 October 2026, version `2026-10-10`. Revisit the operator, location and
grievance officer if a legal entity is formed. Before publishing a final notice, verify
those values. Recheck deployed
data practices, including log retention and recovery copies. Bump the effective
date and version when the final documents change materially; placeholders are
deliberately retained during drafting. The rewrite does not close any legal,
consent, deletion or backup launch item.

Legal references should be checked against the official MeitY publication and
commencement notices, rather than assuming every DPDP provision is already in
force: <https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa>.
