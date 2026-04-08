# Implementation Plan: Admin Sentry monitoring dashboard

**Branch**: `001-admin-sentry-monitor` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification + clarify session (`ReviewNavToolbar`, `isAdmin` wiring, `sentry-proxy`, secrets).

## Summary

Deliver an **admin-only** in-app view of Sentry health: **recent issues** (title, count, first/last seen), **aggregate error volume** for **24h / 7d / 30d**, **users affected**, and a **recharts** trend via **`ChartContainer`**. All Sentry credentials stay in **Supabase secrets**; the browser calls a single Edge Function **`sentry-proxy`** with the user JWT. **Non-admins** are **redirected** on the route and receive **403** from the proxy. Navigation adds a **Monitoring** link only for admins in **`ReviewNavToolbar`**.

## Technical Context

**Language/Version**: TypeScript 5.x (Vite React app), Deno (Supabase Edge Functions)  
**Primary Dependencies**: React 18, React Router v6, TanStack React Query, Tailwind, shadcn/ui, recharts, Supabase JS client  
**Storage**: N/A (read-only integration with Sentry; no new app tables required for v1)  
**Testing**: Manual QA + optional future contract tests; existing project test norm applies  
**Target Platform**: Modern browsers (dashboard desktop-first); Edge Functions (Supabase)  
**Project Type**: Web application (Vite SPA + Edge Functions)  
**Performance Goals**: Dashboard usable when Sentry responds within normal API latency (target: primary content visible &lt; 5s on healthy network)  
**Constraints**: `SENTRY_AUTH_TOKEN` never in frontend; admin enforcement on server; preserve `src/app/` + `src/pages/` routing layout  
**Scale/Scope**: Single Sentry org/project; typical issue list &lt; 100 rows per view with server-side limit  

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| Dual router constraint | **Pass** | New route added in `src/app/router.tsx`; `src/pages/` unchanged; no removal of `src/app/` shell. |
| Module boundaries | **Pass** | UI + hooks + api under `src/modules/monitoring/`; public `index.ts`; layout-only edits in `src/app/layout/`. |
| Supabase + RLS | **Pass** | No new persisted user tables in v1; authorization is JWT + admin allowlist on Edge Function (complements RLS for this read-only integration). |
| Secrets server-side | **Pass** | `SENTRY_AUTH_TOKEN`, org/project slugs + **admin allowlist** only in function secrets / env (see research.md). |
| Additive-first | **Pass** | Additive route, module, function; optional context provider; no destructive schema. |

**Post–Phase 1 re-check**: Unchanged — contracts define server-only secrets and DTO boundaries; no constitution violations introduced.

## Phase 0: Research (completed)

See [research.md](./research.md). All technical unknowns for this feature are resolved (admin gate on Edge, URL routing for proxy, client wiring).

## Phase 1: Design (completed)

- [data-model.md](./data-model.md) — DTOs / view models (not DB schema).  
- [contracts/](./contracts/) — `sentry-proxy` HTTP contract + JSON shapes.  
- [quickstart.md](./quickstart.md) — local setup, secrets, verification steps.

### Agent context

Run after plan edits: `.specify/scripts/powershell/update-agent-context.ps1 -AgentType cursor-agent`

## Project Structure

### Documentation (this feature)

```text
specs/001-admin-sentry-monitor/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── README.md
│   └── sentry-proxy.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── App.tsx                         # Wrap content with AdminProvider (or equivalent)
│   ├── router.tsx                      # Route dashboard/sentry-monitor → monitoring page
│   └── layout/
│       ├── DashboardLayout.tsx         # useAdmin(); WhatsApp isAdmin from context (optional consolidation)
│       ├── ReviewNavToolbar.tsx        # Conditional Monitoring link when isAdmin
│       └── AdminContext.tsx            # NEW: auth subscription + isAdmin (shared helper)
├── modules/
│   └── monitoring/                     # NEW
│       ├── index.ts
│       ├── pages/
│       │   └── SentryMonitorPage.tsx   # Compose panels, redirect if !isAdmin
│       ├── components/                  # Issues list, stat cards, trend chart
│       ├── hooks/
│       │   └── useSentryMonitor.ts      # React Query → sentry-proxy
│       └── api/
│           └── sentryProxy.api.ts       # fetch with supabase.auth.getSession() bearer
└── shared/
    └── components/ui/chart.tsx         # ChartContainer (existing)

supabase/functions/
├── _shared/
│   └── auth.ts                         # getUserFromRequest (existing)
└── sentry-proxy/
    └── index.ts                        # NEW: op=issues | stats; admin check; Sentry REST
```

**Structure Decision**: Single feature module **`monitoring`** (product name “Sentry monitor”); Edge Function **`sentry-proxy`**; app-shell changes limited to **context**, **router**, **ReviewNavToolbar**, and light **`DashboardLayout`** touch-up.

## Implementation notes (concise)

1. **`AdminContext`**: Subscribe to `supabase.auth.onAuthStateChange`, compute `isAdmin` using the same rules as today (`VITE_ADMIN_EMAIL` comma list, trim, lowercase). Export `useAdmin()`. Mount provider in `App.tsx` inside existing `BrowserRouter` + `Providers` so **`ReviewNavToolbar`** and **`DashboardLayout`** both consume it (eliminates “passing props” across siblings).
2. **`ReviewNavToolbar`**: Append a **Monitoring** item (`/dashboard/sentry-monitor`, icon e.g. `Bug` or `Activity` from lucide) **only if `isAdmin`**.
3. **`router.tsx`**: Nested route `sentry-monitor` under `/dashboard` → `SentryMonitorPage`.
4. **`SentryMonitorPage`**: If `!isAdmin`, `Navigate` to **`/dashboard/inbox`** (only). Else render layout: issues table, three stat tiles, `ChartContainer` + recharts line/area for trend; include an explicit **Refresh** control calling `refetch()` on issues and stats queries (**FR-009**).
5. **`sentry-proxy`**: CORS `*` + OPTIONS; `getUserFromRequest`; verify **server-side** admin allowlist against `user.email` using secret **`ADMIN_EMAILS`** (comma-separated, must match deployment’s `VITE_ADMIN_EMAIL`). Branch on `op` query: **`issues`** | **`stats`**. Call Sentry REST with `Authorization: Bearer ${SENTRY_AUTH_TOKEN}` and org/project from secrets; use **`AbortSignal.timeout(10_000)`** on each upstream `fetch` and return a **friendly JSON error** on timeout (no hang). Return normalized JSON per contract.
6. **React Query**: Keys `['sentry','issues']`, `['sentry','stats']`; `staleTime` ~ 60s; surface errors with shadcn `Alert` or toast.

## Complexity Tracking

No constitution violations requiring justification.
