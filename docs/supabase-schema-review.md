# Supabase Schema Review — Mason App

Branch reviewed: `origin/staging` (latest migration `20260426090100_sears_melvin_test_data_rpcs.sql`).
Project ID: `bfwohzcugtwbhhxdqgme`.

Each finding is structured as: **what's wrong → evidence → why it matters → proposed action**. Severity is split into P0 (do this week), P1 (next sprint), P2 (when convenient). At the end is a "non-issues" section so we don't re-litigate things that are already correct, and a meta finding on schema drift.

---

## Headline: schema drift

Of the tables described in the prose summary, only ~30 are created by numbered migrations under `supabase/migrations/`. Missing from version control: `customers`, `products`, `quotes`, `cemeteries`, `cemetery_contacts`, `cemetery_pricing`, `contact_handles`, `inbox_messages`, `inbox_conversations`. The prose's `partners`, `partner_sessions`, `admin_sessions`, `password_reset_tokens`, `customer_activity` tables don't exist in migrations at all — they appear to have been removed or were never source-controlled.

This means parts of the live schema cannot be reviewed from code, and a fresh environment cannot be reproduced from `supabase/migrations/`. Treat this as P0 and resolve before relying on the rest of the review.

**Action:** dump the live `public` schema (`pg_dump --schema-only --schema=public --no-owner --no-privileges`), diff against the migration set, and commit the missing definitions as a baseline migration `00000000000000_baseline.sql`. After that, every schema change goes through migrations.

---

## P0 — Security

### 1. Gmail OAuth tokens stored plaintext
- `supabase/migrations/20260218120000_create_gmail_connections.sql` declares `access_token` / `refresh_token` as plain text.
- `supabase/functions/gmail-oauth-callback/index.ts:119–120` inserts them unencrypted.
- A read-only DB compromise = silent Gmail account takeover for every connected user. Tokens are bearer credentials.
- **Action:** encrypt at rest. Reuse the AES-256-GCM helper at `supabase/functions/_shared/whatsappCrypto.ts`, rename columns `access_token_encrypted` / `refresh_token_encrypted`, migrate existing rows in a one-shot edge function (read plaintext, encrypt, update). Audit `gmail-sync`, `gmail-refresh-body`, `gmail-send-*` to use the new helper.

### 2. Twilio SMS webhook does not verify signatures
- `supabase/functions/_shared/twilioSignature.ts` exports `verifyTwilioSignatureForForm()`, but it is never imported by `supabase/functions/twilio-sms-webhook/index.ts`.
- Any unauthenticated `POST` is treated as a real Twilio callback. An attacker can fabricate inbound SMS, inject false orders, and pollute conversation history.
- **Action:** import the verifier at the top of the handler; reject with 403 on mismatch before any DB write. Add a unit test that POSTs an unsigned body and asserts rejection.

### 3. Revolut API credentials stored plaintext
- `supabase/migrations/20260403120000_payment_reconciliation_tables.sql` defines `revolut_connections.access_token`, `refresh_token`, **and** `webhook_signing_secret` as plain text.
- `20260403140000_security_hardening.sql` adds a `revolut_connections_safe` view but does not encrypt the underlying columns.
- DB compromise = ability to call Revolut Business API and forge inbound webhook signatures.
- **Action:** same column-level encryption strategy as #1. Lock the raw `revolut_connections` table behind service role; only expose `revolut_connections_safe` to authenticated users.

### 4. WhatsApp secret encryption is convention, not enforcement
- `whatsapp_connections.twilio_api_key_secret_encrypted` looks encrypted, but no DB constraint validates ciphertext format. Encryption lives only in `_shared/whatsappCrypto.ts`.
- A misuse of service role (or SQL injection into a path that uses service role) can write plaintext into the `_encrypted` column with no error.
- **Action:** add a `CHECK` constraint (or a `BEFORE INSERT/UPDATE` trigger) that the value matches the AES-GCM prefix produced by the helper. Belt-and-braces.

---

## P0 — Data integrity

### 5. Dual permit status, no sync
- `orders.permit_status` is the legacy 4-stage CHECK enum.
- `order_permits.permit_phase` was remapped to a 5-stage pipeline in `supabase/migrations/20260419120100_permits_five_stage_migration.sql:24–42` (destructive `UPDATE`).
- Nothing keeps the two columns aligned: no trigger, and app code writes one or the other depending on the path.
- **Action:** pick a single source of truth. Recommended: drop `orders.permit_status`; expose the latest phase via a view or a denormalised column that is **only** written by an `AFTER INSERT/UPDATE` trigger on `order_permits`. Update any reports that read `orders.permit_status` first.

