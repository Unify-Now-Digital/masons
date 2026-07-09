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
- **To triage** — conversations that need a reply / are past SLA, driven by the
  existing `inboxBuckets` aging + ball-in-court engine (the "stuck" signal), NOT by
  `enquiry_stage`. See §2a for why.
- **By customer** — person-grouped view (`CustomerThreadList`), retained as a view.
- **Board (toggle)** — the kanban demoted to an optional view toggle, defaulting off.

Filter pills (`Unread / Urgent / Unlinked` + channel) persist, applied to whichever
view is active.

### 2a. Why "To triage" is aging-driven, not `enquiry_stage`-driven
Ground-truth query (open conversations, `enquiry_stage` distribution per org):

| org | new | in_progress | order_created |
|-----|-----|-------------|---------------|
| Sears Melvin (`3770972d`) | 223 | 3 | 0 |
| Churchill (`a05ee759`, live prod) | 1 | 0 | 0 |
| Third org (`15486fe5`) | 142 | 0 | 0 |

In every org with real volume, `enquiry_stage` is ~100% `new` — the stage funnel does
not progress. An `enquiry_stage`-based "To triage" view would therefore equal "all
conversations" and carry no signal. The real, working triage signal is the
`inboxBuckets` aging/SLA engine (per-bucket ball-in-court + the "stuck" count already
surfaced in the list). "To triage" = needs-a-reply / stuck, from that engine.

### Rationale for demoting the board
Across ALL three orgs (see §2a table), `in_progress` + `order_created` totals ≤3 rows;
the stage progression the kanban exists to visualise is effectively empty everywhere,
not just in one org. The board pays its complexity cost (a whole alternate layout at
the top level) without a matching workflow payoff.
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

- Churchill is **live production** but has **1 inbox conversation total** (inbox
  order-taking is still offline per project notes) — it cannot meaningfully validate
  the new IA. **Sears Melvin is the only org with enough volume to test against.**
  Lower breakage risk in Churchill (nothing to break), but SM is the sole real test bed.
- The page manages ~30 state variables and multiple effects keyed on `viewMode` /
  `segment`; the migration must not orphan effects (e.g. the `viewMode`-gated
  auto-select and mark-read logic at lines ~204–213, ~573–644).
- Do not regress the shipped row/rail work.
- Ground-truth DONE (§2a): `enquiry_stage` is ~100% `new` in all orgs → "To triage"
  redefined to aging-driven. Re-confirm the `inboxBuckets` "stuck"/needs-reply counts
  per org before building, so the "To triage" view is non-empty and useful.

## 7. Suggested Spec Kit flow

`/speckit.specify` (this doc) → `/speckit.plan` (state migration + component wiring +
URL/localStorage compat) → `/speckit.tasks` → `/speckit.implement`, gated per your
normal review. No `db push`; no schema change anticipated (uses existing
`enquiry_stage`, `person_id`, `link_state`).