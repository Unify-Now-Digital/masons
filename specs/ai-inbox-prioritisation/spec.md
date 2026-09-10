# Feature Specification: AI Inbox Prioritisation v1

**Feature Branch**: `feature/ai-inbox-prioritisation`
**Created**: 2026-09-10
**Status**: Implemented on feature branch 2026-09-10, staging merge pending
**Input**: Arin (call + WhatsApp, 2026-09): rank inbox conversations by recent message content — "no formula, throw the text at the AI" — shown in the inbox, account-wide; the contact/conversation is the object (order/invoice later); "doesn't have to be perfect"; "we might not even need the numbers"; filtering by type (sales only) is a maybe. Per-page plans and per-user-by-role explicitly deferred. Giorgi (2026-09-10): surface it through a floating AI button that opens a page-scoped panel, without touching the existing conversation list UI; the button is the host for future page-specific AI panels.

**Investigation**: read-only report 2026-09-10 (`read-only-investigation-ai-gentle-sketch.md`, Areas A–E) plus Q1/Q2 follow-up (last_message_at direction semantics; SearsMelvin cross-repo readers). Rulings from that report are recorded under **Rulings** below and are not re-argued here.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every rankable conversation carries a priority and a reason (Priority: P1)

Each open conversation that has message text is scored by the AI from its recent messages and stores a priority (0–100), a one-line staff-readable reason, a category, and the time it was scored. Conversations without any message text are never scored and carry nothing.

**Why this priority**: This is the asset every other story reads. It is verifiable on its own through a database read and the operator backfill, before any UI exists, and it is the half that has cost and correctness risk.

**Independent Test**: Run the operator backfill for Sears Melvin until it returns zero rows; read back the conversation table. Every open conversation with ≥1 non-empty message body has a non-null priority, a non-empty reason, a scored-at timestamp; every conversation with no message text has nulls. Spot-read ten reasons against their threads — each reason must be about that thread.

**Acceptance Scenarios**:

1. **Given** an open SM conversation with message text and no score, **When** a rank sweep runs, **Then** it stores priority 0–100, a reason ≤120 characters, a category from the allowed set, and scored-at = the sweep time.
2. **Given** an open conversation with zero message rows or only empty bodies, **When** a sweep runs, **Then** it is not selected and its rank fields stay null.
3. **Given** the AI returns invalid JSON or an out-of-range priority, **When** the sweep processes that conversation, **Then** nothing is written for it and its previous scored-at value is restored so it is retried on a later sweep.
4. **Given** a sweep that has selected a batch, **When** a second sweep starts concurrently (another staff member loads the inbox), **Then** no conversation is scored twice in that window.

---

### User Story 2 - Staff open the "Needs attention" panel from the AI button (Priority: P2)

On the inbox, a floating AI button sits in the corner with a small count of High-priority conversations. Clicking it opens a panel listing the conversations that most need action, highest first, each with who it is, a High/Medium badge, the one-line reason, and how long since the last message. Clicking an item opens that conversation in the inbox and closes the panel. The existing conversation list is untouched.

**Why this priority**: This is what Arin asked to see. It depends on Story 1 data and on nothing else in this feature, and it lands without editing any file Arin's branch touches.

**Independent Test**: With Story 1 data present, open the inbox: the AI button is visible with the High count; open the panel; the list is ordered by priority with reasons; click an item — that conversation is selected in the inbox and the panel closes. Navigate to Finance: no AI button.

**Acceptance Scenarios**:

1. **Given** the inbox route with scored conversations, **When** the page renders, **Then** the AI button shows in the bottom-right with a bubble equal to the number of open conversations with priority ≥70 (bubble hidden when 0).
2. **Given** the AI button, **When** clicked, **Then** a panel titled "Needs attention" opens listing up to 25 open conversations with non-null priority, ordered priority descending then most recent message descending; each item shows person name (or handle when unlinked), badge (High ≥70 / Medium 40–69 / none below), reason, and last-message age. Numbers never render.
3. **Given** the panel is open, **When** an item is clicked, **Then** the inbox selects and shows that conversation and the panel closes.
4. **Given** the panel is open, **When** Escape is pressed or the backdrop/close control is used, **Then** the panel closes; it opens closed on every page load (no persistence).
5. **Given** any route that has not registered a panel (all non-inbox routes in v1), **When** the page renders, **Then** no AI button renders.
6. **Given** a dialog or sheet is open, **When** the page renders, **Then** the AI button is hidden or behind the dialog, never above it.
7. **Given** Churchill (no scored conversations), **When** the inbox renders, **Then** the button renders with no bubble and the panel shows an empty state ("Nothing scored yet"), not an error.

