# Tasks: Per-Organization Stripe Payments (Tenant Isolation)

**Input**: Design documents from `specs/012-per-org-stripe/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested — manual verification per [quickstart.md](./quickstart.md) only.

**Organization**: Tasks grouped by user story. **MVP** = Phase 1 + Phase 2 + Phase 3 (US6) + Phase 4 (US5) + Phase 5 (US3 webhook) + Phase 6 checkout path (T026–T027, T033) + T038–T040 (register creds + test round trip).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Secrets and operator prerequisites before schema or Edge work

- [ ] T001 **User task**: Set `STRIPE_CREDENTIALS_ENCRYPTION_KEY` in Supabase secrets (32+ chars); document in password manager per [quickstart.md](./quickstart.md)
- [ ] T002 **User task**: Confirm `ADMIN_EMAILS` includes platform implementation operator emails (mirror `VITE_ADMIN_EMAIL` for local admin UI tests)
- [ ] T003 [P] **User task**: Collect Churchill org UUID and second control org UUID for webhook URLs and two-org audit (SC-001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, decrypt RPCs, shared credential resolver, and `stripe-org-config` — **MUST complete before webhook or payment routing**

**Schema discipline**: Cursor commits migration SQL only. **User** applies on Supabase via Dashboard. Cursor must **not** auto-push schema.

- [X] T004 Create migration `supabase/migrations/YYYYMMDDHHmmss_organization_stripe_config.sql`: table `public.organization_stripe_config` per [data-model.md](./data-model.md); RLS enabled; revoke `SELECT` on encrypted columns from `authenticated`/`anon`
- [X] T005 [P] In same migration: add RPCs `public.get_stripe_secret_key` and `public.get_stripe_webhook_secret` (`SECURITY DEFINER`, `service_role` execute only) per [data-model.md](./data-model.md)
- [X] T006 [P] In same migration: add `public.invoices.stripe_credential_mode` (`text` check `test`|`live`) per [data-model.md](./data-model.md)
- [ ] T007 **User task (Dashboard)**: Apply migration; run `NOTIFY pgrst, 'reload schema';`
- [X] T008 Implement `supabase/functions/_shared/stripeOrgCredentials.ts`: `getOrgStripeConfig`, `resolveStripeCredentials`, `createStripeClient`, `assertKeyModeMatch` per [research.md](./research.md)
- [X] T009 Scaffold `supabase/functions/stripe-org-config/index.ts`: CORS, `json()` helper, JWT + `ADMIN_EMAILS` allowlist (mirror `supabase/functions/sentry-proxy/index.ts`)
- [X] T010 Implement `upsert_credentials` in `supabase/functions/stripe-org-config/index.ts`: encrypt secrets, validate `sk_test_`/`sk_live_`/`pk_test_`/`pk_live_` prefixes, reset `test_round_trip_passed_at = NULL` per [contracts/stripe-org-config.md](./contracts/stripe-org-config.md)
- [X] T011 Implement `enable_live` and `disable_live` in `supabase/functions/stripe-org-config/index.ts`: hard-block `enable_live` when `test_round_trip_passed_at` is null; require live triplet present per [contracts/stripe-org-config.md](./contracts/stripe-org-config.md)
- [ ] T012 **User task (CLI)**: Deploy `npx supabase functions deploy stripe-org-config --project-ref <project-ref>`

**Checkpoint**: `stripe-org-config` returns 403 for non-admin JWT; `upsert_credentials` stores encrypted row; `enable_live` returns `test_round_trip_required` before test pass

---

## Phase 3: User Story 6 — Organisation-scoped inbound webhooks (Priority: P1)

**Goal**: Webhooks identify org from URL, verify with that org's signing secret, reject cross-tenant invoice updates

**Independent Test**: Send Stripe CLI event to `stripe-webhook?organization_id=A` with A's `whsec`; confirm reconciliation only when invoice belongs to A; wrong org in URL logs `org_mismatch` at high visibility

- [X] T013 [US6] Parse and validate `organization_id` query param in `supabase/functions/stripe-webhook/index.ts`; return 400 when missing or unknown org
- [X] T014 [US6] Replace global webhook verification with dual test/live `whsec` try per org via `stripeOrgCredentials.ts` in `supabase/functions/stripe-webhook/index.ts` per [contracts/stripe-webhook.md](./contracts/stripe-webhook.md)
- [X] T015 [US6] Add post-verify invoice `organization_id` match check; on mismatch return 200 ignored + **error-level** structured log (`org_mismatch`, url org, invoice org, event id) per [contracts/stripe-webhook.md](./contracts/stripe-webhook.md)
- [X] T016 [US6] Remove reads of global `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` from `supabase/functions/stripe-webhook/index.ts` (fail closed if org config missing)
- [ ] T017 [US6] **User task**: Register webhook URL `.../stripe-webhook?organization_id=<ORG_UUID>` in **test** Stripe Dashboard for pilot org; confirm events subscribed per [quickstart.md](./quickstart.md)

**Checkpoint**: Valid signature + matching org updates data; signature valid + org mismatch does not mutate Mason row but logs loudly

---

## Phase 4: User Story 5 — Consistent paid state across Mason and Stripe (Priority: P1)

**Goal**: Single authoritative paid signal per payment path; no `payment_intent.succeeded`-only paid state

**Independent Test**: Pay test invoice via checkout path → paid only after `checkout.session.completed` with `stripe_checkout_session_id` set; hosted invoice → paid only after `invoice.paid` with `stripe_invoice_id` set

- [X] T018 [US5] Add `resolvePaymentPath(invoice)` in `supabase/functions/stripe-webhook/index.ts` using `stripe_checkout_session_id` vs `stripe_invoice_id` per [contracts/stripe-webhook.md](./contracts/stripe-webhook.md)
- [X] T019 [US5] Gate `checkout.session.completed` Mason `status=paid` updates to **checkout path** invoices only in `supabase/functions/stripe-webhook/index.ts`
- [X] T020 [US5] Gate `invoice.paid` Mason `status=paid` updates to **hosted-invoice path** invoices only in `supabase/functions/stripe-webhook/index.ts`
- [X] T021 [US5] Limit `invoice.payment_succeeded` and `invoice.updated` to amount/status sync without setting `status=paid` in `supabase/functions/stripe-webhook/index.ts`
- [X] T022 [US5] Remove paid-state side effects from `payment_intent.succeeded` handler in `supabase/functions/stripe-webhook/index.ts` (metadata-only or no-op)
- [X] T023 [US5] Use `invoices.stripe_credential_mode` (fallback: current resolved mode) for Stripe API calls inside `checkout.session.completed` in `supabase/functions/stripe-webhook/index.ts`

**Checkpoint**: No new payments leave Mason paid while Stripe shows full balance outstanding on same invoice (SC-004 smoke on test org)

---

## Phase 5: User Story 3 — Verified test round trip before live money (Priority: P1)

**Goal**: System records test pass automatically; live enable blocked until pass after latest credential upsert

**Independent Test**: With `live_payments_enabled=false`, complete test payment → `test_round_trip_passed_at` set; `enable_live` succeeds only then

- [X] T024 [US3] On test-mode (`livemode=false`) authoritative paid reconciliation, set `organization_stripe_config.test_round_trip_passed_at` in `supabase/functions/stripe-webhook/index.ts` per [contracts/stripe-webhook.md](./contracts/stripe-webhook.md)
- [ ] T025 [US3] **User task (CLI)**: Deploy `npx supabase functions deploy stripe-webhook --project-ref <project-ref>`

**Checkpoint**: Test payment round trip sets timestamp; credential re-upsert clears it (via T010); live blocked until new pass

---

## Phase 6: User Story 1 — Every payment uses the owning organisation's account (Priority: P1) 🎯 MVP

**PREREQUISITE:** **T039–T041** (US2 credential registration) **MUST** be completed before **T026** / **T042** — a payment round trip cannot run without registered org credentials. The phase numbering does not reflect this; follow the dependency table, not the phase number alone.

**Goal**: All Stripe API calls and client publishable key resolve from invoice `organization_id`

**Independent Test**: Pay invoices for org A and org B in test mode; charges appear only in each org's Stripe Dashboard

- [ ] T026 [US1] Refactor `supabase/functions/stripe-create-checkout-session/index.ts`: load `organization_id` from invoice; `createStripeClient(orgId)`; fail closed without config
- [ ] T027 [US1] Persist `invoices.stripe_credential_mode` at session creation in `supabase/functions/stripe-create-checkout-session/index.ts`
- [ ] T028 [P] [US1] Refactor `supabase/functions/stripe-create-invoice/index.ts` for per-org credentials via `stripeOrgCredentials.ts`
- [ ] T029 [P] [US1] Refactor `supabase/functions/stripe-send-invoice/index.ts` for per-org credentials via `stripeOrgCredentials.ts`
- [ ] T030 [P] [US1] Refactor `supabase/functions/stripe-fetch-invoice/index.ts` for per-org credentials via `stripeOrgCredentials.ts`
- [ ] T031 [P] [US1] Refactor `supabase/functions/stripe-revise-invoice/index.ts` for per-org credentials via `stripeOrgCredentials.ts`
- [ ] T032 [P] [US1] Refactor `supabase/functions/stripe-create-invoice-payment-link/index.ts` for per-org credentials via `stripeOrgCredentials.ts`
- [ ] T033 [US1] Block new **live** checkout/invoice payment initiation when `live_payments_enabled=false` or mode mismatch in `supabase/functions/stripe-create-checkout-session/index.ts` (and hosted-invoice creators as applicable)
- [ ] T034 [US1] Implement `supabase/functions/stripe-get-publishable-key/index.ts` per [contracts/stripe-get-publishable-key.md](./contracts/stripe-get-publishable-key.md)
- [ ] T035 [US1] Update `src/modules/payments/components/StripePaymentForm.tsx` to call `stripe-get-publishable-key` and use dynamic `loadStripe(publishableKey)`
- [ ] T036 [US1] Update `src/modules/payments/components/StripeProvider.tsx` to support per-invoice key (remove sole dependency on `VITE_STRIPE_PUBLISHABLE_KEY` when org config exists)
- [ ] T037 [US1] Surface `payment_not_configured` and live-disabled errors in `src/modules/invoicing/components/InvoiceDetailSidebar.tsx` and/or `src/modules/invoicing/api/stripe.api.ts`
- [ ] T038 [US1] **User task (CLI)**: Deploy updated Stripe Edge Functions (`stripe-create-checkout-session`, invoicing functions, `stripe-get-publishable-key`)

**Checkpoint**: Org A payment never appears in Org B Stripe account (SC-001); checkout UI uses org publishable key only

---

## Phase 7: User Story 2 — Operator registers credentials once per organisation (Priority: P1)

**Goal**: Platform operator registers dual credential sets; staff cannot register secrets

**Independent Test**: After one `upsert_credentials`, subsequent checkout/webhook work without re-entry; non-admin cannot call `stripe-org-config`

- [ ] T039 [US2] **User task**: `upsert_credentials` for pilot org (test + live triplets) via `stripe-org-config` with platform admin JWT per [quickstart.md](./quickstart.md)
- [ ] T040 [US2] **User smoke**: Confirm response never includes secret keys; org member JWT receives 403 on `stripe-org-config`
- [ ] T041 [US2] **User task**: Register **live** Stripe account webhook URL with same `organization_id` query param; store live `whsec` via upsert

**Checkpoint**: US2 — credentials stored encrypted; day-to-day staff use invoicing without credential prompts

---

## Phase 8: User Story 3 — Test round trip verification (Priority: P1)

**Goal**: Operator validates automated gate before Churchill live enablement

**Independent Test**: Full quickstart test path; `enable_live` blocked then succeeds

- [ ] T042 [US3] **User task**: Run test-mode round trip (checkout or hosted invoice → pay → webhook → Mason paid) per [quickstart.md](./quickstart.md)
- [ ] T043 [US3] **User task**: Confirm `test_round_trip_passed_at` populated; call `enable_live` — expect 400 before pass, 200 after
- [ ] T044 [US3] **User task**: After small refunded live charge (FR-013 checklist), `enable_live` for Churchill only

**Checkpoint**: US3 — live enablement impossible without recorded test pass since last credential upsert

---

## Phase 9: User Story 4 — Progressive per-organisation live enablement (Priority: P2)

**Goal**: Live toggle per org; disable stops new live initiation; in-flight sessions complete

**Independent Test**: Enable Churchill live only; control org stays test-only; `disable_live` blocks new live checkout while open session can finish

- [ ] T045 [US4] **User smoke**: With live enabled, `disable_live` for org — confirm new live checkout blocked with clear staff message (T033/T037)
- [ ] T046 [US4] **User task**: Start live checkout, call `disable_live` mid-session, complete payment — Mason reconciles using `stripe_credential_mode=live` per [quickstart.md](./quickstart.md)
- [ ] T047 [US4] **User task**: Confirm second org `live_payments_enabled` unchanged (SC-005)

**Checkpoint**: US4 — kill switch works without deploy; pilot isolation between orgs

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Lint, audits, optional global env removal

- [ ] T048 [P] Run `npm run lint` from repository root
- [ ] T049 **User task**: Complete [quickstart.md](./quickstart.md) verification checklist (webhook URL per org, org_mismatch log check, path-specific paid, idempotency spot-check)
- [ ] T050 **User task**: Two-organisation test audit (SC-001) — document results in operator runbook
- [ ] T051 [P] Optional cleanup: remove remaining global `STRIPE_*` env reads from `supabase/functions/stripe-*/index.ts` once all active orgs have `organization_stripe_config` rows

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **blocks all user stories**
- **US6 (Phase 3)**: Depends on Foundational (config rows + `stripeOrgCredentials.ts`)
- **US5 (Phase 4)**: Depends on Phase 3 (same `stripe-webhook/index.ts`)
- **US3 webhook (Phase 5)**: Depends on Phase 4 (authoritative paid must work before recording test pass)
- **US1 (Phase 6)**: Depends on Foundational; webhook deploy (T025) recommended before end-to-end payment test
- **US2 (Phase 7)**: Depends on T012 (`stripe-org-config` deployed); can run in parallel with Phase 3–5 if credentials needed for webhook tests
- **US3 verification (Phase 8)**: Depends on Phases 6–7 + T025
- **US4 (Phase 9)**: Depends on Phase 8 (live enable after test pass)
- **Polish (Phase 10)**: After desired stories complete

### User Story Dependencies

| Story | Depends on | Can start after |
|-------|------------|-----------------|
| US6 | Foundational | T012 |
| US5 | US6 (webhook file) | T016 |
| US3 (record) | US5 | T022 |
| US1 | Foundational | T008 |
| US2 | stripe-org-config | T012 |
| US3 (verify) | US1 + US2 + webhook deploy | T038, T025 |
| US4 | US3 verify | T043 |

### Parallel Opportunities

- **Phase 2**: T005 and T006 [P] in parallel after T004 migration file drafted
- **Phase 6**: T028–T032 [P] — five invoicing Edge Functions (different files)
- **Phase 6**: T034–T036 [P] — new Edge function + frontend (after T008)
- **Phase 10**: T048 and T051 [P]

### Parallel Example: User Story 1 (invoicing functions)

```bash
# After T026–T027 checkout session done, launch in parallel:
T028 stripe-create-invoice/index.ts
T029 stripe-send-invoice/index.ts
T030 stripe-fetch-invoice/index.ts
T031 stripe-revise-invoice/index.ts
T032 stripe-create-invoice-payment-link/index.ts
```

---

## Implementation Strategy

### MVP First (minimum shippable isolation)

1. Complete Phase 1–2 (schema + `stripe-org-config` + shared resolver)
2. Complete Phase 3–5 (org webhook + paid-state fix + test-pass recording)
3. Complete T026–T027, T033 (per-org checkout)
4. T039–T042 (register creds + test round trip)
5. **STOP and VALIDATE** before Churchill `enable_live`

### Incremental Delivery

1. Foundation → org webhooks → paid-state fix → outbound API routing → client publishable key → operator gates → live pilot

### Suggested MVP scope

Phases **1–5** plus **T026–T027, T033, T039–T042** — proves tenant-isolated test-mode payments and live-enable gate without requiring all invoicing Edge refactors (T028–T032 can follow immediately after).

---

## Notes

- Prefer JWT + `ADMIN_EMAILS` for `stripe-org-config`; avoid `INBOX_ADMIN_TOKEN` for live secret writes in v1 unless scripted onboarding is required ([contracts/stripe-org-config.md](./contracts/stripe-org-config.md))
- Credential rotation **always** clears `test_round_trip_passed_at` — re-run test round trip before `enable_live`
- Webhook URL misconfiguration surfaces as **high-visibility `org_mismatch` logs**, not silent success
- Path authority uses invoice columns, not event metadata alone
