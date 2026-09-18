# Implementation Plan: Sidebar order form with AI prefill

**Branch**: `feature/sidebar-order-form` | **Date**: 2026-09-18 | **Spec**: `specs/sidebar-order-form/spec.md`
**Input**: Feature specification from `specs/sidebar-order-form/spec.md`
**Phase 0 record**: `~/.claude/plans/write-specs-sidebar-order-form-plan-md-f-indexed-bengio.md`
(results folded into the spec's Assumptions section; no separate `research.md`).

## Summary

`CreateOrderDrawer` gains a `presentation` prop. From the inbox at >= 1280px it opens as a
440px right-docked, overlay-free vaul drawer; the inbox grid's right track widens to
match and the conversation list collapses transiently, so the conversation stays
readable beside the form. The form is bound to the person/job it was opened for (R-003).
The side host uses a relaxed schema (`sku`, `location` optional). On open, one call to a
new JWT-only edge function `inbox-ai-extract-order` returns up to seven fields, each with
an evidence quote verified server-side against the transcript; the client fills only
empty, untouched fields and marks them. No migration, no table, no cache.

Rulings R-001..R-010 are settled. Four code commits C1-C4; C5 (docs) is a separate
session.

## Technical Context

**Language/Version**: TypeScript (React 18, Vite SWC); Deno for edge functions
**Primary Dependencies**: vaul 0.9.9, Radix Dialog 1.1.2, React Hook Form + Zod, TanStack Query, `npm:@supabase/supabase-js@2.49.4` (edge), OpenAI gpt-4o-mini JSON mode (mirrors `inbox-ai-rank`)
**Storage**: none new (AC-001). Reads `inbox_conversations`, `inbox_messages`; writes nothing
**Testing**: vitest (`npm run gate:unit`); `deno check` for the edge function (tsc never sees `supabase/functions`); browser verify on staging, E2E org only
**Target Platform**: desktop web; side presentation >= 1280px, modal below
**Project Type**: web application (SPA + Supabase edge functions)
**Performance Goals**: form interactive at first paint; extraction is non-blocking and fires after it (FR-016)
**Constraints**: default presentation DOM/classes byte-identical (FR-001, AC-002); `inbox-ai-rank` and `inbox-ai-thread-summary` behaviour unchanged (AC-008); logs carry ids/counts/durations only (FR-015)
**Scale/Scope**: 4 commits; 6 existing files edited, ~6 new files

## Constitution Check

- **Dual router constraint**: no routing change. Pass.
- **Module boundaries**: inbox hosts; orders owns the drawer and schema. The inbox
  already imports `CreateOrderDrawer` (`PersonOrdersPanel.tsx:10`); the new schema export
  goes through the same path. The one shared-UI touch (`ui/drawer.tsx`) is prop-gated
  with the default untouched. Pass.
- **Supabase + RLS**: new function uses service role, so tenant scoping is explicit in
  code: JWT -> `isUserInOrganization` -> `.eq('organization_id', …)` on every read
  (FR-011). Pass.
- **Secrets**: OpenAI key stays in the edge function. Pass.
- **Additive-first**: everything additive; R-004 is reversible by one line (resolver). Pass.

## Known v1 limitation (A1 ruling, 2026-09-18)

vaul 0.9.9 does not forward `modal` to Radix `Dialog.Root`. With `modal={false}` there is
no overlay, no scroll lock and no outside-pointer dismiss, but Radix still renders
`DialogContentModal`: focus is trapped in the form and the rest of the page is
`aria-hidden` while it is open. Scrolling, selecting text, copying and clicking buttons
in the conversation work; typing in the reply composer or inbox search does not until
the form closes. Accepted. C5 adds the findings line.

## Project Structure

### Documentation (this feature)

```text
specs/sidebar-order-form/
├── spec.md
├── plan.md      # this file
└── tasks.md     # /tasks output, after Giorgi reads this plan
```

### Source Code

```text
src/shared/components/ui/drawer.tsx                      # C1  edit
src/modules/orders/components/CreateOrderDrawer.tsx      # C1, C2, C4  edit
src/modules/inbox/components/PersonOrdersPanel.tsx       # C1, C2(prop only if needed), C4  edit
src/modules/inbox/pages/UnifiedInboxPage.tsx             # C1  edit
src/modules/inbox/hooks/useMinWidth.ts                   # C1  new (matchMedia 1280)
src/modules/orders/schemas/order.schema.ts               # C2  edit (append)
src/modules/orders/schemas/order.schema.test.ts          # C2  new
supabase/functions/_shared/conversationText.ts           # C3  edit
supabase/functions/_shared/evidenceFilter.ts             # C3  new (pure, no imports)
supabase/functions/inbox-ai-extract-order/index.ts       # C3  new
src/modules/inbox/utils/extractOrderShared.test.ts       # C3  new (vitest over the two pure helpers)
src/modules/inbox/hooks/useOrderPrefill.ts               # C4  new
src/modules/inbox/utils/applyPrefill.ts (+ .test.ts)     # C4  new
```

**Structure Decision**: existing module layout; no new module. Pure logic (evidence
filter, head+newest window, apply rules) lives in import-free files so vitest can cover
it; `conversationText.ts` has a type-only `npm:` import, which vitest erases - if it
does not resolve under vitest, the window logic moves to an import-free sibling and
`conversationText.ts` re-exports it (decide at C3, not before).

## tsc baseline keys in play

From `specs/inbox-sidebar-multi-tabs/tsc-baseline-items.txt`, grepped per file 2026-09-18:

| File | Baseline keys |
|---|---|
| `CreateOrderDrawer.tsx` | `(289,17)` TS2345, `(291,59)` TS2322, `(474,27)` TS2322 |
| `PersonOrdersPanel.tsx`, `UnifiedInboxPage.tsx`, `ui/drawer.tsx`, `order.schema.ts` | none |
| `useInboxConversations.ts` | `(158,34)`, `(193,34)` - file not touched by this feature |

Any edit above `:289` in `CreateOrderDrawer.tsx` shifts all three keys; edits between
`:291` and `:474` shift the third only. Each commit below re-anchors in the same commit
(AC-007); exact new line numbers are stated per diff at /implement, not here.

## Commits

### C1 - Presentation, layout, lifecycle

Files and edits:

| File | Edit |
|---|---|
| `ui/drawer.tsx:76-101` | `DrawerContent` gains `side?: boolean` (default false). When true: no `<DrawerOverlay />`, wrapper div at `:85` becomes `fixed inset-y-0 right-0 z-50 flex pointer-events-none` (no centring, no padding), content drops the centred-modal size/radius classes for `h-full w-[440px] rounded-none border-l`, drag-handle div `:95` omitted. False branch keeps today's JSX verbatim. |
| `CreateOrderDrawer.tsx:39` | Props gain `presentation?: 'modal' \| 'side'` (default `'modal'`). |
| `CreateOrderDrawer.tsx` (Drawer root) | Side: `direction="right"`, `modal={false}`, `dismissible` only via Esc/close control; `<DrawerContent side>`. Modal: unchanged props. |
| `CreateOrderDrawer.tsx:489, :624, :758` | The three `md:grid-cols-*` classes become conditional: side -> `grid-cols-1`, modal -> today's literal string. |
| `CreateOrderDrawer.tsx` | Expose dirty state upward: `onDirtyChange?: (dirty: boolean) => void` fed from `formState.isDirty` (needed for R-003 confirm). |
| `hooks/useMinWidth.ts` (new) | `useMinWidth(px)`: `matchMedia('(min-width: …px)')` with change listener; SSR-free, initial value read synchronously. |
| `PersonOrdersPanel.tsx:28` | Props gain `onOrderFormOpenChange?: (open: boolean) => void`. |
| `PersonOrdersPanel.tsx` | `const isWide = useMinWidth(1280)`; presentation = `isWide ? 'side' : 'modal'`, fixed at open (a resize while open does not swap presentation). |
| `PersonOrdersPanel.tsx` | On "New order": snapshot `{ personId, jobId, email, phone }` into state. `CreateOrderDrawer` reads `initial*` from the snapshot, not from live `effectiveJob` / `person`. |
| `PersonOrdersPanel.tsx:249 / :381` | `CreateOrderDrawer` JSX is hoisted so both the early-return branch and the main return render it (one element, same position in a wrapping fragment, so React keeps the instance). Other drawers stay where they are. |
| `PersonOrdersPanel.tsx` | Person-change effect: live `personId` non-null and != snapshot.personId -> dirty ? open confirm (Discard / Keep editing) : close. Live `personId` null -> do nothing (pending). "Keep editing" leaves the form open and bound to the snapshot. |
| `PersonOrdersPanel.tsx` | Effect reports `orderDrawerOpen && presentation === 'side'` through `onOrderFormOpenChange`; reports false on unmount. |
| `UnifiedInboxPage.tsx:189-199` | `const [orderFormOpen, setOrderFormOpen] = useState(false)`; `effectiveLeftCollapsed` becomes `… && (leftCollapsed \|\| orderFormOpen)`. `leftCollapsed` state and the `:245` localStorage write are not touched, so the stored preference is never written by the form. |
| `UnifiedInboxPage.tsx:1218-1225` | New first branch when `orderFormOpen`: `xl:grid-cols-[56px_minmax(0,1fr)_440px]` (1280 = Tailwind `xl`, so one class covers it). Existing four strings unchanged. |
| `UnifiedInboxPage.tsx:190-200, :274-282` | While `orderFormOpen`, the right column is treated as expanded and the orders-count auto-collapse is skipped (edge case 2 in the spec). |
| `UnifiedInboxPage.tsx:1428` | Pass `onOrderFormOpenChange={setOrderFormOpen}`. |

tsc baseline keys expected to move: all three `CreateOrderDrawer.tsx` keys shift down
(prop + destructure added above `:289`; grid conditionals may add lines before `:474`).
Message text unchanged. No new keys expected elsewhere.

Tests: `useMinWidth` unit test with a stubbed `matchMedia` (initial value, change
event). Lifecycle logic is effect-bound; covered by the browser checklist, not unit
tests.

What could go wrong:
- Hoisting the drawer changes its position in the tree -> remount on the `:249`
  transition anyway. The element must sit at the same index under the same parent type
  in both branches; verify with the same-person switch check.
- `pointer-events-none` on the side wrapper but vaul/Radix also set body
  `pointer-events` transiently (one rAF); if a click lands in that frame it is lost.
  Cosmetic.
- Select / Places popovers (FR-006) portal to `body`; with `aria-hidden` siblings and
  the focus trap still on, Radix Select works today inside the modal for the same
  reason - but the Google Places `.pac-container` is outside the trapped scope. It
  works in the modal today under the same trap, so expected fine; on the checklist.
- The default branch of `DrawerContent` is shared by every drawer in the app. The diff
  must leave the false branch textually identical; reviewer checks this.
- Transient collapse fights `layoutReady` / mobile guards at `:199`; the OR goes inside
  the existing `layoutReady && !isMobile` conjunction.
- Snapshotting email/phone means a contact edit made while the form is open is not
  reflected. Accepted by R-003.
- Dirty confirm while focus is trapped: the confirm must be an AlertDialog rendered
  above the drawer (z-index > 50), or it is unreachable.

### C2 - Side-host schema

| File | Edit |
|---|---|
| `order.schema.ts` (append after `:94`) | `export const orderFormSideSchema = orderFormSchema.extend({ sku: z.string(), location: z.string() })` - drops only `min(1)`; stays `string`, so `OrderFormData` is unchanged and `CreateOrderDrawer.tsx:223-224` `.trim()` + `'' -> null` coercion needs no edit. |
| `CreateOrderDrawer.tsx:121` | `resolver: zodResolver(presentation === 'side' ? orderFormSideSchema : orderFormSchema)`. |
| `CreateOrderDrawer.tsx` (labels) | Required star on Grave Number and Location hidden in side presentation. |
| `order.schema.test.ts` (new) | Side schema accepts `''` for both; base schema still rejects both; `order_type` required in both. |

`orderFormSchema` is a `z.object` with the refine on the inner `order_people` field, not
on the object, so `.extend` is available. If that turns out false at /implement, fall
back to rebuilding via `.omit().merge()`; stop and report first.

tsc baseline keys expected to move: none if the resolver edit is line-neutral and the
import gains no line (extend the existing import). If the star edits add lines above
`:474`, that key shifts. Message text of `(289,17)` unchanged (types still `string`).

What could go wrong:
- Resolver chosen from a prop at first render; presentation is fixed per open, and
  `useOnDrawerReset` remounts content per open, so no stale resolver. If the form
  instance is created above the reset key, a modal->side change between opens keeps the
  old resolver - check where `useForm` sits relative to `key={resetKey}`.
- First null-`sku` rows reach production. Readers verified null-safe (A5). Accepted
  consequence: `EditOrderDrawer` requires Grave Number on save (backlog).
- R-010: flag to Arin is Giorgi's call; not blocking.

### C3 - `keepHead`, `inbox-ai-extract-order`, evidence filter

| File | Edit |
|---|---|
| `_shared/conversationText.ts:28-33` | `TranscriptOptions` gains `keepHead?: number` (default 0). |
| `_shared/conversationText.ts:97-114` | `buildTaggedTranscript`: when `keepHead > 0`, keep the first `keepHead` messages plus the newest `maxMessages - keepHead`, de-duplicated, with a `[…]` gap line; the `charCap` trim loop drops from the middle (oldest of the newest block) instead of the front. `keepHead` 0 takes today's code path unchanged. |
| `_shared/evidenceFilter.ts` (new) | `normalise(s)`: lowercase, collapse whitespace. `filterByEvidence(fields, transcript)`: null any field whose normalised `evidence` is empty or not a substring of the normalised transcript. Also nulls `order_type` values outside the two enum literals. No imports. |
| `inbox-ai-extract-order/index.ts` (new) | `Deno.serve`: CORS/OPTIONS -> JWT user (same helper as F-035 in `inbox-ai-thread-summary`) -> validate body (`organization_id` uuid, `conversation_ids` 1..10 uuids) -> `isUserInOrganization` else 403 -> conversations `.in('id', ids).eq('organization_id', org)` -> `fetchConversationMessages` for returned rows only -> transcript (`keepHead`) -> empty transcript returns all-null without a model call -> gpt-4o-mini JSON mode, low temperature -> `filterByEvidence` -> `{ fields }` for the seven R-005 names. Logs: ids, counts, ms. No internal-key path (R-008). |
| `extractOrderShared.test.ts` (new) | Filter: exact, case/whitespace variants pass; fabricated quote, empty quote, bad `order_type` dropped. Window: `keepHead` 0 output equals today's for a fixture; head survives `charCap`; no duplicate when thread shorter than `maxMessages`. |

Prompt rules to encode: `customer_name` is the deceased, never the sender; lines
beginning `From:`, `Email:`, `Phone:` in web-enquiry messages describe the customer.
Evidence must be a verbatim span.

tsc baseline keys expected to move: none (tsc does not see `supabase/functions`; the new
vitest file is under `src/` and must be error-free). Gate for the function is
`deno check` by Giorgi; new file, so the expectation is zero errors.

Deploy (Giorgi): commit and push first, then plain
`supabase functions deploy inbox-ai-extract-order` - `verify_jwt` on, no flag. Add the
line to `supabase/CLAUDE.md` JWT table in the same commit.

What could go wrong:
- `keepHead` default path drifts and changes `inbox-ai-rank` prompts (AC-008). The
  `keepHead` 0 fixture test is the guard; the diff must leave the existing branch
  textually intact.
- Web-enquiry message (spec A6 correction): its `From:` line is a verbatim span, so the
  evidence guard alone will not stop the customer's name landing in `customer_name`.
  Prompt rule above is the only defence in v1; on the checklist.
- Evidence check is substring-only: a correct value with a paraphrased quote is dropped
  (fails safe). A wrong value with a real quote passes - the guard proves the quote
  exists, not that the value follows from it. UI shows the quote for that reason.
- Membership check placed after any read = F-035 class bug. Order of operations is the
  review focus.
- Model returns extra keys or non-string values: whitelist the seven names, coerce or
  null.
- `conversation_ids` are list-derived and can be search-filtered on the client
  (`PersonOrdersPanel.tsx:73` comment): extraction may see a subset. Accepted in v1;
  C4 sends what the panel has.

### C4 - Client hook, apply rules, AI marks

| File | Edit |
|---|---|
| `hooks/useOrderPrefill.ts` (new) | `useOrderPrefill({ enabled, organizationId, conversationIds })`: one `supabase.functions.invoke('inbox-ai-extract-order')` per open, fired in an effect after first paint; ids captured in a ref at open (FR-019: the array is never an effect dependency); abort/ignore on close; returns `{ status, fields }`. Errors and timeouts resolve to `fields: null`, no toast. |
| `utils/applyPrefill.ts` (new) | Pure: given extracted fields, current values and `dirtyFields`, return the entries to apply - only R-005 names, only where current value is empty and the field is not dirty. |
| `utils/applyPrefill.test.ts` (new) | Empty+clean applied; typed-before-return skipped; non-R-005 key ignored; null field ignored. |
| `CreateOrderDrawer.tsx` | Props gain `prefill?: { fields, status }`. Effect applies via `setValue(name, value, { shouldDirty: false })`; keeps `aiMarks: Record<name, evidence>` in local state; mark cleared when the field's value departs from the applied value; marks reset with the form. Small "AI" mark beside the label with the quote in a tooltip. |
| `PersonOrdersPanel.tsx` | Calls `useOrderPrefill` with `enabled = open && side`, passes `prefill` down; conversation ids snapshotted at open with the rest of the R-003 snapshot. |

tsc baseline keys expected to move: all three `CreateOrderDrawer.tsx` keys shift again
(prop, state and effect land above `:289`; marks in JSX may land above `:474`).

What could go wrong:
- `shouldDirty: false` values still differ from `defaultValues`, so RHF can flip
  `isDirty` on the next unrelated change and R-003 will prompt on a form the user never
  typed in. Arguably correct (there is content to lose); confirm on the checklist and
  rule if not wanted.
- `order_type` is a Radix Select and `location` is the Places input: `setValue` must
  reach their controlled values; Places may hold its own internal text state. Verify
  both render the prefilled value.
- Prefilled `location` carries no lat/lng (never prefilled). Same as a typed-not-picked
  location today.
- Selecting a product overwrites `value`; prefill never touches product or value, so no
  interaction - but `material` / `color` may be overwritten by product selection after
  prefill; the mark must clear when that happens (value departs from applied value).
- Tooltip inside a focus-trapped, non-modal drawer: portal target must not be
  `aria-hidden`-blocked for pointer hover. Radix Tooltip works in the modal today.
- React StrictMode double effect in dev fires two calls; guard with the ref so
  "once per open" holds in dev too.

## Browser-verify checklist (staging, E2E org only, Giorgi or Playwright MCP)

Name the record checked for each line when reporting.

Presentation (C1)
1. >= 1280px, active job selected, "New order": form docks right, no overlay,
   conversation reflows beside it, conversation list collapses.
2. With the side form open: scroll the conversation; select text in a message, Ctrl+C,
   click into a form field, paste - text arrives.
3. Same-person thread switch (conversations view, uncached row) with a typed draft: the
   draft is still there, still bound to the original job.
4. Different-person switch with a dirty form: Discard / Keep editing prompt. Keep
   editing -> form intact. Discard -> form closes, grid and list restore.
5. Different-person switch with a clean form: closes silently.
6. Close and save both restore the grid and the list; reload - the stored
   `inbox.desktop.leftCollapsed` value is what it was before opening.
7. Person with zero orders: right column does not auto-collapse under the open form.
8. Viewport 1279px: "New order" opens today's modal. 1280px: side.
9. Select and Places popovers open and are usable inside the side drawer; grids are
   single-column.
10. Orders page, Invoice sidebar, Expanded invoice orders: Create Order looks and
    behaves as before. One other drawer in the app (any) still centred with overlay.
11. Known limitation observed, not a failure: reply composer cannot take focus while the
    form is open.

Schema (C2)
12. Side form, no location and no grave number, other requirements met: order is
    created; row has null `sku` and `location`.
13. Modal (1279px or Orders page): both still required.

Extraction (C3, C4)
14. Thread stating deceased name, cemetery and grave number: the three arrive prefilled,
    marked, each tooltip shows the matching quote.
15. Type into a field before extraction returns: not overwritten.
16. Edit a marked field: mark clears.
17. Thread with a web-enquiry message: `customer_name` is not the `From:` name.
18. No-text conversation (GHL stub) and a forced failure (offline / bad id): form stays
    empty and usable, no blocking error.
19. Non-member JWT (E2E user's token against an `organization_id` it does not belong to
    - use a test org id, never a live org) calls `inbox-ai-extract-order`: 403, and the
    function log shows no conversation read. Authenticated call: Giorgi runs it.
20. `inbox-ai-rank` sweep still runs and ranks as before (AC-008).

## Gates per commit (Giorgi runs)

`npm run gate` (tsc item-diff by key, lint, build, vitest). C3 additionally:
`deno check supabase/functions/inbox-ai-extract-order/index.ts`. Lint target: no new
errors or warnings over the current accepted counts.

## C5 (separate session)

Handoff: the three tripwire overrides (two from the investigation session, one from
Phase 0). Findings: vaul 0.9.9 does not forward `modal` to Radix; Phase 0 A6 missed the
`trg_sync_enquiry_to_inbox` trigger because only Mason migrations were grepped (rule
already in `supabase/CLAUDE.md`: grep both repos); dormant `inbox_enquiry_extraction`
table; stale nav width at `docs/backlog.md:227`. Backlog: `EditOrderDrawer` Grave
Number on null-`sku` orders; structured `enquiries.details` as a prefill source;
`conversation_ids` subset under search filter.

## Complexity Tracking

No constitution violations.
