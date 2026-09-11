# Findings
Updated: 2026-09-12

- F-001: Seven rows in organizations; two live, one E2E, four test/leftover (see CLAUDE.local.md). Data volume in leftovers unknown. Classify and archive in schema cleanup (Day 9). Until then real-data queries include only the two live orgs.
- F-002: Gmail integration reads three differently named client-id/secret env pairs (GOOGLE_OAUTH_*, GMAIL_OAUTH_*, GMAIL_CLIENT_*). Drift; consolidate.
- F-003: STRIPE_CREDENTIALS_ENCRYPTION_KEY is the single key decrypting every org's Stripe credentials; rotation invalidates all at once. Document a rotation procedure before ever rotating.
- F-004: Sentry env names differ between vite.config.ts (SENTRY_ORG, SENTRY_PROJECT) and sentry-proxy (SENTRY_ORG_SLUG, SENTRY_PROJECT_SLUG). Harmless; note only.
- F-005: RESOLVED (A2). Bare `npx tsc --noEmit` confirmed to check nothing (solution tsconfig, `files: []`). `gate:tsc` (`scripts/gate-tsc.mjs`) runs `tsconfig.app.json` item-diffed against the baseline on `file(line,col): TScode` keys, plus `tsconfig.node.json` at zero. The baseline file's message text has drifted on 2 items (type-dump churn); keys still match 54/54, which is why the wrapper ignores message text. **Mechanism sharpened at C7 (2026-09-03)**: type-dump churn is not the only source, and the second one is not edit-driven at all. In some `tsc` runs **every** "Did you mean" spelling suggestion vanishes repo-wide — the run reports 0 of them against 1 `TS2552` in the baseline — so a diagnostic flips code and message suffix while its `file(line,col)` key stays put: `OrderDetailsSidebar.tsx(761,32)` reported `TS2552: Cannot find name 'format'. Did you mean 'FormData'?` (the baseline text) on some runs and `TS2304: Cannot find name 'format'.` on others, with no edit to that file between them — it surfaced twice mid-apply and cleared itself. Two consequences. (1) This explains why the same untouched file diffs on some runs and not others, and why a `RESOLVED`+`NEW` pair can appear on a file nobody opened: it is one item flickering, not two. (2) It means the flip is **latent independent of any change** — whichever run a gate happens to catch decides whether that line diffs, so a mid-session appearance is not evidence the session caused it. Resolution unchanged: item-diff by **key only**; message-text drift is benign and is not re-flagged. Note the key itself is genuinely at risk from *edits* (see the line-shift trap) — only the text is noise.
- F-006: Real identifiers in tracked files. The SM `organization_id` and the Supabase project ref each appear in 26 git-tracked files (14 `supabase/migrations/*.sql`, `supabase/config.toml`, 35 files under `specs/`); Churchill's in 2; test/E2E ids in 0. Violates the no-real-IDs rule historically. A3's `block-secrets` hook refuses new insertions (config.toml exempt — the CLI needs the ref there); scrubbing existing files is backlog. Also found on HEAD: stray `const x: number = "a";` in `src/__tests__/smoke.test.ts` left `gate:tsc` red (55 vs 54) — FIXED in A3 step (a).
- F-007: RESOLVED (A5). CLAUDE.md repo layout named `src/integrations/supabase/`, which does not exist; line now points at `src/shared/lib/supabase.ts` (client, `createClient<any>`) and `src/shared/types/database.types.ts` (generated types, not consumed by PostgREST typing). Open decision carried in `docs/tsc-clusters.md` Q1: whether the client generic stays `any` before the tsc=0 push.

- F-008: map/hooks/useOrders.ts:23 filters orders_with_options_total on
  `is_test`; the live view has no such column (catalog-verified, 61
  columns, no job_id/archived_at/is_test). Likely a live 400 on the map
  page. UNVERIFIED — one browser check settles it.
- F-009: updateInvoice has no organization_id guard; RLS is the only
  tenant boundary. Note user_is_member_of_org resolves auth.uid(), which
  is null in service-role/edge-function context.
- F-010: Expanding an invoice row remains write-capable via Stripe
  auto-create. Architectural; root-cause class of the 26 Aug incident.
  UPDATE 2026-09-01: mechanism confirmed (T4b); expansion-effect Stripe
  call removed (T5 C1); residual recalc write remains, pence-compared
  and blocked when invoice locked (C2).
- F-011: `anon` holds blanket DML grants (INSERT/UPDATE/DELETE/TRUNCATE)
  on `enquiries` — SearsMelvin-owned DDL. Neutralised by RLS
  (relrowsecurity true). Shared-schema protocol item.
