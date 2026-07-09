# Feature Specification: Inbox IA Unification

**Feature Branch**: `feature/inbox-ia-unification`
**Created**: 2026-07-09
**Status**: Draft
**Input**: User description: "Use specs/inbox-ia-unification.md as the input specification for unifying the inbox IA. Read it and expand into the formal spec." (Input draft preserved in git history at commit `12c9c56`.)

**Scope**: `src/modules/inbox/pages/UnifiedInboxPage.tsx`, native "Inbox" source only. GHL Inbox is out of scope.
**Risk tier**: High — a ~1,458-line stateful page feeding two live orgs (Churchill = live production, Sears Melvin = pre-launch). Full Spec Kit cycle required, not a gated one-shot.

## Problem Statement

The inbox left panel stacks four levels of navigation chrome, and the levels are asymmetric — the same top-level control switches between fundamentally different layouts:

- **Source:** `Inbox | GHL Inbox` (out of scope here)
- **Segment:** `Enquiries | All / Linked` — but `Enquiries` renders a *kanban board* (`EnquiryPipelineBoard`), while `All / Linked` renders a *list*.
- **View (only under All/Linked):** `Conversations | Customers` — `InboxConversationList` vs `CustomerThreadList`, buried one level below the control that decides whether it exists at all.
- **Filter pills:** `All / Unread / Urgent / Unlinked` + channel.

A user cannot predict, from the top-level choice, whether they will get a board or a list. The `Unlinked` concept appears twice (segment intent + filter pill). Three different views of one dataset (`inbox_conversations`) are presented as three different destinations rather than three arrangements of one surface.

**Direction:** one list surface with a **view switch** — `All | To triage | By customer` — plus an optional board toggle (default off), with filter pills applied to whichever view is active.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One predictable list surface with a view switch (Priority: P1)

An inbox user opens the inbox and sees a single conversation list with one view switch: **All**, **To triage**, and **By customer** (default view decided in `/plan`, per FR-014 — likely By customer). Every choice yields a list-shaped surface — an arrangement of the same dataset, never a surprise layout fork. Filter pills (`Unread / Urgent / Unlinked` + channel) stay visible and apply to whichever view is active.

**Why this priority**: This is the core IA fix — collapsing the asymmetric segment/view hierarchy into one level. Everything else (triage semantics, board demotion, link compat) hangs off this control existing.

**Independent Test**: Can be fully tested by opening the inbox, cycling through the three views, and applying each filter pill in each view — delivers the unified navigation on its own even if triage semantics and board toggle ship later.

**Acceptance Scenarios**:

1. **Given** a user opens `/dashboard/inbox` with no prior state, **When** the page loads, **Then** the default view's list is shown (default view decided in `/plan`, per FR-014 — likely By customer) and the view switch shows exactly three views: All, To triage, By customer.
2. **Given** any active view, **When** the user selects a different view, **Then** the list re-arranges without changing surface type (list → list), and the URL reflects the selected view.
3. **Given** an active filter pill (e.g. Unread) in the "All" view, **When** the user switches to "By customer", **Then** the same filter remains active and is applied to the person-grouped view.
4. **Given** the "By customer" view, **When** the user selects a customer group, **Then** the behavior of today's `CustomerThreadList` is preserved (no capability lost relative to the current Customers view).
5. **Given** any view, **When** the user inspects the filter pills, **Then** "Unlinked" appears exactly once — as a filter pill, not also as a segment/destination.

---

### User Story 2 - "To triage" driven by the aging/ball-in-court engine (Priority: P2)

A user who wants to know "what needs my attention" selects **To triage** and sees only conversations that need a reply or are past SLA — as judged by the existing `inboxBuckets` engine (`deriveBallInCourt` side = `us`, `computeAging` level amber/red against per-bucket SLAs). Membership is **not** derived from `enquiry_stage`.

**Why this priority**: Ground truth (2026-07 query, §Assumptions) shows `enquiry_stage` is ~100% `new` in every org with volume, so a stage-driven view would equal "all conversations" and carry no signal. The aging engine is the only working triage signal; wiring the view to the wrong signal would make the flagship new view useless.

