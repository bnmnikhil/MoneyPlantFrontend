# Broker credential setup

The Broker credentials page (`/app/settings`) manages **registrations** — a
registration is a developer app the user registered in their own name at a
broker, and it is not an account. One registration can authorise several
logins at that broker, and each of those becomes a connection.

## Layout

Three concepts, three weights, so the hierarchy in the data is the hierarchy on
screen:

- **Broker** — a group header carrying the two-letter mark, the display name, a
  registration count when there is more than one, and a link to that broker's
  developer portal.
- **Registration** — a row inside the group: its name, the last four characters
  of the stored key labelled the way the broker labels it, its accounts, and
  Connect / replace / remove. **Edit expands in place**; the row does not turn
  into a card.
- **Account** — a badge inside the row, coloured by `connection.connected`:
  green *connected*, amber *needs reconnect*, plain *no account linked yet*.

Only brokers with at least one saved registration are listed. The credentials
endpoint also returns a placeholder row per unconfigured broker; those are
filtered out and reach the user only through the Add dropdown. A row for a
broker you do not use is clutter on a page you open to manage the ones you do.

The page is capped at `max-w-5xl` and carries its own breadcrumb back to
Overview. Both are consequences of the top-nav shell: Broker credentials is not
in `primaryNavItems`, so no tab highlights while you are here and nothing else
on screen offers a way back.

## Adding

**One panel for every add.** `AddRegistrationPanel` opens inline beneath the
header button, and the broker is a `Select` *inside* the form rather than a menu
that closes before the form appears. It replaced two separate controls: a header
dropdown that spawned a draft card halfway down the page, and a per-broker "Add
another registration" button that was routinely misread as "add another trading
account".

The dropdown lists every `AVAILABLE` broker, **including ones already set up** —
picking one of those adds a second developer app, which is the same act as
adding a first one elsewhere. Choosing a broker that already has a registration
reveals a **Name this registration** field; a user's first registration anywhere
takes the backend's `default` label silently.

Inline rather than a dialog on purpose: the one case needing surrounding context
is naming a second registration, and that is exactly when the names already in
use should stay visible.

## Fields come from the catalogue

`CredentialFields` iterates `BrokerDefinition.credentialFields` — label, `secret`
and `required` all come from the backend. That is why Alice Blue's first box
reads **App code** and Kite's reads **API key** with no broker-id switch
anywhere.

This replaced `fieldByKey(definition, "apiKey" | "apiSecret")`, which threw when
either key was absent and so crashed the card for any broker the catalogue
described differently — `BrokerAuthType` already admits `ACCESS_TOKEN`. The wire
body is still exactly `{apiKey, apiSecret}`, and `toCredentialInput` in
`model.ts` is the single place the two vocabularies meet: a broker naming other
keys needs a *contract* change, and it shows up there as a missing value rather
than as a silently empty secret.

## Rules kept from the previous screen

- The secret field is **write-only**: never prefilled, never masked with dots. A
  masked value would imply the stored secret can be revealed, and it cannot.
- **Both values are always required**, even on a replace. A form accepting a
  blank secret would have to mean "keep the old one", and that ambiguity is what
  write-only storage exists to avoid.
- `LABEL_PATTERN` mirrors the backend's path-segment constraint, so a bad
  registration name fails before the request goes out.
- Saving or removing invalidates session status as well as the credential list —
  `brokers` on `/api/session/status` is derived from these rows.

## Testing

Pure logic lives in `features/credentials/model.ts` and is covered by
`tests/credential-model.test.mjs`; catalogue helpers by
`tests/broker-catalog.test.mjs`. Rendering is not covered — the project has no
component test runner, so the four states that matter (nothing configured, a
broker mid-add, a second registration at a broker that already has one, and an
account whose session has expired) need a real browser.