- F-012: Churchill has zero rows in `jobs`. Possibly not using the app yet —
  the zero-jobs half stands alone; confirm with Arin whether intentional or
  a stalled rollout. AMENDED 2026-09-02: the "almost no `people` (only
  WhatsApp auto-created contacts)" claim is struck — Churchill people = 204,
  SM = 169 (live 2026-09-02), so Churchill now has more. Composition
  (WhatsApp auto-created vs real contacts) UNVERIFIED.
- F-013: updateOrder has no organization_id guard (orders.api.ts:427-437);
  RLS is the only tenant boundary. Sibling of F-009. Residual: OrdersPage
  delete button not lock-gated.
- F-014: VITE_INBOX_ADMIN_TOKEN is a client-side admin token
  authenticating Stripe edge-function calls via X-Admin-Token
  (stripe.api.ts:59-91) — ships in the JS bundle. Security-relevant;
  remediation on backlog.
- F-015: activity_logs dead org-wide since ~2026-04-10; SM has zero rows
  ever (T4b).
- F-016: stripe-fetch-invoice edge function dormant — no frontend caller;
  Mason stripe_invoice_status does not self-heal when stale (revise
  relies on live Stripe reads instead).
- F-017 (FIXED T6 2026-09-01): stripe-revise-invoice and invoices-delete
  voided the Stripe invoice only; stripe-void-invoice already expired the
  stored session (:176-220 pre-fix). Partial sessions stayed payable
  after revise/delete/manual-dashboard voids; a second partial link
  overwrote the stored cs_ id without expiring the prior session; webhook
  had no void guard. Fix: expiry ported into revise (stripeSideDead
  block, warnings) + delete (best-effort, runs even for already-void
  invoices); belt-and-braces sessions.list({customer, status open}) +
  metadata.mason_invoice_id sweep in all three void paths; fail-closed
  expire-before-overwrite in payment-link (mirrors checkout-session
  freeze-in-flight); webhook void guard + checkout.session.expired
  pointer hygiene. Residual: invoices-delete touches sessions only when
  stripe_invoice_id is present — a standalone-session invoice deleted
  without a hosted invoice keeps its session until Stripe's 24h
  auto-expiry. Manual Dashboard voids are covered only at next Mason
  touch (revise/delete/void call). Found T5b E2E 2026-09-01.
- F-018: invoice_payments.stripe_invoice_id receives cs_ session ids on
  the webhook's standalone checkout path (insert uses session.id).
  Confirmed live 2026-09-01: 2 such rows in Churchill. Column semantics
  polluted; anything joining on in_ ids skips these rows. Not fixed in
  T6.
- F-019: standalone-path silent drop — webhook checkout.session.completed
  standalone branch returns received:true when resolvePaymentPath ≠
  'checkout' (:331-334 pre-fix): a completed standalone session against
  an invoice that has since gained a hosted invoice ('hosted' wins, U1)
  is dropped with no record and no log. Same orphan class as F-017's
  webhook leg; separate fix.
- F-020: npm:stripe@14.21.0 (pinned in stripe-webhook) has NO
  invoices.attachPayment — runtime method list ends at voidInvoice
  (verified in the package). The partial branch's attach call throws
  TypeError on EVERY partial-link payment (void or not) → caught → 500 →
  Stripe retry loop: customer charged, invoice never credited. Partial
  payments have never been attachable under this SDK; F-017's webhook
  symptom is this bug's void-flavored special case (T6's guard returns
  200 for dead invoices before reaching the call). Latent, not active
  loss: zero completed checkout sessions on SM ever, Churchill not in
  use (Giorgi, 2026-09-01). FIXED T6 C6 (Giorgi ruling, no SDK bump):
  raw form-encoded POST to /v1/invoices/{id}/attach_payment with the
  org secret key already in scope (param payment_intent, verified
  against the API reference); non-200 → structured error
  'stripe_attach_payment_failed' + 500 so real failures still retry.
- F-021: E2E sandbox webhook endpoint URL was missing ?organization_id —
  every event 400ed ('organization_id query parameter is required',
  stripe-webhook:57) until fixed during E2E 2026-09-01. No code change;
  the per-org URL requirement is by design. Ops: any new endpoint must
  carry the query param.