**Independent Test**: Against Sears Melvin data, open "To triage" and verify its membership matches the conversations the existing list already marks stuck/needs-reply — a strict, non-empty subset of "All".

**Acceptance Scenarios**:

1. **Given** an org with open conversations where the ball is in our court or aging is amber/red, **When** the user opens "To triage", **Then** exactly those conversations are listed, consistent with the aging badges/stuck counts the list already shows.
2. **Given** a conversation whose `enquiry_stage` is `new` but which has been replied to and is within SLA, **When** the user opens "To triage", **Then** that conversation is absent (stage alone does not qualify it).
3. **Given** the "To triage" view, **When** the user applies a channel or Unread/Urgent/Unlinked filter, **Then** the filter composes with the triage criterion (intersection).
4. **Given** an org with no stuck/needs-reply conversations, **When** the user opens "To triage", **Then** an empty state is shown (not an error, not a fallback to All).

---

### User Story 3 - Legacy links and saved preferences keep working (Priority: P2)

A user following an existing deep link (`/dashboard/inbox?segment=enquiries`, referenced in `src/app/router.tsx`) or returning with a saved `inbox.desktop.viewMode.v1` localStorage preference lands in the equivalent new view with no broken link, blank screen, or lost preference.

**Why this priority**: `?segment=enquiries` is linked from elsewhere in the app; breaking it is a visible regression on day one. Preference migration prevents existing users from being silently reset.

**Independent Test**: Visit each legacy URL/preference combination and confirm the mapped view loads; no other story needs to exist for this to be verified.

**Acceptance Scenarios**:

1. **Given** a request to `/dashboard/inbox?segment=enquiries`, **When** the page loads, **Then** the user lands on the "To triage" view (via redirect or param alias) and the in-app link in `router.tsx` continues to work.
2. **Given** legacy localStorage `inbox.desktop.viewMode.v1 = 'customers'` and no `view` URL param, **When** the page loads, **Then** the "By customer" view is the default.
3. **Given** a user switches views, **When** they later reopen the inbox with no `view` URL param, **Then** their last-used view is the default (persisted preference), while an explicit `view` URL param always wins.
4. **Given** any view is active, **When** the user presses the browser back button after switching views, **Then** navigation steps back through view states (URL-derived state).

---

### User Story 4 - Kanban board demoted to an optional toggle (Priority: P3)

A user who still wants the enquiry pipeline board can enable a **Board** toggle (default off) to see `EnquiryPipelineBoard`; everyone else never encounters a layout fork. The enquiry triage actions (`mark in progress` / `enquiry_stage` progression) remain available as per-row actions, so no workflow capability is lost.

**Why this priority**: The board's stage funnel is effectively empty in all three orgs (≤3 rows beyond `new` in total), so it pays a top-level complexity cost with no matching payoff — but deletion is Arin's product call, so it is demoted, not removed. Lowest priority because Stories 1–3 deliver the IA without it.

**Independent Test**: Toggle the board on and off and verify the kanban renders with today's behavior when on, and that stage-progression actions are reachable from list rows when off.

**Acceptance Scenarios**:

1. **Given** a fresh session, **When** the inbox loads, **Then** the board toggle is off and no kanban is rendered.
2. **Given** the board toggle is on, **When** the user views the surface, **Then** `EnquiryPipelineBoard` renders with its current behavior (retained, not rebuilt).
3. **Given** the board toggle is off, **When** the user opens a conversation row's actions, **Then** the `enquiry_stage` progression action (e.g. mark in progress) is still available.

---

### Edge Cases

