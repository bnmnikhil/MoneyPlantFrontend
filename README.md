# MoneyPlant

Personal options-trading dashboard for Indian markets (NSE F&O via Zerodha Kite).
Dark, broker-terminal UI. Read-only frontend that talks to a same-origin Spring Boot backend.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS + shadcn/ui (New York style, components vendored under `src/components/ui`)
- TanStack Query v5 (all server state)
- react-router-dom v6
- lucide-react icons

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173, /api etc. proxied to :8080
npm run build      # type-check + bundle to dist/
npm run preview    # serve the production build locally
```

The dev server proxies `/api`, `/oauth2`, `/login/oauth2` and `/kite` to
`http://localhost:8080` (see `vite.config.ts`). In production `dist/` is served
by Caddy on the same origin as the backend, so no CORS handling is needed.

## Auth model

App auth (Google) and broker auth (Kite) are **separate**:

- **App session** — `GET /api/me` gates every authenticated route (`AuthGuard`).
  Any `401` from an `/api` call redirects the whole document to `/login`
  (handled centrally in `src/lib/api.ts`).
- **Broker session** — `GET /api/session/status` drives the top-bar chip.
  When the backend returns `409 {"error":"KITE_SESSION_EXPIRED"}`, the API layer
  emits a `moneyplant:kite-expired` event and the shell shows a reconnect banner
  instead of an error. Connect flow: `GET /api/session/login-url` → redirect to
  the returned `url`.

All fetches use `credentials: "include"`.

## Routes

| Path              | Access | Page                                        |
| ----------------- | ------ | ------------------------------------------- |
| `/`               | public | Landing                                     |
| `/login`          | public | Sign in (Continue with Google)              |
| `/app`            | auth   | Dashboard (connect card / summary + table)  |
| `/app/positions`  | auth   | Positions (auto-refresh 30s)                |
| `/app/holdings`   | auth   | Holdings                                    |

`Option Chain` and `Alerts` appear in the nav as disabled **Soon** placeholders.

## Project structure

```
src/
  lib/            api client (fetch wrapper), queryClient, Indian formatting, cn
  types/api.ts    backend contract types (mirror exactly — do not extend)
  components/     ui/ (shadcn), layout/ (shell, sidebar, topbar, tabbar), shared bits
  features/
    session/      me / kite hooks, AuthGuard, connect card & banner, status chip
    positions/    hooks + table
    holdings/     hooks + table
  pages/          Landing, Login, Dashboard, Positions, Holdings, NotFound
```

## API contract (fixed)

- `GET /api/me` → `{ email, name, picture }` | `401`
- `GET /api/session/status` → `{ kiteConnected }`
- `GET /api/session/login-url` → `{ url }`
- `GET /api/positions` → `Position[]`
- `GET /api/holdings` → `Holding[]`
- `GET /api/margins` → `{ available, used, total }`
- `POST /api/logout` → `204`

No other endpoints are called. Future features (Option Chain, Alerts) are UI
placeholders only.