- F-022 (found E2E 2026-09-01, FIXED C7): webhook ignored invoice.voided
  and invoice.marked_uncollectible (switch default no-op) — Mason's void
  state depended entirely on invoice.updated being delivered, so a lost
  or unreplayed event left stripe_invoice_status stale at 'open' and the
  F-017 void guard blind (repro: INV-000139 — Stripe-side void, Mason
  'open', replayed checkout.session.completed reached the attach call,
  500). Fix: both events now route through handleInvoiceUpdated's
  org-guarded sync; and attach non-200 is classified by LIVE retrieve —
  Stripe invoice void/uncollectible ⇒ syncInvoiceFromStripe (heals the
  stale status) + orphaned_void row + 200 (no retry); paid/draft/
  network/auth/unknown ⇒ 'stripe_attach_payment_failed' + 500 retry as
  before. Deviation from the ruling, flagged: classification by
  retrieve rather than Stripe's error text (edge logs unreachable via
  supabase-ro; the retrieve is evidence-based and self-healing).
- F-023 (FIXED C4 878789b, 2026-09-01): invoice status badge was
  void-blind — keyed off derivedStatus (Stripe pence arithmetic,
  invoiceAmounts.ts:21-43 pre-fix) and never consulted the transform's
  display status; all 9 live void rows (both orgs) derived 'pending'
  and rendered a "Pending" badge in default GRAY (the spec's "amber"
  claim was off — the :393 amber default was always overwritten). Fix:
  status==='void' branch first → "Void", neutral badge
  (invoiceColumnDefinitions.tsx).
- F-024: table_view_presets DB layer is dead AND org-shared — dead at
  both call sites (arity bug), and rows are org-scoped not user-scoped,
  so reviving it would violate per-user column persistence and drag in
  3 baseline tsc items. Ruled (finance-consolidation FR-008): stays
  dead; localStorage 'invoices_column_state' is the real store. Day-9
  schema-cleanup drop candidate — check ../SearsMelvin before any drop.
- F-025 (found C7 T701, 2026-09-01): embedding orders on
  invoices_with_breakdown requires the FK hint —
  order:orders!invoices_order_id_fkey(...) — because a bare `orders`
  embed is ambiguous (HTTP 300 PGRST201: orders.invoice_id offers a
  second path). The hint is load-bearing; the comment in
  INVOICES_LIST_SELECT (invoicing.api.ts:32) says so. Applies to any
  future PostgREST embed between invoices and orders (views included).
- F-026: get_customer_messages — the LIVE definition is gated (membership
  check in body, pg_proc-verified 2026-09-02), but Mason's tracked
  supabase/migrations/20260423112000_get_customer_messages_rpc.sql still
  holds the ungated SECURITY DEFINER body. The gate came from
  ../SearsMelvin/migrations/2026-08-09-close-unsafe-rpcs.sql (grants from
  2026-08-09-restrict-organization-rpcs.sql). Mason's migration history
  does not describe the live DB; replaying that file in the Dashboard
  restores the hole. Same revert-risk class as create_quote
  (supabase/CLAUDE.md). NOT a live vulnerability — a replay hazard, not an
  open hole. Scope of the same class across other objects is unknown —
  migration drift audit on backlog.
- F-027 CLOSED 2026-09-03 (full-name-search C1b + tokenised C1a
  amendment). Was: raw search term interpolated into PostgREST .or()
  grammar (inboxConversations.api.ts:54) — commas/parens corrupt the
  filter. Now the term reaches SQL only as bound p_q via
  search_inbox_conversations; .or() grammar never parses it — the
  failed-request class is structurally impossible on the RPC path.
  Comma/paren terms: 200 with empty set. Browser-verified on staging
  (conversation 8f8c8e05-dd4e-4c28-937a-54d90cc71d73): "First Last"
  full-name matching worked from C1b onward; the tokenised amendment
  added reversed "Last, First" and any-order matching; punctuation-only
  terms return nothing (zero-token guard). Note: the supabase-ro MCP
  role (supabase_read_only_user) cannot EXECUTE the RPC — 42501; it
  holds no grant after C1a's revoke-from-public (ACL:
  postgres/authenticated/service_role only). Correct fallout, not a
  defect. MCP read-backs and smoke-tests go via catalog queries or the
  function body inlined, never a direct RPC call.
- F-028: inbox archive path never exercised — 100% status='open' in both
  orgs (Churchill 539/539, SM 1005/1005, live 2026-09-02);
  archiveConversations (inboxConversations.api.ts:157-168) has no live rows
  behind it; muting is the only triage in use. Consequence: every inbox
  fetch pulls the full corpus, unpaginated. No-debounce half closed
  2026-09-03 (full-name-search C3, 300 ms at baseFilters); pagination
  still open (backlog).
