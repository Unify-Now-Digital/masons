# Tasks: Sidebar order form with AI prefill

**Input**: `specs/sidebar-order-form/spec.md`, `specs/sidebar-order-form/plan.md`
**Prerequisites**: spec.md and plan.md committed on `feature/sidebar-order-form`. Rulings R-001..R-010 settled.
**Written**: 2026-09-18, directly from the template (`/speckit.tasks` helper unavailable). Includes the C1 risk and C3 security review items from the same day.

## Format: `[ID] [Owner] [Tags] Description`

- **[CC]** Claude Code: reads and code edits only, manual per-edit approval.
- **[G]** Giorgi: browser, gate, git, deploys, anything that authenticates to a live endpoint.
- **[READ]** Read-first task. CC reads the named code and writes its finding or prediction
  BEFORE any diff is proposed for the dependent edit tasks. Structural and behavioural
  predictions are tripwire-eligible; grep counts are not.
- **[P]** Can run in parallel with its neighbours (different files, no dependency).
- **[OPT]** First to cut if hours run short.
- Task ids here are feature-local (T001..). They are not handoff T-numbers.
- Line refs are plan.md's. They go stale after the first edit in a file: re-read, do not trust.
- One concern per commit. Baseline keys re-anchored in the commit that moves them (AC-007).

---

## Phase C1: Presentation, layout, lifecycle (US1)

**Goal**: side presentation at >= 1280px, grid reflow, transient list collapse, person-bound lifecycle with dirty confirm.
**Independent test**: browser checklist 1-11 plus 2b, 6b, 8b, 11b below.

### Spike (throwaway, never committed)

- [x] T001 [CC+G] Hard-code `direction="right"` and `modal={false}` on the existing drawer
  in the dev build. Giorgi checks in the browser, E2E org:
  - (a) conversation scrolls;
  - (b) select text in a message, Ctrl+C, click a form field, paste: text arrives;
  - (c) click a focusable element in the conversation (button, link, anything with
    `tabindex`), then type: record where focus lands and whether the field's existing
    text is selected (next keystroke would replace it);
  - (d) Esc closes;
  - (e) mouse-drag on the form body toward the right edge: does the drawer move or close.

  **If (b) fails: STOP.** The A1 ruling's premise is gone and a new ruling is needed
  before any C1 edit. Candidates to evaluate then, not now: a vaul version that forwards
  `modal` to Radix (check the changelog; affects every drawer in the app), or the side
  branch rendering Radix Dialog directly with `modal={false}`.
  Record (c) and (e) results; they feed T002, T007 and the C5 limitation text.
  Giorgi discards the spike edit.

### Results so far (2026-09-18)

**T001 spike (browser, E2E org, edits discarded):** no backdrop; conversation scrolls; select
in a message -> Ctrl+C -> paste into a form field works; Esc closes; a mouse drag on the form
body CLOSES the drawer; clicking into the reply composer worked (cursor, typed text landed in
the composer, form field untouched) even though a form field had been typed in first.

**T002 (source, vaul 0.9.9 + Radix):**
- `modal` is NOT forwarded to Radix `Dialog.Root`; `DialogContentModal` renders (focus trap,
  `hideOthers` aria-hidden, `disableOutsidePointerEvents`). Plan's limitation is correct in
  mechanism. Source predicts: once a form field has had focus, clicking the composer snaps
  focus back to that field with its text selected. The spike observed the opposite.
  **UNRESOLVED: source vs browser. Settled at T021 line 2b; limitation text untouched until then.**
- Drag-dismiss: `shouldDrag` returns true for any left/right drawer before every exclusion.
  Mechanism = `handleOnly` on the Drawer root, side presentation only. Fallback
  `data-vaul-no-drag`. `dismissible={false}` must NOT be used: it swallows Esc and `DrawerClose`.
- **`<DrawerOverlay />` must be KEPT in the side branch.** It renders null when `modal` is
  false, but its rAF is the only thing that resets `body { pointer-events: none }` when the
  drawer is opened by prop. Without it the conversation is unclickable and unscrollable.
- Tab loops inside the form and never dismisses it. Esc pressed while focus is in the reply
  composer DOES dismiss the form (document-level capture listener, no vaul guard).
- The rest of the page is `aria-hidden` (not inert) while the form is open.