---

### User Story 3 - Priorities stay fresh without anyone asking (Priority: P3)

A customer replies overnight. Next morning a staff member opens the inbox; within that load the changed conversation is re-scored and the panel reflects the new message. Nothing is re-scored when nothing has changed, except a slow rolling refresh so long-idle conversations do not keep a stale rank forever.

**Why this priority**: Without this, Story 1 is a one-off snapshot. With it, cost is bounded by message arrivals rather than by inbox loads or corpus size.

**Independent Test**: Note the scored-at of a conversation; send an inbound test message to it (staging/E2E); open the inbox; after the sweep completes the conversation's scored-at is newer and its reason mentions the new message. Open the inbox again with nothing changed: scored-at values do not move except for rows older than the refresh window.

**Acceptance Scenarios**:

1. **Given** a conversation whose last message is newer than its scored-at, **When** the inbox is opened, **Then** the sweep selects it ahead of any conversation whose score is merely old.
2. **Given** no conversation has changed and none is older than the refresh window, **When** the inbox is opened, **Then** the sweep scores nothing and makes no AI calls.
3. **Given** the sweep fails (network, key missing, AI error), **When** the inbox is opened, **Then** the staff member sees the inbox normally, no error text from the sweep reaches the UI, and the failure is logged to console only.
4. **Given** a sweep completes and changed at least one row, **When** it returns, **Then** the conversation data refetches and the button count and panel contents update without a manual reload.

---

### Edge Cases

- **No message text**: never selected, never scored, never listed in the panel. Covers all SMS conversations today and every Churchill conversation but one.
- **Manual conversation create** (`last_message_at` null, no messages): same as above — excluded by the text requirement, not by the timestamp.
- **Staff reply**: an outbound message advances `last_message_at` (Q1: application-managed, both directions), so the conversation is re-scored on the next sweep. This is intended — a replied-to conversation is now waiting on the customer and should usually drop.
- **Concurrent sweeps**: the sweep claims its batch by setting scored-at before calling the AI; a second sweep in the same window sees those rows as fresh and skips them.
- **AI failure mid-batch**: rows already written stay; the failed row's previous scored-at is restored (null if it had none); no partial fields are ever written for a row.
- **Conversation closed/archived after scoring**: excluded from future sweeps and from the panel (panel lists open only); stored fields remain and are harmless (archive path is unexercised today, F-028).
- **Panel item for an unlinked conversation**: shows the handle in place of a person name.
- **Panel item whose conversation is filtered out of the current list view** (e.g. Hidden filter active): clicking it must still select and show it — selection behaves like the existing deep link, not like a list click.
- **Reason longer than 120 characters**: truncated at store time, never at render.
- **Category outside the allowed set**: stored as `other`.
- **Backfill interrupted**: rerunning is safe — never-scored rows are selected first, claimed rows that failed have been restored.
- **Narrow viewport**: the button must not cover the composer or primary actions; the panel takes full width below the `md` breakpoint.
- **Pagination lands later (F-028)**: the panel reads the fetched set; if the fetch is paginated the panel needs its own bounded fetch (priority desc, limit 25). Recorded as a dependency in Assumptions.

## Requirements *(mandatory)*

### Functional Requirements

*Scoring and storage (unchanged by the UI ruling)*