- F-029 (shell cycle C3c, 2026-09-03): two traps left in
  src/modules/inbox/pages/UnifiedInboxPage.tsx by C3a's removals. Both are
  documented in-code; recorded here so a later session does not rediscover
  them the hard way.
  (1) `userForcedUnreadIds` (:140) is ONE Set holding TWO key spaces. The
  customers auto-read effect tests a ROW STABLE KEY
  (customerThreadRowStableKey — written :897, read :625); the Conversations
  tab's handleToggleReadUnread stores CONVERSATION IDS (written :853/:861,
  read :729). The two have not intersected since C3a. Writing a
  conversation id at the customers site would leave the auto-read effect
  unguarded and it would silently re-read the row. Trap comment :878-882.
  (2) `suppressCustomersAutoSelectRef` (:149) is INERT — initialised
  `false` and written `false` at five sites (:234, :582, :612, :1198,
  :1307), `true` at NONE: C3a removed its only writer (the old customers
  mark-unread flow). It still gates the customers auto-select effect at
  :586, a branch that can therefore never be taken. C3c did not resurrect
  it — its mark-unread deliberately keeps the row selected, and the
  userForcedUnreadIds guard is what holds the row unread. Deleting the ref,
  its five writes and the :586 branch is a separate cleanup, tracked on
  docs/backlog.md.
  Also stale: the customersDeepLinkConversationIdRef comment at :120 still
  says later selection resets happen "e.g. after mark-unread" — C3c's
  mark-unread keeps the row selected, so no such reset exists.
- F-030 (shell cycle C5b, 2026-09-03): the GHL→inbox merge is STUB-ONLY, and
  the Inbox | GHL Inbox switch is the only way into GhlInboxPage.
  Live (supabase-ro, both live orgs, 2026-09-03): ghl_connections status
  'active' for BOTH orgs, outbound_enabled true on both. Conversations with
  zero rows in inbox_messages, by channel: Churchill 485 'web' + 74 'sms';
  SM 361 'web' + 12 'sms'. SM additionally holds 86 messages on 'web'
  conversations whose source is UNVERIFIED — pre-existing, not attributable to
  the sync from these counts alone.
  Attribution caveat: channel is not proof of GHL origin. 'web' and 'sms' are
  the two channels ghlConversationSync writes (derived from lastMessageType,
  supabase/functions/_shared/ghlConversationSync.ts:138), but other writers use
  the same values; the counts above are message-less conversations BY CHANNEL,
  an upper bound on GHL stubs, not a verified GHL row count.
  Mechanism: the sync upserts inbox_conversations rows (:148-203) and never
  writes inbox_messages — merged threads carry metadata and no bodies. Note
  Churchill's 559 message-less web/sms rows are the same order as its entire
  open corpus (539, 2026-09-02, F-028): message-less is the norm there, not an
  edge — cross-date arithmetic, not a fresh count.
  GhlInboxPage does not read these tables at all: conversations, messages and
  contacts come live from the GHL API via the ghl-fetch edge function
  (ghlInbox.api.ts:109-143). It is a second pane over a second data source, not
  a view of the merge.
  Entry point: the switch in UnifiedInboxPage.tsx is the ONLY one —
  /dashboard/ghl-inbox redirects to /dashboard/inbox (router.tsx:77), no nav
  item links it, no other importer of GhlInboxPage exists. Hiding the switch
  behind SHOW_GHL_INBOX_TAB = false (C5b) therefore makes GhlInboxPage
  unreachable in the app. Stated plainly because it is the whole consequence of
  the flag; flipping it back restores the page with no other edit.
  Outbound is unaffected server-side: outbound_enabled stays true and
  ghl-send-message still checks it (:114). C5b removes a UI, not a capability.

