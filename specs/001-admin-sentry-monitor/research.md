# Research: Admin Sentry monitoring dashboard

**Feature**: `001-admin-sentry-monitor`  
**Date**: 2026-04-08

## R1 — Server-side admin allowlist

**Decision**: Store **`ADMIN_EMAILS`** as a Supabase secret (comma-separated, trim/lowercase match on `user.email` from `getUserFromRequest`). Keep **`VITE_ADMIN_EMAIL`** as the client allowlist for UI. Operations must **keep both lists in sync** in each environment (documented in [quickstart.md](./quickstart.md)).

**Rationale**: `VITE_*` values are embedded in the client bundle; they **must not** be the sole authority for API authorization. The Edge Function cannot read `VITE_ADMIN_EMAIL` from the browser—it needs an server-side mirror. A dedicated secret avoids inventing a DB role table for v1.

**Alternatives considered**:

- **Single source in DB** (e.g. `admin_users` table): stronger long-term; rejected for v1 as scope-heavy (migrations, RLS, admin CRUD).
- **Trust JWT “role” claim only**: not used in current app; would require auth hook changes.
- **Skip server check**: violates spec FR-008 / AC-003.

## R2 — Wiring `isAdmin` to `ReviewNavToolbar`

**Decision**: Introduce **`AdminContext`** (+ `useAdmin`) at the app shell (`App.tsx`), wrapping routes and **`ReviewNavToolbar`**, using the same email comparison as `DashboardLayout` today.

**Rationale**: `ReviewNavToolbar` is a **sibling** of the routed tree in `App.tsx`, not a child of `DashboardLayout`; props cannot flow layout → toolbar without a lift. Context is the smallest shared state that avoids duplicating auth listeners inconsistently.

**Alternatives considered**:

- **Move toolbar inside `DashboardLayout`**: larger UX/layout change; affects every dashboard page’s structure.
- **Global store (Zustand/Redux)**: not present; overkill.

## R3 — `sentry-proxy` request routing

**Decision**: One deployed function **`sentry-proxy`**; distinguish operations with **`op` query parameter**: `op=issues` and `op=stats`. Methods: **GET** only for v1. Standard **OPTIONS** + JSON error body on failure.

**Rationale**: Supabase Edge URLs expose a single path per function; query params are simple to invoke from React Query without path rewriting ambiguity.

**Alternatives considered**:

- **Separate functions** (`sentry-issues`, `sentry-stats`): duplicates CORS, auth, and Sentry token handling.
- **POST bodies for op**: works; GET matches read-only semantics and cache-friendly usage.

## R4 — Sentry API surfaces

**Decision**: Use Sentry HTTP API **v0** (Bearer auth):

- **Issues list**: `GET /api/0/projects/{organization_slug}/{project_slug}/issues/` with query params for ordering (e.g. `-lastSeen`) and `limit`.
- **Statistics / volume / trend**: derive from **`GET /api/0/projects/{organization_slug}/{project_slug}/stats/`** (or equivalent **discover/events** aggregate if stats endpoint insufficient—implementation may adjust while keeping the **contract** static).

Map responses to the **DTOs** in [data-model.md](./data-model.md) inside the Edge Function so the frontend stays stable if Sentry fields rename slightly.

**Rationale**: Official REST API; token never leaves Edge Function.

**Alternatives considered**:

- **Sentry SDK in Deno**: possible but heavier; raw `fetch` + small mappers is enough for two reads.

## R5 — Trend chart library

**Decision**: Use existing **`recharts`** via **`ChartContainer`** from `src/shared/components/ui/chart.tsx`.

**Rationale**: Already in `package.json`; shadcn chart wrapper matches design system; spec explicitly allows this stack.

**Alternatives considered**: New chart library—rejected (duplication).
