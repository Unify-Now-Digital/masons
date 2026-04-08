# Tasks: Admin Sentry monitoring dashboard

**Input**: Design documents from `/specs/001-admin-sentry-monitor/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Not requested in spec; manual verification via [quickstart.md](./quickstart.md) only.

**Organization**: Phases follow user-story priorities (US4 + US1 are both P1; US4 gates access before US1 fills content).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependencies)
- **[Story]**: `[US1]`–`[US4]` for story phases only

---

## Phase 1: Setup (shared scaffolding)

**Purpose**: Types and module shell so implementation tasks have stable imports.

- [x] T001 [P] Add DTO TypeScript interfaces in `src/modules/monitoring/types/sentry.types.ts` per `specs/001-admin-sentry-monitor/data-model.md`

---

## Phase 2: Foundational (blocking)

**Purpose**: **No user-story UI can be secured or load data** until this phase completes.

**⚠️ CRITICAL**: Completes `ADMIN_EMAILS` + JWT gate on Edge and shared **`useAdmin()`** for shell + future pages.

- [x] T002 Implement `AdminProvider` and `useAdmin()` in `src/app/layout/AdminContext.tsx` (subscribe to Supabase auth; derive `isAdmin` from `import.meta.env.VITE_ADMIN_EMAIL` comma list; match trim/lowercase rules in `src/app/layout/DashboardLayout.tsx`)
- [x] T003 Wrap authenticated shell children with `AdminProvider` in `src/app/App.tsx` so both `src/app/layout/ReviewNavToolbar.tsx` and dashboard routes see the same context
- [x] T004 Implement `supabase/functions/sentry-proxy/index.ts`: shared CORS + `OPTIONS`; `getUserFromRequest` from `supabase/functions/_shared/auth.ts`; `ADMIN_EMAILS` secret allowlist; `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG`; `GET` handlers `op=issues` and `op=stats` per `specs/001-admin-sentry-monitor/contracts/sentry-proxy.md`; return shapes from `specs/001-admin-sentry-monitor/data-model.md`; wrap **every Sentry `fetch`** with **`AbortSignal.timeout(10000)`** and on timeout return **502** (or 500) with a short, non-technical error message

**Checkpoint**: Deploy secrets and function per `specs/001-admin-sentry-monitor/quickstart.md`; verify non-admin JWT → **403** on `sentry-proxy`.

---

## Phase 3: User Story 4 — Only administrators can access monitoring (Priority: P1)

**Goal**: No Monitoring link for non-admins; direct `/dashboard/sentry-monitor` redirects; Edge already rejects non-admins (T004).

**Independent Test**: Sign in as non-admin → no nav item → open URL → redirect without issues/stats; call `sentry-proxy` with non-admin token → 403.

### Implementation for User Story 4

- [x] T005 [US4] Create `src/modules/monitoring/index.ts` exporting the route page; add `src/modules/monitoring/pages/SentryMonitorPage.tsx` with `<Navigate to="/dashboard/inbox" replace />` when `!useAdmin().isAdmin` and minimal loading/signed-in guard for admins
- [x] T006 [US4] Register nested route `sentry-monitor` under `/dashboard` in `src/app/router.tsx` lazy or direct-import from `@/modules/monitoring`
- [x] T007 [US4] Append admin-only Monitoring `NavLink` (`/dashboard/sentry-monitor`) in **`src/app/layout/ReviewNavToolbar.tsx`** when `useAdmin().isAdmin` is true—update **both** the **mobile drawer** and **desktop** nav lists (shared `navPages` / `buildNavPages`)

**Checkpoint**: Access control and navigation behaviours match US4 acceptance scenarios.

---

## Phase 4: User Story 1 — Admin reviews recent production errors (Priority: P1) 🎯 MVP core

**Goal**: Issues list with title, count, first seen, last seen; empty and error states; no secrets in browser.

**Independent Test**: Admin opens `/dashboard/sentry-monitor`; list matches Sentry project; empty project shows empty state; Sentry failure shows safe message.

### Implementation for User Story 1

- [x] T008 [US1] Implement `fetchSentryIssues` (session bearer, `op=issues`) in `src/modules/monitoring/api/sentryProxy.api.ts` using `import.meta.env.VITE_SUPABASE_FUNCTIONS_URL`
- [x] T009 [US1] Add React Query hook for issues (e.g. `useSentryIssuesQuery`) in `src/modules/monitoring/hooks/useSentryMonitor.ts`
- [x] T010 [P] [US1] Build `src/modules/monitoring/components/SentryIssuesTable.tsx` (shadcn table/card, columns: title, count, first seen, last seen; loading skeleton; empty state)
- [x] T011 [US1] Compose issues query + table into `src/modules/monitoring/pages/SentryMonitorPage.tsx` for admin users with user-friendly error UI (no token leakage); add a **Refresh** button that calls **`refetch()`** on both the issues and stats React Query hooks (**FR-009**; wire stats `refetch` once the stats hook exists in Phase 5—stub or no-op until then)

**Checkpoint**: US1 independently demonstrable (issues-only page is a viable MVP slice).

---

## Phase 5: User Story 2 — Admin sees error volume and affected users (Priority: P2)

**Goal**: Headline metrics for 24h, 7d, 30d, and users affected.

**Independent Test**: Admin compares tiles to Sentry for same windows (allowing provider lag).

### Implementation for User Story 2

- [x] T012 [US2] Implement `fetchSentryStats` (`op=stats`) in `src/modules/monitoring/api/sentryProxy.api.ts`
- [x] T013 [US2] Add `useSentryStatsQuery` in `src/modules/monitoring/hooks/useSentryMonitor.ts`
- [x] T014 [P] [US2] Build `src/modules/monitoring/components/SentryStatCards.tsx` displaying `errors24h`, `errors7d`, `errors30d`, `usersAffected` from `SentryPeriodStats`
- [x] T015 [US2] Render `SentryStatCards` in `src/modules/monitoring/pages/SentryMonitorPage.tsx` with loading/error handling

**Checkpoint**: US2 testable without chart (US3).

---

## Phase 6: User Story 3 — Admin sees error trend over time (Priority: P3)

**Goal**: Time-series visualization from stats `series` using existing chart primitives.

**Independent Test**: Admin sees chart when `series` non-empty; short explanation when empty.

### Implementation for User Story 3

- [x] T016 [US3] Create `src/modules/monitoring/components/SentryErrorTrendChart.tsx` using `ChartContainer` and recharts primitives from `src/shared/components/ui/chart.tsx`
- [x] T017 [US3] Pass stats query `series` into `SentryErrorTrendChart` from `src/modules/monitoring/pages/SentryMonitorPage.tsx` with graceful empty copy when `series` missing or length 0

**Checkpoint**: Full spec stories US1–US4 + trend complete.

---

## Phase 7: Polish & cross-cutting

**Purpose**: DRY admin state, env documentation, manual regression.

- [x] T018 [P] Replace inline admin email logic in `src/app/layout/DashboardLayout.tsx` with `useAdmin().isAdmin` for `WhatsAppConnectionStatus` prop in `src/app/layout/DashboardLayout.tsx`
- [x] T019 [P] Document Supabase secret `ADMIN_EMAILS` (must mirror `VITE_ADMIN_EMAIL`) in `.env.example` at repository root
- [x] T020 Run `npx tsc --noEmit` from repository root and execute manual checks in `specs/001-admin-sentry-monitor/quickstart.md`

---

## Dependencies & execution order

### Phase dependencies

| Phase | Depends on |
|-------|------------|
| Phase 1 Setup | None |
| Phase 2 Foundational | Phase 1 |
| Phase 3 US4 | Phase 2 |
| Phase 4 US1 | Phase 3 (route + gate + API client contract live) |
| Phase 5 US2 | Phase 4 (page shell; can merge hooks into one file already started) |
| Phase 6 US3 | Phase 5 (`series` available from stats response) |
| Phase 7 Polish | Phase 4 minimum; complete after Phase 6 for full coverage |

### User story dependencies

| Story | Priority | Depends on |
|-------|----------|------------|
| US4 | P1 | Foundational (T002–T004) |
| US1 | P1 | US4 route/nav |
| US2 | P2 | US1 page + proxy `op=stats` (already in T004) |
| US3 | P3 | US2 stats query + `series` |

### Parallel opportunities

- **T001** parallel before Phase 2.
- **T010** and **T014** parallel once **T009** / **T013** respectively exist (different component files).
- **T018** and **T019** parallel in Phase 7.

---

## Parallel example: User Story 1

After **T009** completes:

- Implement **`src/modules/monitoring/components/SentryIssuesTable.tsx`** while reviewing copy for **`SentryMonitorPage`** integration (if two contributors, coordinate on **T011** merge).

---

## Implementation strategy

### MVP first (recommended)

1. Complete Phase 1–2 (types, context, proxy).
2. Complete Phase 3 (US4) — safe access.
3. Complete Phase 4 (US1) — issues list **only**.
4. **Stop and validate** with `specs/001-admin-sentry-monitor/quickstart.md` and US1 acceptance scenarios.
5. Add Phase 5–6 then Phase 7.

### Incremental delivery

- **Ship MVP after Phase 4**: admins can triage issues in-app.
- **Phase 5**: adds operational KPIs.
- **Phase 6**: adds trend visual.
- **Phase 7**: DRY + docs + `tsc`.

---

## Task summary

| Metric | Value |
|--------|-------|
| **Total tasks** | 20 |
| Phase 1 | 1 |
| Phase 2 | 3 |
| US4 | 3 |
| US1 | 4 |
| US2 | 4 |
| US3 | 2 |
| Polish | 3 |

**Format validation**: All tasks use `- [ ] Tnnn` with file path in description; story phases include `[USn]`; parallel tasks marked `[P]`.
