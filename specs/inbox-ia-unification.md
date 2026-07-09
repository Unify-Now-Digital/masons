# Inbox IA Unification — Spec

**Status:** Draft for review → `/speckit.specify`
**Scope:** `src/modules/inbox/pages/UnifiedInboxPage.tsx` (native "Inbox" source only; GHL out of scope)
**Risk tier:** High — 1,458-line stateful page feeding two live orgs (Churchill prod, Sears Melvin). Requires Spec Kit cycle, not a gated one-shot.

---

## 1. Problem

The inbox left panel stacks four levels of navigation chrome, and the levels are
asymmetric — the same top-level control switches between fundamentally different
layouts:

- **Source:** `Inbox | GHL Inbox` (out of scope here)
- **Segment:** `Enquiries | All / Linked` — but `Enquiries` renders a *kanban board*
  (`EnquiryPipelineBoard`), while `All / Linked` renders a *list*.
- **View (only under All/Linked):** `Conversations | Customers` — `InboxConversationList`
  vs `CustomerThreadList`, buried one level below the control that decides whether
  it exists at all.
- **Filter pills:** `All / Unread / Urgent / Unlinked` + channel.

A user cannot predict, from the top-level choice, whether they will get a board or
a list. The `Unlinked` concept appears twice (segment intent + filter pill). Three
different views of one dataset (`inbox_conversations`) are presented as three
different destinations rather than three arrangements of one surface.

## 2. Proposed direction

One list surface with a **view-switch**, replacing the board-vs-list fork:

- **All** — the conversation list (default).
- **To triage** — enquiries needing action (`enquiry_stage`-driven), as a filtered
  view of the same list, not a separate board layout.
- **By customer** — person-grouped view (`CustomerThreadList`), retained as a view.
- **Board (toggle)** — the kanban demoted to an optional view toggle, defaulting off.

Filter pills (`Unread / Urgent / Unlinked` + channel) persist, applied to whichever
view is active.

### Rationale for demoting the board
Live data shows `NEW 199 / IN PROGRESS 3` — the stage progression the kanban exists
to visualise is not happening in practice, so the board pays its complexity cost
(a whole alternate layout at the top level) without a matching workflow payoff.
**Demote, do not delete** — deletion is Arin's product call. The enquiry *triage
action* (`mark in progress`, `enquiry_stage` progression) survives as the "To triage"
view + the existing per-row action, so no workflow capability is lost.

## 3. State migration

Current relevant state:
- `segment: 'enquiries' | 'all'` — **URL-derived** (`searchParams.get('segment')`), not React state.
- `viewMode: 'conversations' | 'customers'` — React state, **localStorage-persisted**
  (`inbox.desktop.viewMode.v1`), defaults to `'customers'`.

Proposed:
- Single `view` param: `'all' | 'triage' | 'customers'` (+ optional `board` boolean).
- Prefer **URL-derived** (like `segment` today) so views are linkable/shareable and
  back-button works; persist last-used to localStorage for default-on-load.
- **Migration/compat:** map legacy `?segment=enquiries` → `?view=triage`; legacy
  `viewMode=customers` localStorage → `view=customers` default. Preserve existing
  deep links (e.g. `/dashboard/inbox?segment=enquiries` referenced elsewhere in
  router.tsx) via redirect or param-alias so no external link breaks.

## 4. Components affected

- `UnifiedInboxPage.tsx` — the view-switch render logic (currently the
  `segment === 'enquiries' ? <EnquiryPipelineBoard> : <viewMode branch>` tree).
- `EnquiryPipelineBoard` — retained, mounted only behind the board toggle.
- `InboxConversationList` — the "All" and "To triage" views (triage = filtered list).
- `CustomerThreadList` — the "By customer" view.
- Collapsed left-rail (already shipped) — confirm it still reads `displayConversations`
  correctly under the new view model; the rail currently mirrors the Conversations
  list regardless of view (documented v1 limitation).

## 5. Open questions for Arin

1. **Board demotion** — accept board-as-toggle (default off), or keep the kanban
   as a first-class view? (Recommendation: demote, per 199/3.)
2. **"By customer" prominence** — first-class view, or demote to a filter if the
   team rarely works person-first?
3. **GHL Inbox tab** — retire, or keep? (Separate decision; out of scope for this spec.)

## 6. Risk notes

- Churchill is **live production**. Any change to the inbox's primary navigation
  affects daily use — stage this behind review + Arin sign-off, verify on SM first.
- The page manages ~30 state variables and multiple effects keyed on `viewMode` /
  `segment`; the migration must not orphan effects (e.g. the `viewMode`-gated
  auto-select and mark-read logic at lines ~204–213, ~573–644).
- Do not regress the shipped row/rail work.
- Ground-truth first: before implementing, query actual `enquiry_stage` distribution
  per org to confirm the "To triage" view has sensible contents and the board really
  is underused in both orgs, not just SM.

## 7. Suggested Spec Kit flow

`/speckit.specify` (this doc) → `/speckit.plan` (state migration + component wiring +
URL/localStorage compat) → `/speckit.tasks` → `/speckit.implement`, gated per your
normal review. No `db push`; no schema change anticipated (uses existing
`enquiry_stage`, `person_id`, `link_state`).