- **FR-001**: Each conversation MUST be able to carry four nullable rank fields: priority (integer 0–100), reason (text, ≤120 characters), category (one of `sales`, `support`, `admin`, `other`), scored-at (timestamp). Null priority means never scored.
- **FR-002**: A conversation is **rankable** iff status is open AND it has at least one message with non-empty body text. Channel is not a criterion (web-channel conversations with text are included — Arin note pending).
- **FR-003**: A rank sweep MUST select up to K rankable conversations for the caller's organisation in this order: never scored → last message newer than scored-at → scored-at older than 7 days (oldest first). K defaults to 15 and MAY be overridden per call up to 50.
- **FR-004**: The sweep MUST claim its batch (set scored-at to now) before any AI call, MUST write priority/reason/category for a conversation only on a valid response, and MUST restore the previous scored-at for any conversation it fails to score. Empty selection MUST return zero without any AI call.
- **FR-005**: The AI input for one conversation MUST be its newest 20 messages, each tagged with direction and timestamp, HTML stripped, with an overall character cap (plan sets the number), assembled by a shared conversation-text module (FR-016).
- **FR-006**: The prompt MUST supply, as facts not as a formula: direction and age of the last message, enquiry stage, whether a linked order exists. It MUST require JSON output `{priority, reason, category}` and MUST instruct that the reason is a single sentence written for the staff member, naming what needs doing.
- **FR-007**: The sweep MUST validate the response (integer 0–100; non-empty reason; category in set, else `other`) before writing.
- **FR-008**: Model, provider, temperature and JSON-mode handling MUST mirror the existing thread-summary function (same key, same env pattern). The plan MAY name a different model only if the summary function's is unavailable.
- **FR-009**: The sweep endpoint MUST accept the same auth as the thread-summary function (user JWT with org membership, or internal key) and MUST resolve the organisation server-side from the caller, never from an unchecked client value.
  - *Annotation (C4, 2026-09-10)*: "the same auth as the thread-summary function" turned out to understate the requirement — the summary function has **no** caller-membership check at all (F-035), resolving the org from the looked-up conversation row rather than from the caller. `inbox-ai-rank` therefore ships the check the sentence describes (`isUserInOrganization` on the given-org path plus a single-membership backstop) and is **stricter** than the function it was told to mirror. The summary function is unmodified this cycle (FR-018 / AC-005); its guard is a backlog line.

*AI button host (PageShell)*

- **FR-010**: PageShell MUST provide a floating AI button slot, bottom-right, that renders only when the current route has registered a panel. Registration is by route/page, not by org. In v1 exactly one page registers: the inbox.
- **FR-011** (amended C3c): The host MUST accept from the registering page: a panel component and a title — registration is `{ title, panel }`. ~~an optional count for the bubble~~ (the bubble is struck, FR-013). The host owns open/closed state (not persisted; closed on load), the Escape/backdrop close behaviour, and layering (hidden or below any open dialog/sheet). *As built the open state is owned by the context provider rather than the host component, so the registering page can `close()` after a select; the distinction is internal to `src/shared/ai-panel/` and invisible to a registering page.*
- **FR-012**: The host MUST NOT render anything on routes without a registration — no placeholder, no disabled button (F-031 class).

*Inbox "Needs attention" panel*

- ~~**FR-013**: The inbox MUST register a panel titled "Needs attention" whose bubble count is the number of open conversations with priority ≥70 (bubble hidden at 0).~~ **STRUCK at C3c** (ruled by Giorgi after browser verify): there is no count bubble. The inbox registers `{ title: 'Needs attention', panel }` and nothing else. Striking the bubble is what removed the page-side count query from the C3a hunk.
- **FR-014** (amended C3c): The panel MUST list open conversations with non-null priority, ordered priority descending then last message descending. ~~up to 25~~ — the item count is the user's choice of **5 / 10 / 25, default 10**, persisted per browser (`localStorage` key `needs_attention_page_size`) and presented as chips. Each item MUST show: person name or handle, badge (High ≥70, Medium 40–69, none below), reason, last-message age. The numeric priority MUST NOT render.
- **FR-015**: Clicking an item MUST select and show that conversation in the inbox (deep-link semantics, so it works regardless of active list filter) and close the panel.
- **FR-016**: The panel MUST read from the conversation data the inbox already fetches — no new query or endpoint. It MUST NOT modify the conversation list, its filters, its sort, or the pill files.
- **FR-017**: Empty state ("Nothing scored yet") when no open conversation has a priority.

*Freshness, sharing, operations*