- F-031 (found C8 investigation, 2026-09-03): PageShell renders a HARDCODED
  turnaround metric on every /dashboard route, for both live orgs. The pill at
  PageShell.tsx:178-211 is static JSX — "THIS WEEK" (:203), "−4.2 days" (:206),
  "avg. turnaround" (:209). No query, no prop, no org scoping: the same figure
  renders for Churchill and for Sears Melvin, and it never changes. The in-file
  comment already says so (:179-180, "Static stub until baseline tracking
  lands") — but that comment is invisible to anyone using the app.
  Visibility: `hidden lg:flex` (:182), so it shows at >=1024px — i.e. on every
  desktop session, on all ~28 /dashboard routes, since PageShell wraps them all
  (sole sidebar render site PageShell.tsx:152; the header is the same block).
  Arin sees it. It presents as a live weekly business metric, complete with a
  pulsing accent dot (:198) — the same constant-dressed-as-live pattern C8 just
  removed from the sidebar nav, but on a client-facing surface rather than an
  internal affordance.
  No fix here — the decision is wire-or-remove, not a code detail. Backlog line
  filed.
- F-032 (found inbox conversation-pane investigation, 2026-09-03): the inline
  email iframe is sandboxed strictly weaker than the viewer dialog that renders
  the SAME content, and the sanitiser in front of both is regex-only.
  Two sandbox values, one file: ConversationThread.tsx:1316 (inline, in-thread)
  grants `sandbox="allow-same-origin allow-scripts"`; :1694 (the viewer dialog)
  grants `sandbox=""`. Granting allow-same-origin AND allow-scripts together is
  the combination that puts the frame on the parent's origin with script
  enabled — iframe script can then reach the parent document. The safe
  configuration is therefore already present in the file, on the same content,
  reached by a different affordance.
  Content provenance: HTML authored by customers' mail clients, stored verbatim
  by gmail-sync-now (:493 INBOX, :603 SENT) from _shared/gmailBody.ts's
  extractBodyHtml (:69-87) — no trimming or rewriting at ingest.
  Sanitisation is `sanitizeHtml` (:78-89): five regex replaces (strip <script>,
  <style>, on*="…"/on*='…' handlers, <meta>) plus a lazy→eager loading rewrite.
  No DOM parser, no tag/attribute allowlist. Defence-in-depth is the CSP meta
  injected into every srcDoc (:31-37: default-src 'none'; style-src
  'unsafe-inline'; img-src * data: blob:; font-src *; script-src
  'unsafe-inline').
  Two adjacent defects in the same block, both harmless today:
  (1) the injected resize script posts `{iframeHeight, iframeId}` to the parent
  (:51) and NO parent listener exists (grep across src/: one hit, the emitter) —
  the message is dead; frame height comes only from the one-shot onLoad handler
  (:1324-1338), so images that load later never resize it.
  (2) every inline iframe carries the constant `id="email-iframe-thread"`
  (:1315), so a thread with N HTML emails puts N identical DOM ids on the page —
  which is also why the iframeId in (1) could not disambiguate if it were read.
  Not a styling matter and not fixed here; the sandbox question is a backlog
  decision (drop allow-scripts to match the viewer, or give the sanitiser a real
  parser). Backlog line filed.
  Addendum (C10, 2026-09-03) — actioning this finding got MORE expensive, not less.
  C10 removed the fixed 400/600px wrapper and sizes each frame to its content. An
  iframe has no CSS content-sizing (150px intrinsic height, no `height:auto`), so the
  height must be measured from JS, and the measurement reads `contentDocument` — which
  is only reachable because of `allow-same-origin`, the very grant this finding
  proposes dropping. Before C10 that dependency existed but was cosmetic: a failed
  measurement fell back to a usable 400px box. After C10 there is no box, so dropping
  `allow-same-origin` to match the viewer dialog's `sandbox=""` also costs the sizing
  mechanism and forces the postMessage channel — which is dead (defect 1) and needs a
  parent listener with an origin guard built first.
  Defect (2) is CLOSED by C10: the constant `id="email-iframe-thread"` was removed
  along with the emitter, since the id had no other consumer. That is a fix and a cost
  at once — reviving the channel now means adding per-message ids back.
  The security question itself is unchanged and still open; only its price moved. The
  sanitiser half — a real DOM parser with a tag/attribute allowlist — is untouched by
  C10 and can still be done independently.
- F-033 (found inbox conversation-pane investigation, 2026-09-03): the
  internal-note feature branches on `message_type`, a column that a COMMITTED
  MIGRATION adds but that does not exist in the live database — unapplied
  migration drift, not a column the code invented.
  Migration present in the record of truth:
  supabase/migrations/20260403160000_add_message_type_to_inbox_messages.sql —
  adds the column (not null default 'message'), the
  inbox_messages_message_type_check constraint, and
  idx_inbox_messages_message_type.
  Live (supabase-ro, 2026-09-03), all four zero: information_schema column
  message_type = 0; pg_constraint inbox_messages_message_type_check = 0;
  pg_indexes idx_inbox_messages_message_type = 0; and
  supabase_migrations.schema_migrations version '20260403160000' = 0 rows — the
  migration was never applied and is not recorded as applied.
  Consequences in code, all four references:
  (1) useInboxMessages.ts:349 sends `message_type: 'internal_note'` through
  inboxMessages.api.ts:32 createMessage, which inserts the object unfiltered
  into inbox_messages.
  (2) the "Note" composer button (ConversationThread.tsx:1603-1629) is UNGATED —
  it renders in every non-readOnly composer, i.e. the flat inbox view and the
  customers view, for both live orgs.
  (3) the two read-side branches are therefore dead: :932 (skip notes when
  resolving email HTML) and :1207 (`isInternalNote`), so InboxMessageBubble's
  'note' variant (dashed border, full width — InboxMessageBubble.tsx:92) never
  renders.
  (4) inbox.types.ts:63 declares the field optional, so tsc has nothing to say.
  Live-verified, read-only (2026-09-03), that the affordance is BROKEN not inert:
  GET /rest/v1/inbox_messages?select=message_type → HTTP 400
  {"code":"42703","message":"column inbox_messages.message_type does not exist"}.
  Control: the same GET for an existing column returns 401 at the RLS stage
  (42501, user_is_member_of_org) — so the unknown-column failure is raised at
  parse time, BEFORE auth and RLS, and is therefore role-independent and
  statement-independent. A staff insert naming the column cannot succeed. The
  exact code an INSERT returns is 42703 or PGRST204 (if PostgREST's insert-payload
  validation intercepts against its schema cache first); either way the raw
  message is surfaced verbatim to staff by the composer's error line at
  ConversationThread.tsx:1552 (`{errorMessage}`, red, above the composer), since
  onError passes err.message straight through (:1615-1616). No browser step is
  needed to establish that the button is broken; only the code string would
  differ.
- F-034 (found C9 investigation, 2026-09-03): the email-HTML prefetch scope was
  coupled to the REPLY-CHANNEL PILL, not to the conversation being read.
  ConversationThread.tsx:814 derives activeConversationId as
  conversationIdByChannel[effectiveChannel], and
  buildConversationIdByChannelFromMessages (useInboxMessages.ts:228-247) keeps only
  the LATEST conversation per channel. The prefetch effect (pre-C9 :1023-1041) then
  filtered on that id, so which emails rendered framed depended on a composer
  control: with the pill on WhatsApp or SMS the email filter matched nothing and NO
  email in the list prefetched at all.
  This is the mechanism behind T18's symptom (35 of 137 SM multi-message threads
  showing both framed and flat messages): the customers view renders a whole
  person/group timeline (get_customer_messages / get_unlinked_messages, neither
  LIMITed), so every conversation older than the latest one was rendered but never
  fetched, and stayed on the plain-text branch permanently. The flat view
  (useMessagesByConversation) renders exactly one conversation, so scope == rendered
  list there and the defect is invisible — consistent with the scope being written
  for the flat view and inherited by the customer timeline.
  Fixed in C9 (visibility-driven prefetch over the rendered list). Recorded because
  the coupling is not visible from the effect itself — it reads as
  "one conversation", and only :814 shows that the conversation is chosen by a
  composer control.
