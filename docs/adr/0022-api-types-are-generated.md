# 0022 — `src/types/api.ts` is generated; hand-edits are rejected in CI

Status: accepted — **not yet implemented**, see Consequences
Date: 2026-08-11

## Context

`src/types/api.ts` mirrors the backend DTOs and is maintained by hand. `CLAUDE.md`
states the rule plainly — "keep the two in sync — the TS types are the contract" —
and that rule is enforced by nothing.

It failed once, expensively. A frontend built from one branch met a backend built
from another, React received an object where it expected a string, and the whole
page died with minified error #31. `npm run typecheck` cannot catch this: it
checks the frontend against its own copy of the types, which is exactly the thing
that was wrong.

The backend-side decision and the full history are in
[tradestack ADR 0021](../../../tradestack/docs/adr/0021-two-repos-generated-types.md).
This is its frontend half.

## Decision

`src/types/api.ts` is a **generated file**. It is checked in — so a clean clone
type-checks without running the backend — but it is not written by hand.

- `npm run gen:api` regenerates it from the backend's OpenAPI spec.
- CI runs the generator and fails on any diff against the checked-in file.
- The file carries a generated-file header saying so.

A contract change is therefore a backend change plus a regeneration, never a
hand-edit on this side.

## Consequences

**Easy.** Drift becomes a red build rather than a white page. Reviewing a
contract change means reading a generated diff, which is exactly the set of
fields that moved.

**Hard, and currently outstanding.** This repo has no CI at all, and `gen:api`
does not exist. The decision is recorded ahead of its enforcement, deliberately —
see the deferral note in ADR 0021. Until it is built, the hand-copy rule and the
manual `npm run typecheck` gate remain the only protection, and they are known to
be insufficient.

**Foreclosed.** Adding a field to `api.ts` that the backend does not return, as a
way of shipping a frontend feature ahead of its endpoint. That has to become a
local type in the feature that needs it, which is the honest place for it anyway.
