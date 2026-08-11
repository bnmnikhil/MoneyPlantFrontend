# 0024 — Features do not import each other, and `lib/api.ts` is the only fetch layer

Status: accepted
Date: 2026-08-11

## Context

Three conventions already hold in this codebase and are enforced by nothing:

- `features/<a>/` does not import from `features/<b>/`;
- `pages/*.tsx` compose feature components and hooks, without fetching or
  business logic;
- `lib/api.ts` is the only place `fetch()` is called.

The third is load-bearing in a way the others are not. `lib/api.ts` maps **401 →
redirect to `/login`** and **409 + a broker error body → the
`moneyplant:broker-session-lost` window event** that drives the reconnect banner.
A `fetch()` written anywhere else silently opts out of both: a dead broker token
would produce a component-level error instead of the reconnect prompt, and — worse
— an unhandled 401 would leave the user staring at a broken page rather than
being sent to sign in.

There is a live example of how narrow that path already is. A dead Alice Blue
token returns a plain-text `401`, and because `lib/api.ts` maps *any* 401 to a
logout redirect, the backend gateway must never let that status escape. One
broker's expired token would otherwise log the user out of MoneyPlant entirely.
That interaction is only reviewable while every request goes through one file.

Conventions that hold by habit stop holding when the codebase doubles, and the
first violation is invisible in review because it looks like ordinary code.

## Decision

All three become lint rules.

| Rule | Enforcement |
|---|---|
| `features/<a>/` may not import from `features/<b>/`. Shared code moves to `lib/` or `components/` | import restriction, per-feature |
| `pages/*.tsx` compose only — no fetching, no business logic | no `fetch`, no direct `lib/api` calls in `pages/` |
| `lib/api.ts` is the only place `fetch()` is called | `no-restricted-globals` on `fetch`, with `lib/api.ts` exempt |
| `src/types/api.ts` is generated and read-only | see [0022](0022-api-types-are-generated.md) |

## Consequences

**Easy.** The 401 and 409 handling stays genuinely universal, which is what makes
the reconnect banner reliable. Features stay independently deletable. The rules
cost nothing to adopt because the code already satisfies them.

**Hard.** Genuinely shared feature code has to move to `lib/` or `components/`
rather than being imported across the boundary — an occasional extra step, and
the point of the rule. Escaping the fetch restriction for a real reason means an
explicit `eslint-disable` with a comment, which is the visible-in-review outcome
being aimed for.

**Foreclosed.** Adding a data-fetching library that calls `fetch` directly from
components. TanStack Query is fine because it calls the `lib/api.ts` functions;
anything wanting its own transport would have to route through the same file.

**Related, not enforced here.** Route-level code splitting and the persisted
query cache are performance measures from the same decision set, not boundaries —
they belong in the code rather than in a lint rule. `recharts` is the heaviest
dependency in the bundle and is used on exactly one route.