**T003 (source):** no in-page unmount path for `PersonOrdersPanel` (no `key`, no conditional on
the selected conversation, right-column collapse only adds a `hidden` class). Latent: the
`inboxSource === 'ghl'` ternary would unmount the workspace; unreachable while
`SHOW_GHL_INBOX_TAB = false`. **Stop condition hit: route navigation.** With no overlay the
dashboard nav is clickable with a dirty form open; `src/` has no `useBlocker`,
`unstable_usePrompt` or `beforeunload`; navigating away unmounts the panel and the draft is lost
silently. Session stopped at tripwire 2/3; T004-T006 run in a fresh session.

**Rulings taken on these findings (Giorgi, 2026-09-18):**
- **R-011 Navigation away.** Accepted v1 limitation: in-app route navigation with a dirty side
  form discards the draft without a prompt (no navigation blocker exists in the app; routing is
  constrained). Backlog. Mitigation in v1: a `beforeunload` warning while the side form is open
  and dirty (covers reload / tab close only).
- **R-012 Esc scope.** In side presentation Esc dismisses the form only when focus is inside
  the form. Esc pressed elsewhere on the page (reply composer, search) is ignored by the form.
  FR-002 otherwise unchanged; the close control always works.

**T004 (source):** `setLeftCollapsed` has three callers in `UnifiedInboxPage.tsx`: the
load-persisted effect, `collapseListButton` (`setLeftCollapsed(true)`) and the left-rail expand
button (`setLeftCollapsed(false)`). No keyboard shortcut. **Persistence is an effect on
`leftCollapsed` / `rightCollapsed` state, not a handler**: any state change from any source is
written. There is no toggle, only two one-way buttons. Grid: base is unprefixed `grid-cols-1`;
each of the four branches carries `lg:` and `xl:` variants; `lg` = 1024, `xl` = 1280; column 3 is
`hidden lg:flex`. `handleOrdersCountChange` is `useCallback([])`. `onCloseOrder` also calls
`setRightCollapsed(true)` and is reachable with the form open.

**T005 (source, RHF 7.53.1):** prediction on `watch` `type` held exactly: `'change'` for
registered inputs and Controller `field.onChange`; no `type` for `setValue`, field-array ops and
`reset`. 20 `form.setValue` calls in four groups: `handleProductSelect` (user action, wired via
`onValueChange`, emits no `'change'`), Renovation effect (programmatic), open effect
(programmatic), font select (already preceded by `field.onChange`). **Places pick is NOT a
`setValue` site**: typing and prediction pick both go through Controller `field.onChange`.
Inputs the subscription cannot see: `dimensions` (plain `useState`, not in RHF), field-array
`append` and `remove`.

**T006 (source):** nothing sits between the early return and the main return; all hooks and
handlers are above it. Both branches return a root `<div>`; `CreateOrderDrawer` is rendered only
in the main return, unkeyed. Hoist = one `const createOrderDrawer = <CreateOrderDrawer key=… />`
defined above the early return and placed in both root divs. **`handleNewOrder` is async with
TWO open sites**: the sync path (person already known) and the S5 path (`await resolvePersonId`
-> `await linkConversation` -> `setResolvedPersonId(newPersonId)` -> open). On the S5 path
`effectivePersonId` in the closure is stale/null and `person` is not loaded yet, so email and
phone are undefined at open. In the early-return state live `initialJobId` / `initialPersonId` go
null, so the hoist is only safe once `initial*` come from the snapshot. `beforeunload` belongs in
one `useEffect` in `PersonOrdersPanel` above the early return: every close route and all four
success exits go through the same `onOpenChange` setter, so one cleanup covers close, save and
unmount. Pre-existing caveat (backlog): if `saveOrderPeople` throws, no success exit runs and
the drawer stays open although the order row exists.
Session ended at tripwire 3/3 (persistence-is-an-effect, Places, async handler); all reads were
complete before the third miss.

**Implementation decisions from T004-T006 (Giorgi, 2026-09-18):**
- **D-1 Collapse is derived, never set.** The form never calls `setLeftCollapsed` or
  `setRightCollapsed`. Left: `effectiveLeftCollapsed` ORs in `orderFormOpen`. Right: no state
  change at all; the `orderFormOpen` grid branch comes first and does not depend on
  `rightCollapsed`, the drawer is portaled, and the panel stays mounted under a `hidden` class
  (T003). No ref guard in `handleOrdersCountChange` unless checklist 7 fails.
- **D-2 `onCloseOrder` is left as is.** It is a user action with its normal persisted effect;
  the grid branch keeps the layout correct while the form is open.
