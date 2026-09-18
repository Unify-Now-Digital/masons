# Feature Specification: Sidebar order form with AI prefill

**Branch**: `feature/sidebar-order-form`
**Created**: 2026-09-18
**Status**: Draft
**Input**: Arin: "the order form should open in the right sidebar so the conversation
stays visible while filling it in, with AI prefilling what it can from the messages."
**Investigation**: `~/.claude/plans/read-only-investigation-code-and-golden-hickey.md`
(Q1-Q8, two tripwire overrides, both to be logged in handoff).

## Context

Creating an order from the inbox works today, but `CreateOrderDrawer` is a vaul Drawer
styled as a centred modal: it covers the conversation the user is reading the details
from. The only inbox entry point is `PersonOrdersPanel` ("New order", active selected
job). Nothing is prefilled from messages; person, email, phone and job are passed in.

## Rulings (settled - do not re-open)

- **R-001 Host.** `CreateOrderDrawer` stays one component. It gains
  `presentation?: 'modal' | 'side'` (default `'modal'`). The inbox passes `'side'`:
  docked right, no overlay, non-modal. The form body is NOT extracted.
- **R-002 Layout.** Side drawer ~440px. While open, the inbox grid's right track widens
  to the drawer width so the conversation reflows and is never covered. The conversation
  list collapses transiently while the form is open; the persisted
  `inbox.desktop.leftCollapsed` value is not written. Side presentation applies at
  viewport >= 1280px, decided by the inbox's own `matchMedia('(min-width: 1280px)')`
  check (`useIsMobile` breaks at 768 and is not usable here). Below 1280px the inbox
  uses `'modal'`. Presentation is snapshotted at open together with person/job
  (R-003); a resize across 1280px while the form is open does not swap it. In side
  presentation the form's `md:` grids render single-column via the
  prop (viewport breakpoints do not apply inside a 440px panel).
- **R-003 Person-bound.** The open form belongs to the person/job it was opened for.
  Switching threads of the same person keeps it. Switching to a different person:
  dirty form -> confirm (Discard / Keep editing); clean form -> closes silently.
  The drawer is rendered in `PersonOrdersPanel` outside the `:249` early return.
  Person, job, email and phone are snapshotted at open and read from the snapshot,
  not from live props. A null live `personId` while the conversation detail query is
  pending is "pending", not a different person. The panel reports its open state to
  the page via callback, which drives the grid track and the list collapse.
  "Dirty" means user input only: a form holding nothing but AI-prefilled values the
  user has not touched is clean and closes silently on a person switch.
- **R-004 Required fields.** Side presentation uses a relaxed schema: `location`
  optional, `sku` (Grave Number) optional subject to AC-006. `order_type` stays
  required. Other hosts keep `orderFormSchema` unchanged. No "incomplete" column, no
  migration. Deceased Name star is untouched (backlog).
- **R-005 Prefill field set (seven).** `customer_name` (deceased name, Mason
  convention), `location`, `sku`, `order_type`, `material`, `color`,
  `inscription_text`. Never prefilled: `notes`, any money field, `product_id`,
  permit fields, option rows, `inscription_layout`, `inscription_additional`,
  `inscription_font`.
- **R-006 Evidence guard.** Every extracted field carries an `evidence` quote. The
  server drops any field whose quote is not found in the transcript (whitespace- and
  case-normalised). The UI shows the quote on the AI mark.
- **R-007 Extraction is on demand.** One call when the side form opens. No cache, no
  table, no migration, no backfill. Rank and extraction stay separate LLM calls.
- **R-008 Auth.** New function accepts user JWT only (no internal-key path), so it
  deploys with `verify_jwt` on. Membership is checked before any read.
- **R-009 Model.** Mirror `inbox-ai-rank`: gpt-4o-mini, JSON mode, low temperature.
- **R-010 Arin.** R-004 is a demo-surface change: flagged to Arin, reversible by one
  line. Not blocking.

## User Stories

### US1 - Fill the order form beside the conversation (P1)

Staff reading a customer's messages click "New order"; the form opens on the right and
the conversation stays readable and scrollable next to it.

1. **Given** a desktop inbox (>= 1280px) with an active job selected, **when** "New order"
   is clicked, **then** the form opens docked right with no overlay, the conversation
   reflows beside it, and the conversation list collapses.
2. **Given** the side form is open, **when** the user scrolls or selects text in the
   conversation, **then** it responds normally and the form keeps its state.
3. **Given** the side form is open, **when** the order is saved or the form is closed,
   **then** the grid and the conversation list return to their prior state and the
   stored collapse preference is unchanged.
4. **Given** a viewport below 1280px, **when** "New order" is clicked, **then** today's
   modal opens.
5. **Given** Orders, Invoice sidebar or Expanded invoice orders, **when** Create Order
   is opened, **then** behaviour is identical to today.

### US2 - AI prefill from the messages (P1)

