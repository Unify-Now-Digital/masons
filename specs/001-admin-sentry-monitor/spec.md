# Feature Specification: Admin error monitoring dashboard

**Feature Branch**: `001-admin-sentry-monitor`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "Build a Sentry Dashboard page for admin users only: dedicated route, admin-only nav, issues list (title, count, first/last seen), error stats for 24h/7d/30d, users affected, server-side proxy for monitoring API (no secrets in browser), redirect non-admins, align with existing app modules."

## Clarifications

### Session 2026-04-08

Repository survey (no planning commit — documents **current** codebase only):

- Q: Is there already a monitoring or admin section in the sidebar nav? → A: **No.** The app shell uses `ReviewNavToolbar`, which lists `allPages` (Inbox, Map, Jobs, Orders, …). There is no Monitoring/Sentry entry and no admin-only nav grouping. `AppSidebar.tsx` holds a similar static `navigationItems` list under the label “Management”, but **it is not imported anywhere** (dead code today).
- Q: How is `isAdmin` currently passed through the app (from `DashboardLayout` down to nav items)? → A: **`isAdmin` is not passed to any sidebar or router.** It is computed only inside `DashboardLayout.tsx` and passed **solely** to `WhatsAppConnectionStatus`. `ReviewNavToolbar`, `AppSidebar`, and `router.tsx` have no `isAdmin` prop or context — any admin-only nav link will require new wiring (context, props, or lifted layout).
- Q: What patterns exist for structuring a new Edge Function proxy? → A: **One function per folder** with `index.ts`; **`Deno.serve`** on `Request`; shared **`corsHeaders`** and **`OPTIONS`** handling; **Bearer JWT** checked via `createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { headers: { Authorization } })` then `auth.getUser(token)`, or **`getUserFromRequest`** from `supabase/functions/_shared/auth.ts`. Upstream calls use **secrets** from `Deno.env`. **Path-style routing** inside a single deployable appears in `gmail-oauth` (`new URL(req.url).pathname.split("/").pop()`).
- Q: Which charting library is already used? → A: **`recharts`** is listed in `package.json`. **`src/shared/components/ui/chart.tsx`** re-exports a shadcn-style **ChartContainer** etc. built on Recharts. **No dashboard module currently imports it** — charts would align with this stack rather than introducing a second library.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin reviews recent production errors (Priority: P1)

An authorised workshop administrator opens the error monitoring area from the main app navigation, sees a list of recent issues with how often each has occurred, when it was first and last seen, and can use this to prioritise fixes without leaving the product.

**Why this priority**: Surfaces the core operational value—knowing what is breaking and how serious it is—without any secondary visuals or trends.

**Independent Test**: Sign in as an admin, open the monitoring page, and verify the issues list matches the monitoring service for the configured project (spot-check fields and ordering of recency).

**Acceptance Scenarios**:

1. **Given** a signed-in user whose account is designated as an administrator, **When** they open the monitoring page, **Then** they see a list of recent issues each showing title, total occurrence count, first seen, and last seen.
2. **Given** a signed-in administrator, **When** the monitoring service reports no open issues, **Then** the page shows an explicit empty state (not a blank screen).
3. **Given** a signed-in administrator, **When** the monitoring service is temporarily unavailable or returns an error, **Then** the page shows a clear, non-technical error message and does not expose secret configuration.

---

### User Story 2 - Admin sees error volume and affected users (Priority: P2)

The same administrator views headline numbers for how many errors occurred in the last day, week, and month, and how many distinct users were affected, so they can gauge severity and customer impact at a glance.

**Why this priority**: Complements the issues list with aggregate health indicators and impact.

**Independent Test**: As admin, compare displayed aggregates to the monitoring provider’s reporting for the same time windows (within acceptable reporting lag).

**Acceptance Scenarios**:

1. **Given** a signed-in administrator on the monitoring page, **When** data loads successfully, **Then** they see total error counts (or equivalent volume metrics) for the last 24 hours, 7 days, and 30 days.
2. **Given** a signed-in administrator, **When** data loads successfully, **Then** they see a count (or clearly labelled equivalent) of users affected by errors in the reporting period used for that metric.

---

### User Story 3 - Admin sees error trend over time (Priority: P3)

The administrator sees a simple visual trend of errors over time to spot spikes or regressions quickly.

**Why this priority**: Improves scanability of volume changes; secondary to raw lists and headline numbers.

**Independent Test**: As admin, confirm a time-based chart (or equivalent visual) renders for the configured period and updates when data is refreshed.

**Acceptance Scenarios**:

1. **Given** a signed-in administrator, **When** statistics over time are available, **Then** the page shows a trend visualization covering an appropriate recent interval (aligned with the stats endpoints).
2. **Given** insufficient data for a meaningful trend, **When** the administrator views the page, **Then** the UI degrades gracefully (e.g. empty chart area with explanation).

---

### User Story 4 - Only administrators can access monitoring (Priority: P1)

Non-administrators do not see the monitoring entry in navigation; if they navigate directly to the monitoring URL, they are sent away and do not see monitoring data.

**Why this priority**: Prevents leakage of operational and potentially sensitive diagnostic information.