- **D-3 Snapshot fill-once.** Snapshot fields that are undefined at open (S5 path) may be
  filled once from live data, only while live `personId === snapshot.personId`, and are never
  overwritten once set. R-003 stays literally true: the drawer reads only the snapshot.

### Read-first

- [x] T002 [CC] [READ] vaul 0.9.9 source in `node_modules`: does `dismissible={false}`
  also block Esc (early return in the root `onOpenChange`)? What does `shouldDrag`
  exclude? Does `data-vaul-no-drag` exist in this version? Output: the mechanism that
  satisfies FR-002 (Esc and close control dismiss; drag and outside pointer do not).
- [x] T003 [CC] [READ] `UnifiedInboxPage.tsx` around `:1428`: every condition under which
  `PersonOrdersPanel` unmounts or remounts (a `key`, conditional render on selected
  conversation, view/tab switch, right-column collapse, deselect). Output: list of
  unmount paths. Any path reachable with the form open = silent draft loss: stop and
  report before T012.
- [x] T004 [CC] [READ] `UnifiedInboxPage.tsx`: every caller of `setLeftCollapsed` and the
  `:245` localStorage write, including any keyboard shortcut. Also the four existing grid
  strings at `:1218-1225`: their breakpoint prefix and what the base (unprefixed) layout
  is. Output: where the toggle must be no-oped; which prefix the new grid string uses.
- [x] T005 [CC] [READ] `CreateOrderDrawer.tsx`: every `form.setValue` call site, classified
  user-action (`:116` product select, Places pick, any other) vs programmatic
  (`:191-198` open effect, `:175-189` Renovation effect). Then read the installed RHF
  source and state the prediction: `watch` callback `type` is `'change'` for registered
  inputs and Controller `field.onChange`, `undefined` for `setValue`.
- [x] T006 [CC] [READ] `PersonOrdersPanel.tsx` `:249` to `:381`: what is computed between
  the early return and the main return; whether the drawer element can sit under the
  same parent type with the same `key` in both branches; whether the "New order"
  handler can set snapshot and open in one event.

### Edits

- [ ] T007 [CC] `src/shared/components/ui/drawer.tsx`: `DrawerContent` gains `side?: boolean`.
  Implement as a separate JSX branch so the false branch is textually identical to
  today. Side branch: **keep `<DrawerOverlay />`** (renders null under `modal={false}`; its
  rAF restores body pointer events - see T002), wrapper `fixed inset-y-0 right-0 z-50 flex
  pointer-events-none`, content `h-full w-[440px] rounded-none border-l`
  (`pointer-events-auto` is already on Content; do not duplicate it), no drag handle.
  Plan.md's "no `<DrawerOverlay />`" for the side branch is superseded by this line.
- [ ] T008 [CC] [P] `src/modules/inbox/hooks/useMinWidth.ts` (new) + unit test with stubbed
  `matchMedia` (initial value read synchronously, change event).
- [ ] T009 [CC] `CreateOrderDrawer.tsx`: `presentation?: 'modal' | 'side'` (default `'modal'`).
  Side-only root props applied conditionally so the modal path passes no new props:
  `direction="right"`, `modal={false}`, `handleOnly` (T002: blocks drag-dismiss; no handle is
  rendered in side, so nothing drags). Never `dismissible={false}`.
  R-012: in side presentation pass `onEscapeKeyDown` to the content and `preventDefault()`
  when `document.activeElement` is not inside the drawer content. Read how vaul forwards
  Content props to Radix before proposing; if the handler does not reach Radix, stop and report.
  Three grid sites (`:489`, `:624`, `:758`): side -> `grid-cols-1`, modal -> today's
  literal string.
- [ ] T010 [CC] `CreateOrderDrawer.tsx`: `userTouched` ref and its full capture mechanism
  land HERE, not in C4: `form.watch` subscription setting the ref on `type === 'change'`
  (covers every registered and Controller field, including Places and the People picker).
  Explicit set at exactly four places (T005): top of `handleProductSelect`, the `dimensions`
  `onChange` (plain `useState`, invisible to RHF), field-array `append`, field-array `remove`.
  None at the font select or the Places input. Cleared on open and on close.
  `onDirtyChange?.(true)` called at the moment the ref flips (not from an effect). The open
  effect and the Renovation effect must not set it (they emit no `type`, so they cannot).
