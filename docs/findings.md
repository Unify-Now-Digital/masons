# Findings
Updated: 2026-09-03

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