**Independent Test**: Sign in as a non-admin, confirm no nav link; open the monitoring URL directly and confirm redirect or safe fallback with no data.

**Acceptance Scenarios**:

1. **Given** a signed-in user who is not an administrator, **When** they use the main navigation, **Then** no link to error monitoring is shown.
2. **Given** a signed-in non-administrator, **When** they open the monitoring page URL directly, **Then** they are redirected to an appropriate safe destination (e.g. main dashboard) without viewing issues or stats.
3. **Given** a user who is not signed in, **When** they attempt to open the monitoring URL, **Then** they are handled consistently with the app’s existing unauthenticated access rules.

---

### Edge Cases

- Monitoring provider credentials missing or invalid: page shows safe error; no secrets in client.
- Organisation or project misconfiguration: clear failure state, no partial secret leakage.
- Very large issue lists: list remains usable (sensible default limit, loading state, optional pagination or “load more” as implemented in planning).
- Rate limiting or timeout from monitoring provider: user-visible retry or message, no hang.
- Clock or timezone skew: “last seen” / windows still understandable (consistent with provider).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST provide a dedicated monitoring screen reachable from the signed-in experience at a stable path under the main dashboard (exact path to follow existing routing conventions).
- **FR-002**: A navigation label (e.g. “Monitoring” or equivalent) MUST appear only for users designated as administrators; it MUST lead to the monitoring screen.
- **FR-003**: The monitoring screen MUST list recent issues with: human-readable title, occurrence count, first seen timestamp, last seen timestamp.
- **FR-004**: The monitoring screen MUST show aggregate error volume for each of: the last 24 hours, the last 7 days, and the last 30 days.
- **FR-005**: The monitoring screen MUST show how many distinct users were affected by errors (as reported by the monitoring provider for the chosen definition of “affected user”).
- **FR-006**: The monitoring screen MUST include a visual trend of error volume over time, consistent with the statistics made available to the page.
- **FR-007**: Monitoring data MUST be fetched via a trusted server-side integration; authentication material for the monitoring provider MUST NOT be present in browser-delivered code or responses visible in devtools as application config.
- **FR-008**: Non-administrators MUST NOT receive issue lists, statistics, or trend data from the monitoring integration when accessing the app through supported flows (direct URL included).
- **FR-009**: Administrators MUST be able to refresh or re-load the monitoring view and see up-to-date data subject to normal caching and provider lag.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: Any work touching navigation/routing MUST preserve the coexistence of `src/app/` (app shell/router wiring) and `src/pages/` (legacy/singleton pages), or include a migration plan with regression testing.
- **AC-002 (Module boundaries)**: Feature code MUST live in `src/modules/<feature>/` and MUST NOT deep-import other features’ internals; shared functionality MUST be promoted into `src/shared/`.
- **AC-003 (Defence in depth)**: Client-side admin checks (navigation, redirects) MUST be paired with server-side enforcement on the integration that returns monitoring data so that designation as “admin” cannot be bypassed by crafted requests alone.
- **AC-004 (Secrets)**: Monitoring provider tokens and organisation/project identifiers required for API access MUST be stored only in server-side secrets configuration, not in client environment variables intended for the browser.

### Key Entities *(include if feature involves data)*

- **Issue summary**: A grouping of repeated errors with title, occurrence count, first occurrence time, most recent occurrence time; may include a stable identifier from the monitoring provider.
- **Error period statistics**: Totals (or equivalent) for fixed rolling windows: 24 hours, 7 days, 30 days.
- **User impact count**: Count of distinct end users affected by errors in the scope defined by the monitoring provider.
- **Time series bucket**: A point or interval used for trend visualization (e.g. errors per hour or day) as supplied by the stats integration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can open the monitoring screen and identify the top recent issues (title and recency) within 60 seconds of page load when the monitoring service is healthy.
- **SC-002**: In testing, 100% of attempts by non-administrator accounts to load monitoring data via the app’s integration receive no issue list or aggregate stats (only a safe denial or redirect path).
- **SC-003**: Administrators can report error volume for all three windows (24h, 7d, 30d) without referring to external tools in routine checks—validated by structured walkthrough with 3 representative admin users.
- **SC-004**: After launch, support or engineering can answer “how many users were hit?” and “is volume getting worse?” from the monitoring screen alone for 90% of triage questions in a two-week review (qualitative sign-off).

## Assumptions

- The **primary visible navigation** for signed-in dashboard use is **`ReviewNavToolbar`** in `App.tsx`, not the currently unused `AppSidebar` module; admin-only entries should appear where users actually navigate unless the shell is refactored.
- “Administrator” uses the same notion as elsewhere in the product (designated admin accounts / emails); no new role model is required beyond that.
- A single monitoring project (organisation + project) is sufficient for v1; multi-project selection is out of scope unless later specified.
- The monitoring provider is Sentry or API-compatible for the described fields; exact field mapping is an implementation detail.
- Server-side integration may expose separate read operations for issues list and for statistics/trends, as long as the browser never receives provider auth tokens.
- Reasonable latency (a few seconds) for loading the dashboard is acceptable when the third-party service is healthy.