### 6. Money-unit mismatch across three payment tables
| Column | Type | Unit |
|---|---|---|
| `orders.value`, `orders.permit_cost`, `quotes.value`, `invoices.amount` | `decimal/numeric(10,2)` | GBP pounds |
| `invoices.amount_paid`, `invoices.amount_remaining`, `invoice_payments.amount` | `bigint` | **pence** (`20260304120000` line 93) |
| `order_payments.amount` (Revolut reconciliation) | `numeric(10,2)` | GBP pounds (`20260403120000` line 31) |

Reconciling a Stripe payment in `invoice_payments` (pence) against an `order_payments` row (pounds) is a textbook 100× bug. Stripe edge functions currently convert correctly when calling Stripe, but cross-table arithmetic in SQL (e.g. `SUM(amount)` aggregations across both) is silently wrong.
- **Action:** standardise on bigint minor units everywhere. Introduce a domain `gbp_pence bigint` so casts are explicit. Audit any code or view that copies between these tables — particular attention to `orders_with_balance` and the `order_payments` triggers.

### 7. `order_proof_versions(proof_id, version)` is not UNIQUE
- `supabase/migrations/20260419120300_order_proof_versions.sql:19` declares `version int CHECK (version > 0)` and a non-unique index. Concurrent inserts can produce duplicate version numbers.
- **Action:** `CREATE UNIQUE INDEX … ON order_proof_versions (proof_id, version);`. Serialise version assignment with `MAX(version) + 1` inside a transaction or a per-proof advisory lock.

### 8. `inbox_conversations.external_thread_id` indexed but not UNIQUE
- `inbox_messages` correctly enforces `UNIQUE (channel, external_message_id) WHERE NOT NULL` (`20260205140000`). `inbox_conversations` only has a non-unique index.
- Find-or-create under concurrent webhook traffic can produce duplicate threads.
- **Action:** `CREATE UNIQUE INDEX … ON inbox_conversations (channel, external_thread_id) WHERE external_thread_id IS NOT NULL;`. Wrap inserts in `ON CONFLICT (channel, external_thread_id) DO UPDATE … RETURNING id`.

### 9. `activity_logs` has no `organization_id`
- `supabase/migrations/20260305120000_create_activity_logs_and_triggers.sql` keys the audit table by `user_id` + `entity_type` + `entity_id`. RLS is `user_id = auth.uid()`.
- Audit timelines can't be filtered by organisation; cross-tenant analysis can't be expressed safely with RLS; an admin who guesses `entity_id`s can probe across orgs.
- **Action:** add `organization_id uuid` (nullable for legacy rows), backfill from each entity's owning org, switch RLS to org-membership check, and index `(organization_id, entity_type, entity_id, created_at DESC)` for fast per-entity timelines.

---

## P1 — State machines and hygiene

### 10. Proof state machine has a dead branch
- `order_proofs.state` allows `changes_requested`, but no edge function transitions out of it. `proof-send/index.ts:273` requires `state = 'draft'` to send; after `changes_requested` nothing re-enters `draft` or `generating`.
- **Action:** document the intended cycle in code comments; add a state-transition trigger so invalid transitions error rather than silently no-op. Decide explicitly whether revisions go back to `generating` (regenerate) or `draft` (manual edit).

### 11. `order_proof_versions` and `order_proof_ai_checks` are write-only
- Created in `20260419120300` but `proof-generate/index.ts` and `proof-send/index.ts` never insert into them. Empty in production.
- **Action:** either implement the writers (likely an `AFTER UPDATE OF state` trigger on `order_proofs` that appends a version row), or drop the tables. Empty tables in prod attract spurious queries and migrations.

### 12. No `pg_cron` cleanup jobs
- `processed_webhook_events`, expired Gmail/Revolut access tokens, and abandoned `whatsapp_managed_connections` in `failed`/`disconnected` have no scheduled cleanup. The comment at `20260403140000_security_hardening.sql:85` says "events older than 30 days are safe to remove" but no job is created.
- **Action:** schedule a `pg_cron` job (or Supabase scheduled edge function) per table with a documented retention window.

### 13. `worker_availability` is missing `created_at`
- Has `updated_at` only. Breaks the standard "when was this row created" audit pattern.
- **Action:** `ALTER TABLE worker_availability ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();`.