- Legacy URL and new URL params both present (e.g. `?segment=enquiries&view=all`): the new `view` param wins; the legacy param is ignored/stripped.
- Legacy localStorage value present alongside a new persisted view preference: the new preference wins; the legacy key is migrated once, not re-read forever.
- Unknown/invalid `view` param value: fall back to the default view, not a blank surface.
- "To triage" in Churchill (1 conversation total): must render a sensible empty/near-empty state — Churchill cannot validate the IA but must not error.
- Board toggle enabled while a filter pill is active: define and preserve today's board/filter interaction (board currently ignores list filter pills — do not silently change this).
- The ~30 page state variables and effects keyed on `viewMode`/`segment` (e.g. the `viewMode`-gated auto-select and mark-read logic at approx. lines 204–213 and 573–644 of `UnifiedInboxPage.tsx`): every such effect must be explicitly remapped to the new `view` model — none may be orphaned (dead condition) or accidentally broadened (firing in views it never fired in before).
- Collapsed left rail (already shipped): continues to mirror the Conversations list regardless of active view — the documented v1 limitation is preserved, not regressed.
- Mid-session view switch while a conversation is selected: selection/mark-read behavior must match today's behavior for the equivalent old state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The inbox (native source) MUST present a single top-level view switch with exactly three views — `all`, `triage`, `customers` — each rendering a list-shaped arrangement of the same conversation dataset. (Default view selection is decided in `/plan`; see FR-014.)
- **FR-002**: The active view MUST be URL-derived via a single `view` param (`?view=all|triage|customers`) so views are linkable, shareable, and back-button navigable — replacing the current split where `segment` is URL-derived but `viewMode` is React state.
- **FR-003**: The last-used view MUST be persisted to localStorage and used as the default when no `view` URL param is present; an explicit URL param MUST always override the persisted preference.
- **FR-004**: "To triage" membership MUST be computed from the existing `inboxBuckets` engine — ball-in-court side `us` (needs a reply) and/or aging level amber/red per bucket SLA — and MUST NOT be derived from `enquiry_stage`.
- **FR-005**: Filter pills (`Unread`, `Urgent`, `Unlinked`, channel) MUST persist across view switches and apply to the active view; in "To triage" they compose by intersection with the triage criterion.
- **FR-006**: The `Unlinked` concept MUST appear exactly once in the IA — as a filter pill only, no longer doubled as a segment-level destination.
- **FR-007**: `EnquiryPipelineBoard` MUST be demoted to an optional board toggle that defaults to **off**; the board stays reachable and is not deleted, rebuilt, or behaviorally changed. *(Decided: demote — per the 199-vs-3 stage-distribution evidence.)*
- **FR-008**: The enquiry triage action (`mark in progress` / `enquiry_stage` progression) MUST remain reachable from conversation rows when the board is off — no workflow capability is lost by the demotion.
- **FR-009**: Legacy deep links using `?segment=enquiries` MUST resolve to the "To triage" view via redirect or param alias; the existing reference in `src/app/router.tsx:42` MUST continue to work without modification being required elsewhere.
- **FR-010**: Legacy localStorage `inbox.desktop.viewMode.v1 = 'customers'` MUST map to a `view=customers` default on first load under the new model.
- **FR-011**: Every effect and state variable currently keyed on `viewMode` or `segment` in `UnifiedInboxPage.tsx` MUST be explicitly remapped to the new view model; the migration MUST NOT orphan effects (notably the `viewMode`-gated auto-select and mark-read logic).
- **FR-012**: The collapsed left rail MUST continue to read `displayConversations` correctly and mirror the Conversations list regardless of active view (existing documented v1 limitation — preserved, not fixed here). Note: because the rail mirrors the Conversations list rather than the customer grouping, it shows conversation avatars even when "By customer" is the active view — acceptable for v1, recorded as a known gap.
- **FR-013**: The GHL Inbox source MUST be kept as-is and untouched — no behavior, routing, or layout change to the GHL tab. *(Decided: keep, out of scope; any retire-or-keep decision is separate from this spec.)*
- **FR-014**: "By customer" MUST be retained as a first-class view using the existing `CustomerThreadList`, and is likely the primary/default view — current code already defaults `viewMode` to `'customers'` (initializer at `UnifiedInboxPage.tsx:79-87`). *(Decided: keep first-class; the `/plan` phase decides the default value of the new single `view` param.)*

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: Any work touching navigation/routing MUST preserve the coexistence of `src/app/` (app shell/router wiring) and `src/pages/` (legacy/singleton pages), or include a migration plan with regression testing.
- **AC-002 (Module boundaries)**: Feature code MUST live in `src/modules/inbox/` and MUST NOT deep-import other features' internals; shared functionality MUST be promoted into `src/shared/`.
- **AC-003 (RLS as boundary)**: Authorization MUST be enforced in the database via RLS; UI checks are not security.
- **AC-004 (No schema change)**: This feature MUST NOT require any migration or `db push` — it uses existing columns only (`enquiry_stage`, `person_id`, `link_state`). Any discovered need for a schema change halts for explicit approval.
- **AC-005 (Multi-tenancy)**: All validation against real orgs is read-only. No writes to Churchill or Sears Melvin data. Sears Melvin is the designated volume test bed (Churchill has 1 inbox conversation total and cannot validate the IA).
- **AC-006 (Type discipline)**: `npx tsc --noEmit` MUST be clean before merging to `staging` — `vite build` does not typecheck.

