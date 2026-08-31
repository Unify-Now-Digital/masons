# Findings
Updated: 2026-09-01

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
- F-012: Churchill has zero rows in `jobs` and almost no `people` (only
  WhatsApp auto-created contacts). Not using the app yet — confirm with
  Arin whether intentional or a stalled rollout.
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
- F-017: stripe-revise-invoice and invoices-delete void the Stripe
  invoice only; stripe-void-invoice already expires the stored session
  on disk (:176-220 — verify deployed matches repo). Partial sessions
  stay payable after revise/delete/manual-dashboard voids (bounded by
  Stripe's 24h session auto-expiry); a second partial link overwrites
  the stored cs_ id without expiring the prior session. Webhook has no
  void guard: paying a stale partial session today = charged customer,
  attachPayment 500-retry loop, nothing recorded, no alert. Fix sized S
  (plan file 2026-09-01): expire in revise+delete, expire-before-
  overwrite in payment-link, list-by-customer belt-and-braces, webhook
  void guard. Found T5b E2E 2026-09-01; investigated 2026-09-01.