- F-035 (found ai-inbox-prioritisation Phase 0 Q3, 2026-09-10):
  `supabase/functions/inbox-ai-thread-summary/index.ts` has NO caller-membership
  check — any authenticated user of any org can summarise any conversation by id.
  Auth (:230-256) mirrors inbox-ai-suggest-reply: a valid user JWT OR the internal
  key sets `authorized = true`, and `authUserId` is explicitly not required. The
  organisation is then resolved FROM THE LOOKED-UP ROW, not from the caller — all
  three request shapes do the same thing: single conversation (:301-321,
  `organizationId = conv.organization_id`), and the two id-list shapes (:350-368,
  :410-431, `organizationId = convRows[0].organization_id`). The reads behind that
  resolution run with the service role, so RLS is not a second boundary. Net: the
  JWT proves only that the caller is *a* Mason user; the conversation id chooses
  the tenant. F-009 class but stronger — an actual cross-org read of customer
  message text, not an RLS-only reliance.
  The fix is not new work: `_shared/organizationMembership.ts` already exports
  `isUserInOrganization` (precedent: `gmail-send-first-message/index.ts:3` imports
  it), so this is one import plus a ~6-line guard after each org resolution —
  exactly the guard `inbox-ai-rank` ships with (T22). Not fixed in this cycle:
  AC-005/FR-018 hold the summary function unmodified. Backlog line filed
  (engineering-health reserve, first in line).