1. **Given** the side form opens for a person with message text, **when** extraction
   returns, **then** empty untouched fields from R-005 are filled and visibly marked.
2. **Given** the user typed into a field before extraction returned, **then** that field
   is not overwritten.
3. **Given** an AI-marked field, **when** the user hovers the mark, **then** the
   evidence quote is shown; **when** the user edits the field, **then** the mark clears.
4. **Given** extraction fails, times out, or finds nothing, **then** the form stays
   empty and usable with no blocking error.
5. **Given** a conversation with no message text (GHL stubs), **then** no fields are
   filled and the form works.

### US3 - Create an order before all details are known (P2)

1. **Given** the side form with no location (and, subject to AC-006, no grave number),
   **when** the user submits with the other requirements met, **then** the order is
   created.
2. **Given** the modal presentation anywhere, **then** `sku` and `location` remain
   required exactly as today.

### Edge cases

- Person switched while the form is dirty / clean (R-003).
- Right column auto-collapse rule (order count 0) must not hide or unmount the side
  form; the panel's early return (`PersonOrdersPanel.tsx:249`) must not drop a draft
  on a same-person thread switch.
- Selecting a product overwrites `value`: prefill never touches product or value.
- Very long threads: first messages must survive the transcript cap (FR-012).
- Caller not a member of the organisation: 403, nothing read.

## Functional Requirements

**Presentation**
- **FR-001** `CreateOrderDrawer` accepts `presentation`; default preserves today's DOM,
  classes and behaviour.
- **FR-002** Side presentation: `direction="right"`, non-modal, no overlay, outside
  pointer events do not dismiss; Esc and the close control do.
- **FR-003** Inbox grid right track equals the drawer width while the side form is open.
- **FR-004** Conversation list collapse is transient and restored on close.
- **FR-005** Form grids are single-column in side presentation.
- **FR-006** Select and Places popovers are usable inside the side drawer.
- **FR-007** Person-bound lifecycle per R-003.
- **FR-008** Existing reset (`useOnDrawerReset`) and the four success exits keep
  working in both presentations.

**Schema**
- **FR-009** A side-host schema derived from `orderFormSchema` with `location` optional
  and `sku` optional (AC-006). `EditOrderDrawer`, `OrderFormInline`,
  `CreateInvoiceDrawer` are unaffected.

**Extraction**
- **FR-010** Edge function `inbox-ai-extract-order`. Request:
  `{ organization_id, conversation_ids[] }` (max 10 ids).
- **FR-011** Order of operations: authenticate JWT -> `isUserInOrganization(user,
  organization_id)` else 403 -> load conversations with
  `.in('id', ids).eq('organization_id', organization_id)` -> messages only for the
  rows returned. Ids outside the organisation are silently ignored.
