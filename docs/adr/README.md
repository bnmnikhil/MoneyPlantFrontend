# Architecture decision records — frontend

Short Nygard-form records, one file per decision, numbered and never renumbered.

**Numbering is shared with the backend**, deliberately: there is one decision
sequence across the product, and a given number means the same decision wherever
it is cited. The files are split by which repo the decision binds.

**The backend owns the API contract.** Contract decisions live in
`tradestack/docs/adr/` and are linked from here by path. Records in this
directory cover only what is genuinely frontend-local.

## Index

| ADR | Decision | Status |
|---|---|---|
| [0022](0022-api-types-are-generated.md) | `src/types/api.ts` is generated; hand-edits rejected in CI | accepted, **not built** |
| [0023](0023-static-spa-no-ssr.md) | Static SPA, no SSR | accepted |
| [0024](0024-feature-isolation-and-one-fetch-layer.md) | Features do not import each other; `lib/api.ts` is the only fetch layer | accepted |

## Backend records worth knowing from here

| ADR | Why it matters to the frontend |
|---|---|
| [0016 — snapshot-first reads](../../../tradestack/docs/adr/0016-snapshot-first-reads.md) | Adds `asOf`, `freshness` and `refreshing` to `BrokerAggregate`. A contract-pair change: `freshness: NONE` must render a **skeleton, not an empty state** |
| [0021 — two repos, generated types](../../../tradestack/docs/adr/0021-two-repos-generated-types.md) | The backend half of 0022, and the history of the white-screen incident |
| [0018 — rounding at the DTO boundary](../../../tradestack/docs/adr/0018-double-internally-rounded-at-the-dto-boundary.md) | Numbers arrive already rounded. Do not add a second rounding pass in a formatter |

## Format

See [`tradestack/docs/adr/README.md`](../../../tradestack/docs/adr/README.md) for
the template and the threshold for writing one.