- **FR-018**: Conversation-text assembly (scope → messages → strip → window → tagged text) MUST live in a shared edge-function module consumed by the ranker. The thread-summary function MUST NOT be modified in this cycle; its migration to the shared module is a backlog item.
- **FR-019**: The client MUST call the sweep once per inbox mount, fire-and-forget, and MUST invalidate the conversation queries when the sweep reports ≥1 row written. Sweep errors MUST NOT surface as UI text (console only).
- **FR-020**: There MUST be no organisation allowlist or org identifier in code. Sears-Melvin-only is a consequence of data (Churchill has one rankable conversation), not a gate.
- **FR-021**: Backfill MUST be the same endpoint invoked by the operator with the internal key in a loop until it returns zero rows. It MUST NOT be a separate code path.
- **FR-022**: Category MUST be stored and MUST NOT render in v1.
- **FR-023**: The migration MUST be additive (nullable columns, no defaults that rewrite rows, no changes to existing columns), committed to the repo before Dashboard apply, applied one statement at a time, read back via the catalog, and confirmed present in `schema_migrations`. Its header MUST name the portal reader (`../SearsMelvin/functions/api/partner-orders.js`, explicit column list) and record the views-over-table check result.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: No routing change. The host lives in PageShell; registration is a per-page call, not a route-table edit.
- **AC-002 (Module boundaries)**: The button host and the registration mechanism live in `src/shared/` (PageShell-owned, page-agnostic). The inbox panel component and its data shaping live in `src/modules/inbox/`; the host never imports from a feature module. The badge is panel-local, not `ScoreBadge` (order-history RFM semantics). Edge-function shared code lives in `supabase/functions/_shared/`.
- **AC-003 (RLS as boundary)**: Rank fields are readable under the existing org policies on the conversation table; writes come from the edge function with the service role. No client-side writes to rank fields.
- **AC-004 (Drift discipline)**: FR-023 in full. No `CREATE OR REPLACE` of any view or RPC in this cycle. No ungated SECURITY DEFINER bodies.
- **AC-005 (No ingestion edits)**: gmail-sync-now, inbox-gmail-sync, twilio-sms-webhook, ghlConversationSync and the send functions are not modified. The trigger is the sweep, not hooks.
- **AC-006 (Shell change, Arin-visible)**: PageShell is shared by ~28 routes. Even rendering only on the inbox, this is a demo-surface change — Arin gets a heads-up and sees it alongside the ranking demo. The host MUST add nothing visible on the other 27 routes.
- **AC-007 (Read-only rule)**: Anything that authenticates to a live endpoint (backfill, live verification reads) is Giorgi's, not CC's.
- **AC-008 (Arin's branch)**: No edit to `InboxConversationList.tsx`, `CustomerThreadList.tsx` or the pill/filter arms of `UnifiedInboxPage.tsx`. If selecting a conversation from the panel requires a change to `UnifiedInboxPage.tsx` (no existing deep link), that edit is the only permitted one there and is isolated in its own commit.

### Key Entities *(include if feature involves data)*

- **Conversation (rank fields)**: existing inbox conversation extended with priority, reason, category, scored-at. Scored-at doubles as the claim marker for concurrency.
- **Rank sweep**: one invocation of the ranking endpoint — selects a bounded batch by staleness, scores each, reports rows written.
- **Ranking result**: the validated AI output for one conversation — `{priority, reason, category}`.
- **Conversation text**: the assembled, windowed, direction-tagged recent-message text — the shared input for the ranker now and the order-form fact extractor next.
- **AI panel registration**: what a page hands the PageShell host — panel component, bubble count, title. One per route; absent means no button.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After backfill, 100% of rankable SM conversations carry a non-null priority and non-empty reason; 0 non-rankable conversations carry any (≈762 rankable on 2026-09-10 counts — re-count day-of).
- **SC-002**: Ten sampled reasons read as staff instructions about their own thread (spot-check, named conversation ids in quickstart).
- **SC-003**: On the inbox the AI button shows the correct High count (matches a live count query), the panel lists ≤25 items in priority order, every item has a reason, and clicking an item selects that conversation.
- **SC-004**: No AI button renders on any non-inbox route (spot-check Finance, Pipeline, Orders, Customers).
- **SC-005**: A new inbound message is reflected in the conversation's rank on the next inbox load, within a single sweep (K rows).
- **SC-006**: With nothing changed and nothing past the refresh window, an inbox load makes zero AI calls (sweep returns 0).
- **SC-007**: Churchill's inbox is unchanged apart from the button, which shows no bubble and an empty-state panel.
- **SC-008**: Gate green: 0 new tsc items against the 54 baseline, lint at or below 10/19, existing tests pass.
- **SC-009**: Total hours ≤ 6 (migration 0.5 · edge function + shared module 2 · host + panel + sweep call 2 · backfill + verify 0.5 · spec + docs 1). Cut list, in order: last-message age on items, bubble count, category prompt field.

## Rulings

Made 2026-09-10; recorded so the plan does not re-open them.

- **R-001** Storage = new columns on the conversation table (report option 1). Cheapest surfacing; zero live views over the table today; additive columns are safe for the portal's explicit-column read (Q2).
- **R-002** Trigger = client-kicked stale sweep, not ingestion hooks (three writers to touch, risk) and not cron (no precedent, new extension surface).
- **R-003** Staleness keys on `last_message_at`, which advances on both directions (Q1). Re-scoring after a staff reply is intended.
- **R-004** Surfacing = a floating AI button (PageShell host) opening a page-scoped panel; the conversation list is not touched. Supersedes the earlier sort-toggle + row-badge design. Zero collision with Arin's branch; the host is the socket for future page panels (Finance, Pipeline) which are separate specs.
- **R-005** v1 registers the inbox only. The button never renders where nothing is behind it (F-031 class).
- **R-006** The panel reads the already-fetched conversation set (F-028: unpaginated). No new fetch, no RPC change.
- **R-007** Rank and order-form fact extraction are separate AI calls sharing the conversation-text step. Prefill runs on demand when Create Order opens; scoring the corpus for facts nobody uses is waste.
- **R-008** Existing `customer_scores` / `enquiry_scores` are not used; they read no message content. Their untracked-view status goes to the drift audit.
- **R-009** Model mirrors the summary function. Consistency of key/cost profile over model shopping for a "doesn't have to be perfect" v1.
- **R-010** No org gating in code (F-006 class); SM-only is a data outcome.
- **R-011** (amended C3c) Panel open/closed state is not persisted; slide-over vs popover is the plan's call (slide-over preferred so reasons are readable — slide-over shipped). ~~bubble = High only; 25 items~~ — the bubble is struck (FR-013) and the item count is a user choice of 5/10/25, default 10, persisted (FR-014). Persistence applies to the item count only, never to open/closed.

## Out of Scope (deferred by Arin or by ruling)

- Finance, Pipeline or any other page's AI panel — the host ships, the panels are future specs.
- Per-user or per-role priorities; per-page plans of any other kind.
- Sales-only (category) filter — category is stored so this is a panel-only follow-up.
- Any change to the conversation list: sort toggle, row badges, filter pill, preview swap, flat view.
- Order/invoice as the ranked object.
- GHL transcripts (ingestion not landed; October).
- Migrating the thread-summary function onto the shared text module (backlog).
- Churchill (one rankable conversation; all others are F-030 stubs).

## Assumptions

- Sears Melvin is the only org with a rankable corpus; Arin was not asked and does not need to be (ruled).
- Web-channel conversations with text (94 on 2026-09-10) are included; Arin gets a one-line note, not a question.
- A deep-link path to select a conversation exists in the inbox page (the `customersDeepLinkConversationIdRef` machinery suggests one); the plan verifies read-only. If absent, AC-008's single isolated edit applies.
  - *Annotation (C4, 2026-09-10)*: **held, with a caveat.** The machinery exists, and C3a's handler reuses it in-page rather than building a parallel path — the customers arm sets `customersDeepLinkConversationIdRef.current` and clears the selection, exactly as the existing `?conversation=` flow does. The caveat: that machinery resolves the target **at mount time only**. A panel item whose conversation falls outside the page's currently filtered set therefore does not open — the page falls back to the first customer row. Closing that gap means touching the filter arms, which AC-008 fenced off for this cycle; it is a backlog line, not a shipped behaviour.
- The AI key used by the thread-summary function is present in the edge-function environment for staging and production.
- The conversation fetch remains unpaginated for the life of v1 (F-028); pagination forces R-006 to be revisited (own bounded fetch for the panel).
- September cap: 6 hours for this feature. Cut list applies before scope creep.
- Backfill and all live verification are run by Giorgi (AC-007).
- The 7-day refresh window and K=15 are starting values; both live in the edge function and can change without a migration.
- Arin's Inquiries-pill PR and readability pass can merge before or after this branch with no conflict expected; AC-008 keeps it that way.