- **FR-012** `_shared/conversationText.ts`: `TranscriptOptions` gains `keepHead?: number`
  (default 0 = today's behaviour). Extraction uses head + newest so opening messages
  survive `charCap`. `inbox-ai-rank` output is unchanged.
- **FR-013** Response: `{ fields: { [name]: { value, evidence } | null } }` for the seven
  R-005 names only. `order_type` is one of the two existing enum values or null.
- **FR-014** Evidence filter per R-006 runs server-side, after the model call.
- **FR-014a** After the evidence filter, `customer_name` is dropped when it equals
  (case- and whitespace-normalised) the full name of any person linked to the
  conversations read (`inbox_conversations.person_id` -> `people`, same
  `organization_id` guard). The customer is never the deceased by default. Person
  names are never logged (FR-015).
- **FR-015** Logs carry ids, counts and durations only. No message or model text.

**Client**
- **FR-016** Extraction fires once per side-form open, after first paint.
- **FR-017** Values are applied only to fields that are empty and not dirty, without
  marking the form dirty by themselves.
- **FR-018** AI marks are local UI state; cleared on edit; never persisted.
- **FR-019** No array with a fresh-`[]` default is used as an effect dependency in the
  prefill path.

## Architectural Constraints

- **AC-001** No migration, no new table, no new column.
- **AC-002** Other Create Order entry points are not edited beyond what the default
  prop value requires (nothing).
- **AC-003** Edge function: committed before deploy; CLI deploy by Giorgi; plain deploy
  (`verify_jwt` on); `npm:@supabase/supabase-js@2.49.4` specifier.
- **AC-004** All live calls, deploys and git operations are Giorgi's. CC: code and
  catalog only, per-edit approval.
- **AC-005** Runtime verification on the E2E org only.
- **AC-006** `sku` relaxation gate. Live data has zero null-`sku` orders (2026-09-18),
  so null is a new state. Phase 0 lists every reader of `orders.sku` in Mason and
  `../SearsMelvin` with its null behaviour. If any reader breaks on null and cannot
  be fixed in one small edit, v1 relaxes `location` only. (`location` already has 9
  null rows in SM - tolerated.)
  **RESOLVED 2026-09-18: relax `sku` and `location`.** All readers in Mason, the edge
  functions and `../SearsMelvin` are null-safe; zero reader edits. Accepted
  consequence (backlog): `EditOrderDrawer` keeps `orderFormSchema`, so saving an edit
  of a null-`sku` order requires Grave Number.
- **AC-007** tsc baseline keys that move are re-anchored in the same commit.
- **AC-008** `inbox-ai-rank` and `inbox-ai-thread-summary` behaviour unchanged.
- **AC-009** Prefill writes deceased name to `customer_name` (Mason convention). F-040
  is not addressed here.

## Assumptions (verify first, Phase 0, read-only)

1. The installed vaul version supports `direction="right"` with `modal={false}` and
   does not dismiss on outside pointer down.
   - **Phase 0 results:** holds (vaul 0.9.9). No outside-pointer dismiss; no overlay and
     no scroll lock when `modal={false}`. Limitation: vaul 0.9.9 does not forward
     `modal` to Radix `Dialog.Root`, so Radix still traps focus and sets `aria-hidden`
     on the rest of the page. Scroll, text selection and clicks outside work; inputs
     outside the form (reply composer, search) cannot hold focus while it is open.
     Ruled PASS, known v1 limitation, findings line at C5. `ui/drawer.tsx:85` centring
     div needs a prop-gated side variant (default DOM untouched).
2. Count and location of `md:` grid sites in `CreateOrderDrawer.tsx`.
   - **Phase 0 results:** three: `:489` (`md:grid-cols-3`), `:624`, `:758`
     (`md:grid-cols-2`). No other responsive class in the file or its form children.
3. Whether `PersonOrdersPanel.tsx:249` fires on a same-person thread switch.
   - **Phase 0 results:** yes, in the conversations view (uncached row click ->
     `personId` null while `useConversation` loads -> `:249` -> drawer at `:381`
     unmounts), and transiently via AI-panel/deep-link select in the customers view.
     `initialJobId` is live and `selectedJobId` resets on every thread switch. Drives
     the R-003 render-site, snapshot and pending rules.
4. Actual track widths at `lg` / `xl` with the list collapsed, to confirm ~440px leaves
   a readable conversation column.
   - **Phase 0 results:** inbox is full-bleed, grid `gap-0`; app nav is 56/192px.
     Conversation column with list rail 56 + drawer 440: 1280 -> ~590 (nav open) /
     ~726 (nav collapsed); 1024 -> ~334 / ~470. 440px is workable; the 1024 worst case
     is why R-002 sets the side threshold at 1280px. `useIsMobile` is 768: not usable.
5. Readers of `orders.sku` (AC-006).
   - **Phase 0 results:** every reader in Mason `src/`, four edge functions, the orders
     view and `../SearsMelvin` is null-safe; the portal already writes null
     (`partner-orders.js:479`). Relax `sku` and `location`. See AC-006.
6. Whether web-form enquiries appear as an inbound message in the conversation (if so
   extraction sees them; if not, structured enquiry data stays a backlog item).
   - **Phase 0 results:** recorded as NO (Mason migrations and portal code show no
     inbox write). **Corrected at plan time (catalog, 2026-09-18): YES.**
     `trg_sync_enquiry_to_inbox` on `enquiries` (enabled; defined in the SearsMelvin
     repo's migrations, which Phase 0 did not grep) calls `create_inbox_from_enquiry`,
     which inserts a `web`-channel conversation linked to the person plus one inbound
     message whose `body_text` holds intake label, From/Email/Phone, Page, Location
     and the free-text message. `enquiries.details` goes to `meta` only, not
     `body_text`. So extraction sees the enquiry's location and message when the web
     conversation is among the ids sent; structured `details` stays backlog. The
     "From:" line is the customer, not the deceased - see plan.md C3 risks.

## Out of scope

Structured enquiry/quote data as a prefill source (`jobs.enquiry_id` not plumbed);
Deceased Name star; person-keyed jobs probe invalidation; F-040 naming; the
`CustomerConversationView` render loop (separate fix: stable empty array in
`useInboxMessages.ts`); caching of extractions; mobile side presentation.

## Commit order

- **C1** `presentation` prop, side layout, grid reflow, transient list collapse,
  person-bound lifecycle.
- **C2** Side-host schema (per AC-006 outcome).
- **C3** `keepHead` in shared module + `inbox-ai-extract-order` + evidence filter
  (unit tests for the filter and the head+newest window).
- **C4** Client hook, apply rules, AI marks.
- **C5** Docs (separate session): handoff incl. both tripwire overrides, findings,
  backlog.

## Success Criteria

- Order created from the inbox with the conversation visible the whole time.
- With a thread that states deceased name, cemetery and grave number, those three
  arrive prefilled with correct evidence quotes.
- No field is ever filled without a matching quote in the transcript.
- A non-member JWT gets 403 from the new function.
- Gate green: tsc item-diff, build, lint, tests.