- [ ] T011 [CC] `PersonOrdersPanel.tsx`: `useMinWidth(1280)`; `handleNewOrder` snapshots
  `{ personId, jobId, email, phone, presentation }` and resets the panel's own dirty flag at
  **both open sites** (sync path and S5 path; do not rely on the child's clear). On the S5
  path the snapshot uses the local `newPersonId`, never the closure's `effectivePersonId`.
  `CreateOrderDrawer` reads `initial*` from the snapshot only. D-3 fill-once for fields
  undefined at open.
  **Read first, before proposing:** on the S5 path today, what are `initialJobId`,
  `initialEmail`, `initialPhone` at open time and after the queries settle, and what `job_id`
  does the created order end up with? State it, then show that the snapshot + D-3 gives the
  same result. If `job_id` would differ from today, stop and report.
- [ ] T012 [CC] `PersonOrdersPanel.tsx` (after T011, or in the same diff - never before it):
  one `const createOrderDrawer = <CreateOrderDrawer key="create-order" … />` defined above the
  early return and placed as a direct child of BOTH root divs. Other drawers stay where they
  are.
- [ ] T013 [CC] `PersonOrdersPanel.tsx`: person-change effect, gated on open. Live `personId`
  non-null and != snapshot -> dirty ? AlertDialog (Discard / Keep editing) : close.
  Live null -> nothing. AlertDialog must render above the drawer.
- [ ] T014 [CC] `PersonOrdersPanel.tsx`: `onOrderFormOpenChange?` prop; effect reports
  `open && presentation === 'side'`; reports false on unmount.
- [ ] T014a [CC] `PersonOrdersPanel.tsx` (R-011): while the form is open in side presentation
  and dirty, register a `beforeunload` handler; remove it on close, on save and on unmount.
  Driven by the same dirty flag as T013. No in-app navigation guard in v1.
- [ ] T015 [CC] `UnifiedInboxPage.tsx` (D-1, D-2): `orderFormOpen` state;
  `effectiveLeftCollapsed` ORs it in inside the existing `layoutReady && !isMobile`
  conjunction; `collapseListButton` and the left-rail expand button are no-ops while
  `orderFormOpen` (so the persistence effect cannot fire from the form); new FIRST grid branch
  `lg:grid-cols-[56px_minmax(0,1fr)_440px]` (an `lg:` variant like the existing four, so a
  resize below 1280 keeps the track; plan.md's `xl:` string is superseded); no
  `setLeftCollapsed` / `setRightCollapsed` call anywhere in this diff; pass
  `onOrderFormOpenChange={setOrderFormOpen}` to `PersonOrdersPanel`.
- [ ] T016 [CC] [OPT] Side presentation header names the bound person (add `personName` to
  the snapshot). Mitigates "Keep editing" creating an order for A while B is on screen.
- [ ] T017 [CC] Re-anchor the three `CreateOrderDrawer.tsx` tsc baseline keys; state the new
  line numbers per diff.

### Verify and commit

- [ ] T018 [G] Gate, four steps: tsc item-diff, build, lint, tests.
- [ ] T019 [G] Reviewer subagent on the branch diff: `drawer.tsx` false branch textually
  identical; modal path of `CreateOrderDrawer` receives no new props.
- [ ] T020 [G] `git status`, add by path, commit, push.
- [ ] T021 [G] Browser checklist 1-11 (plan.md), naming the record per line, plus:
  - **2b** (settles the T002 source-vs-browser question) type `abc` in Deceased Name, click
    into the reply composer, type `x`. Record exactly: where the `x` landed, whether `abc`
    was selected or replaced, whether the composer held a cursor. Then correct the
    "Known v1 limitation" text in spec.md / plan.md to what was observed (docs commit).
  - **2c** (R-012) focus in the reply composer, press Esc: form stays open. Focus in a form
    field, press Esc: form closes. Close control works in both cases.
  - **2d** Tab from the last form control: focus loops inside the form, form stays open.
  - **2e** (R-011) dirty side form, press F5: browser leave-page prompt appears. Clean form:
    no prompt. Dirty form, click "Orders" in the app nav: draft is lost without a prompt
    (accepted limitation, observed not failed).
  - **6b** with the form open, click the list toggle; close; reload: stored
    `inbox.desktop.leftCollapsed` unchanged.
  - **8b** open at >= 1280, resize to ~1100: presentation does not swap, conversation is
    not covered.
  - **11b** mouse-drag the form body to the right: form does not move and does not close.
  - Checklist 11 in plan.md is read as an observation, not a pass/fail, until 2b is recorded.

**Slot after C1**: F-042 (`inbox-ai-suggest-reply` membership check). Separate concern,
separate commit, not part of this feature's task list.

---

## Phase C2: Side-host schema (US3)

**Independent test**: checklist 12-13.

- [ ] T022 [CC] [READ] Installed RHF `useForm` source: is `control._options` (resolver)
  refreshed per render? Prediction first. Also confirm `orderFormSchema` is a `z.object`
  with the refine on the inner `order_people` field so `.extend` is available; if not,
  stop and report before falling back to `.omit().merge()`.
- [ ] T023 [CC] `order.schema.ts`: append `orderFormSideSchema` (`sku`, `location` as plain
  `z.string()`).
- [ ] T024 [CC] [P] `order.schema.test.ts` (new): side accepts `''` for both; base rejects
  both; `order_type` required in both.
- [ ] T025 [CC] `CreateOrderDrawer.tsx`: resolver switch per T022 outcome (direct ternary, or
  one resolver branching on a presentation ref).
- [ ] T026 [CC] `CreateOrderDrawer.tsx`: required star hidden on Grave Number and Location in
  side presentation.
- [ ] T027 [CC] Re-anchor baseline keys if any moved.
- [ ] T028 [G] Gate. T029 [G] Commit by path, push. T030 [G] Checklist 12-13.

**Checkpoint before C3**: recount the September hours cap.

---

## Phase C3: `keepHead`, `inbox-ai-extract-order`, evidence filter (US2, server)

**Independent test**: checklist 19, 19a, 19b, 20; vitest over the pure helpers.

### Read-first

- [ ] T031 [CC] [READ] Auth helper in `inbox-ai-thread-summary`: does it resolve the user via
  `auth.getUser(token)` (server-verified) or decode the payload locally? Does it carry
  an internal-key branch? Which client does `isUserInOrganization` take? Output: exactly
  what is imported or copied; the internal-key path does not come along (R-008).
- [ ] T032 [CC] [READ] `inbox-ai-rank`: every log line on parse failure and upstream error;
  the OpenAI fetch timeout pattern. Output: lines NOT to copy (anything logging model
  output, response bodies or whole `err` objects).
- [ ] T033 [CC] [READ] `_shared/conversationText.ts`: `buildTaggedTranscript` and the
  `charCap` trim loop; `fetchConversationMessages` signature. Does the type-only `npm:`
  import resolve under vitest? If not, window logic moves to an import-free sibling
  that `conversationText.ts` re-exports.

### Edits

- [ ] T034 [CC] `conversationText.ts`: `keepHead?: number` (default 0). `keepHead` 0 path
  textually intact. Head + newest, de-duplicated, `[…]` gap line, trim from the middle.
  The loop must terminate when the head alone exceeds `charCap` (one very long first
  message): specify the behaviour in the diff (proposed: newest block empties, then the
  last head message's text is truncated to fit) and test it.
- [ ] T035 [CC] `_shared/evidenceFilter.ts` (new, no imports): `normalise`,
  `filterByEvidence`, `order_type` enum check, whitelist of the seven names with
  non-string coercion to null, **per-field length caps on `value` and a cap on returned
  `evidence`**, `dropLinkedPersonName` (runs after the filter).
  - [OPT] For `sku` and `customer_name`: normalised value must be a substring of its own
    normalised evidence (fails safe; closes "trivial quote, arbitrary value").
  - [OPT] Drop `customer_name` when its evidence sits on a line beginning `From:`. Run
    against the un-normalised transcript; `normalise` collapses newlines.
- [ ] T036 [CC] `src/modules/inbox/utils/extractOrderShared.test.ts` (new): plan.md's filter,
  window and name-guard cases, plus head-alone-over-`charCap`, length caps, and any
  [OPT] guard that was taken.
- [ ] T037 [CC] `supabase/functions/inbox-ai-extract-order/index.ts` (new). Order: CORS ->
  `getUser` -> body validation (uuid regex, 1..10 ids, de-duplicated) -> membership else
  403 (log `membership: denied`, return) -> conversations `.in().eq(organization_id)`
  -> `const ownedIds = rows.map(...)`; **body ids never referenced after this line** ->
  people query skipped when no person ids -> messages for `ownedIds` -> transcript with
  `keepHead` -> empty transcript returns all seven keys null, no model call -> OpenAI
  with an abort timeout -> filter -> name guard -> `{ fields }`. Upstream or parse
  failure: generic 502, log status and error class only. Logs: ids, counts
  (`requested`, `returned`, `messages`), ms. Never text, names, model output, `err`.
- [ ] T038 [CC] `supabase/config.toml`: pin `verify_jwt = true` for the new function;
  `supabase/CLAUDE.md` JWT table line. Same commit as T037.

### Verify, commit, deploy

- [ ] T039 [G] `deno check supabase/functions/inbox-ai-extract-order/index.ts`; gate.
- [ ] T040 [G] Reviewer subagent: no `.from(` textually precedes the membership check; body
  `conversation_ids` unreferenced after `ownedIds`; no log argument can carry message,
  model or person text.
- [ ] T041 [G] Commit by path, push, then plain `supabase functions deploy
  inbox-ai-extract-order`.
- [ ] T042 [G] Live calls:
  - **19** E2E user's JWT, random UUID as `organization_id`: 403, log shows
    `membership: denied` and nothing after it.
  - **19a** E2E user, E2E org id, one E2E conversation id plus one foreign **no-text stub**
    id: log shows `requested: 2, returned: 1`; response carries nothing from the foreign
    row. (A no-text stub exposes nothing even if the filter were wrong.)
  - **19b** anon key as bearer, no user session: 401.
- [ ] T043 [G] AC-008 decision, recorded either way: redeploy `inbox-ai-rank` on staging so
  checklist 20 exercises the new shared module, or note that the `keepHead` 0 fixture
  test is the only guard because the deployed rank bundle predates the change.
- [ ] T044 [G] Separate commit: pin `verify_jwt = false` for `inbox-ai-thread-summary` in
  `config.toml` (deployed with the flag, pin never committed).

---

## Phase C4: Client hook, apply rules, AI marks (US2, client)

**Independent test**: checklist 14-18, 16a.

- [ ] T045 [CC] [READ] Places input: does it hold internal text state that a `setValue` will
  not reach? `order_type` Radix Select: controlled from the form value? Tooltip portal
  target under the focus trap. Prediction first on each.
- [ ] T046 [CC] [P] `utils/applyPrefill.ts` + `.test.ts` (new): pure; R-005 names only; empty
  and untouched only; `order_type` first; effective Renovation omits `material` and
  `color`.
- [ ] T047 [CC] `hooks/useOrderPrefill.ts` (new): one invoke per open after first paint; ids
  captured in a ref (FR-019); once-per-open guard that also holds under StrictMode;
  result ignored after close; errors and timeouts resolve to `fields: null`, no toast.
- [ ] T048 [CC] `CreateOrderDrawer.tsx`: `prefill?` prop; apply effect via `setValue` into
  empty untouched fields; **prefill never sets `userTouched`**; `resetField` not used;
  `aiMarks` local state, mark cleared when the value departs from the applied value,
  marks reset with the form; "AI" mark with the quote in a tooltip.
- [ ] T049 [CC] `PersonOrdersPanel.tsx`: conversation ids join the open snapshot; hook
  `enabled = open && side`; pass `prefill` down.
- [ ] T050 [CC] Re-anchor the three baseline keys. T051 [G] Gate. T052 [G] Commit by path,
  push.
- [ ] T053 [G] Checklist 14-18 and 16a, naming the record per line; 20 per the T043 decision.

---

## Dependencies and execution order

- T001-T006 done. C1 edits run in a fresh CC session, manual per-edit approval, propose before apply.
- T002-T006 block their edits: T002 -> T007; T003, T006 -> T012;
  T004 -> T015; T005 -> T010. T008 is free.
- C1 -> C2 -> C3 -> C4 by commit. C3 does not depend on C2 in code, only in order. C4 needs
  C1's `userTouched` (T010) and C3's deployed function.
- Within C3: T031-T033 before T034-T037; T036 alongside T034/T035; T038 rides with T037.
- Cut order if hours are short: T016, the two [OPT] guards in T035, then T044 (move to
  backlog). Do not cut T001-T005, T031, T032, T042.

## For the C5 docs session (add to the existing list)

T001 results; T002 source-vs-browser discrepancy and its T021-2b outcome; R-011 and R-012;
D-1..D-3; tripwire 3/3 in the T004-T006 session; `saveOrderPeople`-throws caveat (backlog);
the `<DrawerOverlay />` finding (overlay's rAF restores body pointer events); latent `ghl`
ternary unmount path; backlog: in-app navigation guard for dirty forms; Explore subagent ran
live row counts outside the 2026-09-10 ruling during seeding; E2E seed fixtures
`SEED-SOF-0918` and their cleanup script (outside the repo); the T043 decision; which [OPT]
items were cut.