# Findings
Updated: 2026-09-02

- F-001: Seven rows in organizations; two live, one E2E, four test/leftover (see CLAUDE.local.md). Data volume in leftovers unknown. Classify and archive in schema cleanup (Day 9). Until then real-data queries include only the two live orgs.
- F-002: Gmail integration reads three differently named client-id/secret env pairs (GOOGLE_OAUTH_*, GMAIL_OAUTH_*, GMAIL_CLIENT_*). Drift; consolidate.
- F-003: STRIPE_CREDENTIALS_ENCRYPTION_KEY is the single key decrypting every org's Stripe credentials; rotation invalidates all at once. Document a rotation procedure before ever rotating.
- F-004: Sentry env names differ between vite.config.ts (SENTRY_ORG, SENTRY_PROJECT) and sentry-proxy (SENTRY_ORG_SLUG, SENTRY_PROJECT_SLUG). Harmless; note only.
- F-005: RESOLVED (A2). Bare `npx tsc --noEmit` confirmed to check nothing (solution tsconfig, `files: []`). `gate:tsc` (`scripts/gate-tsc.mjs`) runs `tsconfig.app.json` item-diffed against the baseline on `file(line,col): TScode` keys, plus `tsconfig.node.json` at zero. The baseline file's message text has drifted on 2 items (type-dump churn); keys still match 54/54, which is why the wrapper ignores message text.
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
- F-027: raw search term interpolated into PostgREST .or() grammar
  (inboxConversations.api.ts:54) — commas/parens in the search text corrupt
  the filter (wrong results or 400). Code-verified; live repro UNVERIFIED.
  Closed by the search RPC.
- F-028: inbox archive path never exercised — 100% status='open' in both
  orgs (Churchill 539/539, SM 1005/1005, live 2026-09-02);
  archiveConversations (inboxConversations.api.ts:157-168) has no live rows
  behind it; muting is the only triage in use. Consequence: every inbox
  fetch pulls the full corpus, unpaginated, no debounce.