- F-036 (found ai-inbox-prioritisation C3b browser verify, 2026-09-10):
  `supabase/functions/gmail-sync-now/index.ts` decides message DIRECTION, and
  therefore `primary_handle`, by a raw case-sensitive string compare that a
  case or alias mismatch flips.
  Direction: `:308` `const direction = fromEmail === userEmail ? 'outbound' :
  'inbound'` where `userEmail = connection.email_address ?? ''` (`:140`). Two
  failure shapes. (a) The addresses differ only in case, or the mailbox receives
  on an alias/plus-address that is not the stored `email_address` — the compare
  misses, an outbound message is classified inbound, and the INBOX create
  (`:429`, `primary_handle: primaryHandle`, `:309`) writes the ORG'S OWN MAILBOX
  as the conversation's `primary_handle`. (b) `email_address` null → `userEmail`
  is `''`, which no header ever equals, so EVERY message is inbound.
  Handle on the SENT path: `:563` writes `primary_handle: toEmail`, from
  `extractEmail` (`:256`: first `<…>` if present, else the whole header trimmed).
  A self-send lands the org's own address again; a plain multi-recipient `To:`
  with no angle brackets stores the entire header string as the handle.
  Neither is self-correcting, because both creates sit behind an
  `external_thread_id` lookup (INBOX `:391-398`, plus a message-meta
  `gmail.threadId` fallback `:405-415`; SENT `:545-548`) — once a thread's
  conversation row exists with the wrong handle, every later message in that
  thread joins it and inherits it.
  Live (supabase-ro, SM, 2026-09-10): 127 open conversations carry the org's own
  mailbox address as `primary_handle`; 23 of them are linked to 23 distinct
  people, 104 are unlinked. The 104 are the visible cost — unlinked and
  unlinkable by handle.
  NOT FIXED this cycle: AC-005 forbids ingestion edits in
  ai-inbox-prioritisation. C3b works around the symptom read-side only (the
  needs-attention panel excludes unlinked org-mailbox rows). Backlog carries
  both halves: normalise the `:308` comparison, and re-derive `primary_handle`
  for the 127 rows from the outbound counterpart.
- F-037 (found email-frame-oscillation C1, 2026-09-10; line refs post-C1):
  `src/modules/inbox/components/ConversationThread.tsx:1188-1189` — the two
  dedupe guards inside `ensureEmailHtmlLoaded` (:1183) read state through a
  closure that is permanently one render old, so both are dead code.
  `ensureEmailHtmlLoaded` is recreated every render but is reached only from
  `pumpEmailHtmlQueue` (:1386), which the visibility IntersectionObserver
  callback captures once — that effect's deps are `[scrollContainerRef]`
  (:1407-1437), so the observer holds the first render's closure for the
  component's life. `:1373` documents `pumpEmailHtmlQueue` as ref-only and
  therefore safe to capture stale, which is true of the function itself and
  false of its callee: `:1188` reads `emailHtmlByGmailMessageId` and `:1189`
  reads `emailHtmlLoadingByMessageId`, both frozen at the initial `{}`.
  Masked, not neutral. `emailHtmlAttemptedIdsRef` (:1384, checked :1417) is a
  real ref and covers the common case, but it differs from the dead guard on
  two axes. (a) Key: the ref dedupes by INBOX message id, `:1188` dedupes by
  GMAIL message id — two `inbox_messages` rows carrying the same Gmail message
  each queue and each fetch. (b) Lifetime: the ref is evicted when a message
  leaves the rendered list (:1113, bounded with the list — correct on its own
  terms), while `emailHtmlByGmailMessageId` persists, so scrolling a message
  out and back refetches HTML the component already holds. `:1188` was the
  guard for both; neither is verified against live rows.
  Not fixed in C1 (one concern per commit). The fix is a ref mirror of the two
  maps, or moving the guards to the ref-only caller.
- F-038 (found email-frame-oscillation C1, 2026-09-10):
  `src/modules/inbox/components/CustomerConversationView.tsx:288-294` — a bare
  `if (isError)` early-returns the placeholder for the WHOLE view, above the
  thread render at :296. TanStack raises `isError` on a failed background
  refetch while the last good `data` is still cached, so one transient failure
  unmounts the timeline, the thread, and every email iframe, discarding
  rendered state instead of keeping the cached timeline with an inline error.
  Compounds the C1/C2 class of defect: iframe remount is the expensive event
  here, and this path triggers it on a condition that is recoverable.
  Not fixed in C1. Fix shape: gate on `isError && !data?.length`, or render the
  error inline above the retained thread.
