# Research: Inbox IA Unification (Phase 0)

**Date**: 2026-07-09 | **Branch**: `feature/inbox-ia-unification`
**Method**: All line references below re-verified on disk this session (the spec's line numbers were treated as pointers, not gospel). File under audit: `src/modules/inbox/pages/UnifiedInboxPage.tsx` (1,458 lines).

## R1. Verified current state model

| State | Kind | Source of truth | Location |
|---|---|---|---|
| `viewMode: 'conversations' \| 'customers'` | React `useState` | localStorage `inbox.desktop.viewMode.v1`, fallback `'customers'` | `UnifiedInboxPage.tsx:78-87` |
| `segment: 'enquiries' \| 'all'` | derived (not state) | URL `?segment=enquiries` (absent = `all`); setter deletes param for `all`, `replace: true` | `:256-266` |
| `listFilter: ListFilter` | React `useState('all')` | in-memory only, **shared by both lists** | `:92` |
| channel filter | derived | URL `?channel=email\|whatsapp\|sms` (absent = `all`), `replace: true` | `:271-283` |
| initial conversation selection | one-shot read | URL `?conversation=` via `window.location` (TDZ workaround — reads before `useSearchParams` is declared) | `:105-106` |
| OAuth params | one-shot effects | URL `?gmail=connected`, `?error` | `:417-445` |

**Findings the spec did not know:**

1. **`ListFilter` already includes `'stuck'`** — `'all' | 'unread' | 'urgent' | 'unlinked' | 'stuck'` (`InboxConversationList.tsx:13`). A "N stuck" pill renders when `stuckCount > 0` (`InboxConversationList.tsx:210-220`) and the page filters by `aging.isStuck` (`UnifiedInboxPage.tsx:568-572`). The triage plumbing partially exists.
2. **`isStuck` is red-only** — `isStuck: level === 'red'` (`inboxBuckets.ts:185`). The spec's triage definition (ball-in-court `us` and/or amber/red) is **broader** than the existing stuck signal. See decision D2.
3. **`CustomerThreadList` has a narrower filter type** (`CustomerListFilter`, no `'stuck'`); the page coerces `'stuck' → 'all'` when rendering it (`UnifiedInboxPage.tsx:1283`). Precedent for per-view filter coercion.
4. **A second legacy entry point exists**: route `/dashboard/enquiry-triage` → `EnquiryTriageRedirect` → `/dashboard/inbox?segment=enquiries[&conversation=…]` (`src/app/router.tsx:38-45,68`). Back-compat must cover `?segment=enquiries` *combined with* `?conversation=`.
5. **`computeAging` produces amber/red for *both* sides** — `them`-side has chase timers (`themOwesAmberMs/themOwesRedMs`, `inboxBuckets.ts:178-181`), so "past SLA" includes chase-ups we owe, not only replies.

## R2. Verified inventory of `viewMode`-keyed logic (must be remapped, none orphaned)

| # | Location | What it does | Gate today |
|---|---|---|---|
| V1 | `:200-207` | persist `viewMode` to localStorage | writes on change |
| V2 | `:209-213` | clear `emptyChannelStartContext` on leaving conversations | `viewMode !== 'conversations'` |
| V3 | `:215-219` | reset `suppressCustomersAutoSelectRef` on leaving customers | `viewMode !== 'customers'` |
| V4 | `:222-228` | `activePersonId` derivation (customers selection vs selected conversation) | ternary on `'customers'` |
| V5 | `:578-591` | auto-select first conversation | `viewMode !== 'conversations'` → return |
| V6 | `:593-623` | customers row auto-select | `viewMode !== 'customers'` → return |
| V7 | `:627-650` | customers auto-mark-read on row open | `viewMode !== 'customers'` → return |
| V8 | `:675-685` | `customersMarkReadTargetIds` / `customersMarkUnreadTargetIds` memos | `'customers'` checks |
| V9 | `:687-696` | `anyToggleTargetUnread` memo | `'customers'` branch |
| V10 | `:858-899` | `handleToggleReadUnread` (ids source, forced-unread bookkeeping, clear multi-select) | `'customers'` / `'conversations'` branches |
| V11 | `:1030-1036, 1057-1062` | new-conversation `onSuccess` select + channel filter | `viewMode === 'conversations'` |
| V12 | `:1209-1243` | Conversations/Customers tab UI | render |
| V13 | `:1244-1312` | list branch: `InboxConversationList` vs `CustomerThreadList` | render |
| V14 | `:1390-1416` | right pane: `ConversationView` vs `CustomerConversationView` | `viewMode === 'conversations' \|\| segment === 'enquiries'` |

## R3. Verified inventory of `segment`-keyed logic

| # | Location | What it does | Gate today |
|---|---|---|---|
| S1 | `:256-266` | derivation + setter | URL param |
| S2 | `:298` | `useEnquiryPipeline` query enabled | `segment === 'enquiries'` |
| S3 | `:1155-1184` | Enquiries / All-Linked tablist UI | render |
| S4 | `:1185-1206` | `EnquiryPipelineBoard` replaces the left list | `segment === 'enquiries'` |
| S5 | `:1390` | right pane forced to `ConversationView` | OR-clause with V14 |
| S6 | `:1441-1449` | `EnquiryCreateOrderPanel` (right panel) for selected conversation without order | `segment === 'enquiries'` |

Related but **not** keyed on either: `handleEnquiryPipelineMarkInProgress` (`:302-307`) uses `useUpdateEnquiryStage` — the per-row stage-progression action survives independent of segment (FR-008 already satisfiable).

## R4. Decisions

### D1 — Single `view` param + orthogonal `board` param
**Decision**: `?view=all|triage|customers` (URL-derived, `replace: true`, absent = default) plus `?board=1` (absent = off, never persisted).
**Rationale**: Matches the existing URL-derivation pattern for `segment`/`channel` (same file, same idiom); `board` is orthogonal because old code allowed `segment=enquiries` to coexist with either `viewMode` — the new model must reproduce that 2×3 space to remap every gate without behavior change.
**Alternatives rejected**: folding board into `view=board` (loses the old `viewMode` sub-state while the board is up, breaking V4/V14 equivalence); React state + localStorage only (spec FR-002 requires linkable/back-button).

### D2 — Triage predicate: `aging != null && (ball.side === 'us' || level !== 'fresh')`
**Decision**: A conversation is "To triage" when the ball is in our court (any age) **or** its aging level is amber/red (either side — includes overdue chase-ups).
**Rationale**: Matches spec FR-004 wording ("needs a reply / past SLA") and User Story 2 scenario 2 (replied-to + within SLA ⇒ excluded: side `them`, level `fresh`). The existing `isStuck` (red-only) is too narrow to be the whole view — it is a subset (`stuck ⊂ triage`), so the existing "N stuck" pill remains meaningful *inside* the triage view.
**Alternatives rejected**: `isStuck` only (red) — spec says needs-a-reply, not only past hard SLA; `enquiry_stage`-based — explicitly forbidden by FR-004 and disproven by ground-truth data.
**Pre-build check (spec risk note)**: quickstart.md step 3 verifies the triage count is a non-empty strict subset of All against Sears Melvin before the view ships.

### D3 — Default view: `customers`
**Decision**: When no `?view=` param and no stored preference: default `customers`.
**Rationale**: Preserves today's shipped default (`UnifiedInboxPage.tsx:86` returns `'customers'`) — zero change for existing users whose v1 key is absent; FR-014 records "likely the primary/default view".
**Alternatives rejected**: `all` (silent behavior change for fresh sessions); `triage` (empty in Churchill — bad first-run).

### D4 — localStorage: new key `inbox.desktop.view.v2`, one-time migration from v1
**Decision**: Persist last-used `view` under `inbox.desktop.view.v2`. On init, if v2 absent and `inbox.desktop.viewMode.v1` present: `'customers'` → `customers`, `'conversations'` → `all`. Leave the v1 key in place (rollback safety; new code simply stops reading it once v2 exists). `board` is never persisted (US4 scenario 1: fresh session ⇒ off).
**Alternatives rejected**: reusing the v1 key with new values (old code reading `'triage'` would silently fall back — breaks rollback); deleting v1 (destroys rollback path for no gain).

### D5 — Legacy URL normalization (read-once, on mount, `replace: true`)
| Incoming | Normalized to |
|---|---|
| `?segment=enquiries` (no `view`) | `?view=triage` |
| `?segment=enquiries&view=X` | `?view=X` (new param wins, `segment` stripped) |
| `?segment=<anything else>` | stripped |
| `?view=<invalid>` | treated as absent → default (D3), param stripped |
| `?conversation=`, `?channel=`, `?gmail=`, `?error` | passed through untouched |

`EnquiryTriageRedirect` (`router.tsx:38-45`) keeps working with **zero changes** — its target URL hits the alias row 1 and its `conversation` param is preserved (the `:105-106` one-shot read happens before normalization rewrites the URL, and normalization must not drop it). FR-009 satisfied without touching the router.

### D6 — Gate remapping is a fixed bijection
- `viewMode === 'conversations'` ⇒ `view !== 'customers'` (i.e. `all` or `triage` — both render `InboxConversationList`).
- `viewMode === 'customers'` ⇒ `view === 'customers'`.
- `segment === 'enquiries'` ⇒ `board` (the toggle).

Applying this mechanically to V1–V14/S1–S6 reproduces today's full 2×3 behavior space (including the odd-but-shipped combination "board up + customers viewMode", where `activePersonId` still comes from the customers selection — preserved as `board=1&view=customers`).

### D7 — `EnquiryCreateOrderPanel` also shows in the triage view
**Decision**: S6's gate becomes `board || view === 'triage'` (still requires a selected conversation without an order).
**Rationale**: Legacy `?segment=enquiries` now lands on triage with the board **off** (D5); if the panel stayed board-gated, users following the `enquiry-triage` redirect would lose the create-order affordance — violating the spec's "no workflow capability is lost". This is the one deliberate gate *widening*; every other remap is equivalence-preserving.
**Alternative rejected**: mapping legacy links to `?view=triage&board=1` (contradicts FR-007's board-off default and US3 scenario 1).

### D8 — `listFilter` stays in-memory and shared; triage composes by intersection
**Decision**: Pills remain a single shared `useState` applied to the active view (FR-005). The triage predicate (D2) is applied in the `displayConversations` memo chain *after* pills, so pills ∩ triage. The existing `'stuck' → 'all'` coercion for `CustomerThreadList` (`:1283`) is kept as-is.
**Alternatives rejected**: URL-deriving pills (scope creep — not required by any FR); hiding the stuck pill in triage view (it's a strict subset, still useful as an escalation filter).

## R5. Constitution & guardrail compliance (researched, no violations)

- **No schema change / no db push / no migration** — pure frontend state refactor over existing columns (`enquiry_stage`, `person_id`, `link_state` are read via existing hooks; the only write path, `useUpdateEnquiryStage`, is pre-existing and untouched).
- **Dual router**: no routes added/moved/renamed; `EnquiryTriageRedirect` untouched (D5).
- **Module boundaries**: every change is inside `src/modules/inbox/` (one new hook + edits to the page and possibly `InboxConversationList` for the view-switch UI).
- **Multi-tenancy**: all org-data access is read-only through existing RLS-scoped hooks; validation only against Sears Melvin (`CLAUDE.local.md`), Churchill has 1 conversation and is not a test target.