### 14. Per-user singletons assume single-org membership
- `whatsapp_user_preferences.user_id` is the PK. If a user belongs to two orgs, the preference is shared across both.
- **Action:** change PK to `(user_id, organization_id)`.

### 15. Catalogue uniqueness scope unverified
- `products.slug`, `products.sku`, `customers.email` UNIQUE — can't be confirmed because the tables aren't in migrations (see "schema drift"). If global, two orgs cannot share a customer email or SKU.
- **Action:** after the baseline migration is committed, ensure these constraints are scoped per-org: `(organization_id, slug)`, `(organization_id, sku)`, `(organization_id, lower(email))`.

---

## P2 — Refinements

### 16. CHECK-constraint enums everywhere
Fine in general, but error-prone for the high-churn ones. Convert proof state, permit phase, and order status to Postgres enums or domain types so typos surface as parse errors. Note the prose was wrong about `whatsapp_managed_connections.state` — it is already CHECK, not ENUM, so no work needed there.

### 17. `quotes.total_value` generated formula
Confirm the formula sums everything chargeable (value + permit_cost + addons + per-character inscription pricing). Verification blocked on the schema drift in #0.

### 18. JSONB columns lack GIN indexes
`activity_logs.changes`, `inbox_messages.meta`, `orders.product_config`. Add GIN only on columns actually queried by path expressions; skip otherwise.

### 19. Full-text search
When inbox / customer / order search comes up, the standard fix is generated `tsvector` columns + GIN. Currently absent.

### 20. Order / invoice / quote numbers
Confirm the underlying sequences are per-org. Global sequences leak business volume to customers and risk uniqueness collisions if the project ever shards.

---

## Non-issues (already correct — don't re-flag)

- Stripe webhook signature verification — correct (`stripe-webhook/index.ts:45–58`, HMAC-SHA256 via SDK).
- Revolut webhook signature verification — correct, with a 5-minute replay window (`revolut-webhook/index.ts:20–51`).
- `inbox_messages` webhook idempotency — enforced by `UNIQUE (channel, external_message_id) WHERE NOT NULL`.
- `invoice_payments` has UNIQUE indexes on Stripe identifiers.
- `order_people.is_primary` has the correct partial-unique index (`UNIQUE (order_id) WHERE is_primary = true`).
- All migration-defined tables use `uuid` PKs with `gen_random_uuid()`. The prose's `partners` / `customer_activity` int4 PKs no longer apply — those tables aren't in the schema.
- Stripe money conversion (× 100 to pence) in edge functions is consistent.
- Most tables have `created_at`/`updated_at` via the `update_updated_at_column()` trigger.
- Gmail / WhatsApp connections enforce one-active-per-user via partial unique indexes (`gmail_connections (user_id) WHERE status = 'active'`, `whatsapp_connections (user_id) WHERE status = 'connected'`).
- Soft-delete on `invoices` is the only one — confirmed deliberate (legal retention).

---

## Suggested triage table

| # | Item | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| 0 | Commit baseline migration for dashboard-managed tables | P0 | M | Unblocks everything else |
| 1 | Encrypt Gmail OAuth tokens | P0 | M | + migration of existing rows |
| 2 | Add Twilio webhook signature verification | P0 | S | One-line import + tests |
| 3 | Encrypt Revolut tokens & signing secret | P0 | M | Same pattern as #1 |
| 4 | Enforce WhatsApp ciphertext format at DB | P0 | S | CHECK or trigger |
| 5 | Resolve dual permit status | P0 | M | Drop legacy column or trigger-sync |
| 6 | Standardise money to bigint pence | P0 | M | Domain type + audit views |
| 7 | UNIQUE on `(proof_id, version)` | P0 | S | Trivial migration |
| 8 | UNIQUE on `(channel, external_thread_id)` | P0 | S | Trivial migration |
| 9 | Add `organization_id` to `activity_logs` | P0 | M | Backfill + RLS rewrite |
| 10 | Document & enforce proof state transitions | P1 | M | |
| 11 | Drop or wire up `order_proof_versions` / `_ai_checks` | P1 | S–M | |
| 12 | Schedule `pg_cron` cleanup jobs | P1 | S | |
| 13 | `worker_availability.created_at` | P1 | S | |
| 14 | `whatsapp_user_preferences` PK to `(user_id, org_id)` | P1 | S | |
| 15 | Per-org catalogue uniqueness | P1 | S | After #0 |
| 16–20 | Enums, JSONB GIN, FTS, generated columns, sequence scoping | P2 | varies | |