- F-039 (found arin/order-deceased-phase1-2 review, 2026-09-11; branch NOT
  merged, migration NOT applied live — `to_regclass` null, `schema_migrations`
  0 rows, 2026-09-12):
  The branch's migration `20260910121500` creates `order_deceased` with four
  policies `to anon, authenticated` `using (true)` / `with check (true)`
  (migration :57-67). Any holder of the anon key could read, insert, update and
  delete every org's deceased names — cross-org PII read AND write, violating
  supabase/CLAUDE.md's tenant-isolation rule for new business tables.
  The shape is copied from the TRACKED
  `supabase/migrations/20260125120000_create_order_people_table.sql:29-39`. The
  LIVE `order_people` policies (pg_policies, read 2026-09-10) are
  `{authenticated}` only with `user_is_member_of_org(organization_id)`
  (`orders` and `order_additional_options` identical). So the tracked
  order_people file is itself a drift instance — live safer than tracked,
  F-026 class; replaying it reopens the hole — and the new branch inherited the
  stale shape as precedent. Drift-audit scope +1 (backlog).
  Fix shape for rework: four policies `to authenticated` with
  `user_is_member_of_org(organization_id)`; tightening precedent
  `20260419130100_tighten_new_table_rls.sql`; `drop policy if exists` before
  each `create policy` (the branch's file is not idempotent — rerun fails at
  :57).
- F-040 (found arin/order-deceased-phase1-2 review, 2026-09-11; branch NOT
  merged):
  The branch's deceased-name convention is inverted for partner-portal orders,
  and the equal-name rule blanks a column other code reads as a key.
  Convention. Mason: `orders.customer_name` = deceased (`20260106003849:16`
  column comment; `orderTransform.ts:71`).
  `../SearsMelvin/functions/api/partner-orders.js:470-474` writes the LIVING
  customer → `customer_name` and the deceased → `person_name`. The branch's
  "never map person_name → deceased" rule (`permitTracker.api.ts`,
  `chaseTemplates.ts`, `PermitCard.tsx`) would therefore display — and EMAIL,
  via the chase templates — the living customer as the deceased on every
  partner order; the backfill in the same migration (diff :1071-1084, all orgs,
  no predicted count, no rows-affected block) would insert the living name as
  the primary deceased for those rows; `EditOrderDrawer` persists the same on
  save. The portal quote RPC (`../SearsMelvin/migrations/2026-05-20-create-quote-rpc.sql:117`)
  writes `customer_name = coalesce(v_name,'Website lead'), person_name =
  v_name`, so every portal quote is an equal-name row by construction.
  Equal-name rule (`deceasedNames.ts:775-784`, trim + casefold): equal ⇒
  deceased "missing" ⇒ `customerNameForOrderWrite` returns `''`, with no
  override — a same-named deceased cannot be recorded, and any
  `EditOrderDrawer` save of an equal-name order (a stone-status change, say)
  rewrites `customer_name` to `''`. Same helper in `CreateOrderDrawer`,
  `CreateInvoiceDrawer` and `orderFromQuoteConversion`.
  Blanking breaks readers of that column:
  `revolut-sync-transactions/index.ts:69-82` surname-matches bank transactions
  on `orders_with_balance.customer_name`; `finance.api.ts:185` and
  `hub.api.ts:199` `?? 'Unknown'` fallbacks are bypassed by `''` (blank rows);
  `UniversalSearch.tsx:63,152` searches it. 175 occurrences / 64 files in
  `src/` plus 19 / 5 edge functions; the diff assesses none.
  Dual-write `upsertOrderDeceased` (diff :228-291): delete by `order_id` →
  select org → insert → update `orders.customer_name` by `id` — four
  PostgREST calls, no transaction, no `RETURNING`, neither the delete nor the
  update org-guarded (relies on the RLS that F-039 shows is `using (true)`).
  Failure after the delete leaves zero rows and a stale name. The read side
  (`Order.deceased?`, `fetchOrderDeceased`, `useOrderDeceased`) has zero
  consumers, so "order_deceased owns truth" holds only in comments.
  Not fixed: needs a one-page spec (purpose, readers, name convention vs the
  portal, equal-name handling) before rework — Awaiting Arin. Live counts of
  equal-name and partner-origin rows per live org are Giorgi's to run before
  any rule or backfill is written.
- F-041 (found arin/ux-inquiries-readability review H2, 2026-09-11; policies
  confirmed live 2026-09-12):
  `enquiries` carries live RLS — `enquiries_select_by_org`,
  `enquiries_modify_by_org`, qual = org membership — and NO tracked migration in
  Mason or `../SearsMelvin` creates them (grep for a policy on `enquiries` over
  both repos' migrations: 0 hits). The first direct frontend read of the table
  is `src/modules/inbox/hooks/useEnquiryLabelByPersonId.ts:16-20` (the only
  `from('enquiries')` in Mason `src/`; the inquiries module reads via the
  `get_inquiries_pipeline` RPC and the portal via the service key), so the
  enquiry-label chip works today only because of untracked live objects: a
  replay of the tracked migrations would leave the table without them and the
  chip would read "Web chat / GHL" for every non-customer with no error.
  Not a hole; a record gap. Drift-audit class "live objects with no tracked
  source" (backlog).
