# 0023 — Ship a static SPA; no SSR

Status: accepted
Date: 2026-08-11

## Context

The frontend is a Vite SPA served by Caddy from `/var/www/moneyplant`, alongside
a JVM and a Postgres on a single OCI always-free VM. Memory is the binding
constraint, not CPU.

This has never been written down as a decision, which makes it vulnerable to the
ordinary drift of someone proposing Next.js on general enthusiasm — SSR is the
default in most current React advice, and "we should probably server-render"
sounds like an improvement rather than a cost.

It is a cost here specifically. The pages behind `AuthGuard` are all
user-specific, authenticated, and mostly show data that
[tradestack ADR 0016](../../../tradestack/docs/adr/0016-snapshot-first-reads.md)
is already making fast on the server side. There is no SEO surface to win: the
only public pages are the landing and login screens.

## Decision

The frontend is a **static SPA**. Caddy serves immutable hashed assets from disk.
There is no server-side rendering runtime and no Node process in production.

## Consequences

**Easy.** Serving costs effectively nothing — no runtime, no process to
supervise, no memory taken from the JVM or Postgres. Deploys are a file copy.
Assets are immutable and cacheable forever.

**Hard.** First paint waits for the JS bundle. That is what route-level code
splitting and the persisted query cache in
[0024](0024-feature-isolation-and-one-fetch-layer.md) are for — a returning user
sees their last book before any network call, which is the client-side twin of
snapshot-first reads.

No SEO for anything behind the login, which is everything that matters, and no
meaningful SEO for the landing page. Accepted: this is an invite-only product.

**Foreclosed.** Next.js, Remix, and any framework whose value is server
rendering. Adopting one later is a re-platform, not an upgrade — which is
precisely why this is written down.