### Key Entities

- **Conversation** (`inbox_conversations`): the single dataset all three views arrange; carries `enquiry_stage`, `person_id`, `link_state`, channel, unread/urgent flags. No schema change.
- **View state**: the new single `view` param (`all | triage | customers`) plus an independent `board` toggle (boolean, default off) — replaces the current `segment` (URL) + `viewMode` (localStorage-persisted React state) pair.
- **Triage signal**: derived, not stored — ball-in-court side (`us`/`them`) and aging level (`fresh`/`amber`/`red`) per bucket (`enquiry`/`order`/`cemetery`) with per-bucket SLAs, from `src/modules/inbox/utils/inboxBuckets.ts`.
- **Enquiry stage** (`enquiry_stage`): retained as the board's column dimension and the per-row progression action's target; explicitly NOT the triage-view criterion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the top-level view switch, 100% of choices yield a list-shaped surface — the board-vs-list layout fork at the top level is eliminated (board reachable only via the explicit toggle).
- **SC-002**: All known legacy entry points resolve correctly: `?segment=enquiries` lands on "To triage" and stored `viewMode=customers` defaults to "By customer", with zero blank screens or 404s across the mapping matrix.
- **SC-003**: In Sears Melvin, "To triage" is a non-empty strict subset of "All" whose membership matches the stuck/needs-reply counts the existing list already surfaces (re-confirmed per org before build, per the risk notes).
- **SC-004**: Zero behavioral regressions in the shipped row/rail work, auto-select, and mark-read flows — verified by exercising each flow in the new model against its documented current behavior.
- **SC-005**: Zero writes to Churchill or Sears Melvin data during development and validation; zero schema migrations shipped.
- **SC-006**: `npx tsc --noEmit` and `npm run lint` are clean on the feature branch before merge to `staging`.
- **SC-007**: Navigation chrome above the conversation list is reduced from four stacked levels (source / segment / view / pills) to three (source / view switch / pills) for the native inbox.

## Assumptions

- **Ground truth on `enquiry_stage` (queried 2026-07, pre-spec)**: distribution of open conversations per org — Sears Melvin (`3770972d…`): 223 `new` / 3 `in_progress` / 0 `order_created`; Churchill (`a05ee759…`, live prod): 1 / 0 / 0; third org (`15486fe5…`): 142 / 0 / 0. This is the evidentiary basis for FR-004 (aging-driven triage) and FR-007 (board demotion). The `inboxBuckets` stuck/needs-reply counts per org must be re-confirmed before build so "To triage" is non-empty and useful.
- **Board demotion is decided** — demote to a toggle (default off); the board stays reachable, not deleted (FR-007).
- **GHL Inbox is fully out of scope**, including the separate retire-or-keep decision.
- **Sears Melvin is the sole meaningful test bed**; Churchill's near-empty inbox lowers its breakage risk but provides no validation signal.
- **No schema change is anticipated or permitted** — the feature is a pure frontend IA/state migration over existing columns.
- **The input draft's line references** (~1,458 lines; effects at ~204–213 and ~573–644) are anchors as of commit `12c9c56` and may drift; the plan phase should re-locate them by behavior, not line number.
- **Suggested flow**: this spec → `/plan` (state migration + component wiring + URL/localStorage compat) → `/tasks` → `/implement`, gated per normal review.
