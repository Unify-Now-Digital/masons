# Research: Per-Organization Stripe Payments (012-per-org-stripe)

**Date**: 2026-06-04

## R1 — Credential storage pattern (mirror GHL)

**Decision**: New table `public.organization_stripe_config` (one row per `organization_id`) with `pgp_sym_encrypt` bytea columns for secret keys and webhook signing secrets; publishable keys stored as plain `text` (client-safe per spec).

**Rationale**: Matches proven `ghl_connections.ghl_api_key` + `get_ghl_api_key` RPC pattern (`20260522120000_ghl_connections_api_key.sql`). Column-level `REVOKE SELECT` on ciphertext from `authenticated`/`anon`; decrypt only via `SECURITY DEFINER` RPC executed by Edge with `STRIPE_CREDENTIALS_ENCRYPTION_KEY` env (same operational model as `GHL_API_KEY_ENCRYPTION_KEY`).

**Alternatives considered**:
- **Supabase Vault / external KMS**: stronger, deferred (operator-managed v1).
- **Single rotating credential row**: rejected per clarification (dual test/live sets).
- **Stripe Connect**: explicitly out of scope.

## R2 — Runtime credential selection (test vs live)

**Decision**: `resolveStripeCredentials(orgId)` returns `{ mode: 'test' | 'live', secretKey, publishableKey, webhookSecret }` where `mode = live_payments_enabled ? 'live' : 'test'`. Validate key prefix (`sk_test_` / `sk_live_`) before API calls; return 400 `mode_mismatch` if live flag on but key is test (and vice versa for live charges).

**Rationale**: Implements FR-001a without deleting test credentials at go-live. Operators keep test webhooks for regression.

**Alternatives considered**:
- **Infer mode only from key prefix**: rejected; live disable must force test even if live keys exist.

## R3 — Webhook org routing and signature verification

**Decision**: Single Edge Function `stripe-webhook` accepts `?organization_id=<uuid>`. Load org config; verify signature using **both** test and live webhook secrets for that org (try test secret first when `event.livemode === false`, else live-first — or try both on failure). Reject if neither verifies.

**Rationale**: Stripe signing secret is per Stripe account (test account vs live account), not per Mason “live enabled” flag. `event.livemode` is only available after parse — dual-secret try is safe and avoids two URL shapes.

**Post-verify**: Load Mason invoice by `stripe_invoice_id` / metadata `invoice_id`; assert `invoices.organization_id ===` URL org id (FR-007).

**Alternatives considered**:
- **Separate endpoints** `/stripe-webhook-test` and `/stripe-webhook-live`: clearer but duplicates handler code; not required by spec.
- **Trust livemode from unsigned JSON**: rejected (security).

## R4 — In-flight live checkout credential context

**Decision**: On checkout session creation, persist `invoices.stripe_credential_mode` (`'test' | 'live'`) and include same value in session `metadata`. Webhook handler uses **stored mode** on the invoice (not current `live_payments_enabled`) to pick webhook secret and Stripe API client for attach_payment / retrieve calls.

**Rationale**: Implements FR-009b: disable live does not strand in-flight sessions on wrong signing secret or test API key mid-payment.

**Alternatives considered**:
- **Snapshot secrets on session**: overkill; mode pointer sufficient.

## R5 — Test round trip gate

**Decision**: Column `test_round_trip_passed_at timestamptz` set by webhook handler only when: (1) verified webhook used test signing secret / `livemode=false`, (2) path-authoritative paid reconciliation succeeded for a Mason invoice of that org. RPC/Edge `enable_live_payments(org_id)` checks non-null timestamp before allowing `live_payments_enabled = true`.

**Rationale**: Hard block per clarification; no attestation checkbox.

## R6 — Platform operator authorization

**Decision**: Credential upsert and live toggle via new Edge Function `stripe-org-config` gated by **`ADMIN_EMAILS`** JWT allowlist (same as `sentry-proxy`) **plus** existing `X-Admin-Token` / `INBOX_ADMIN_TOKEN` for scripting. No org-admin write path in v1.

**Rationale**: Spec FR-010; reuses `001-admin-sentry-monitor` pattern. Stripe invoice Edge Functions keep `INBOX_ADMIN_TOKEN` for staff-initiated invoice actions; only **config** writes require platform admin.

**Alternatives considered**:
- **INBOX_ADMIN_TOKEN only**: too weak for live secret registration.
- **DB `platform_operators` table**: deferred.

## R7 — Paid-state authority (bug fix)

**Decision**:

| Path | Authoritative webhook | Mason `status=paid` |
|------|----------------------|---------------------|
| Legacy / one-time checkout (`metadata.invoice_id`) | `checkout.session.completed` | Yes (existing logic) |
| Hosted Stripe invoice / partial checkout on Stripe Invoice | `invoice.paid` | Yes |
| Partial sync only | `invoice.updated`, `invoice.payment_succeeded` | Sync amounts/status fields only; **do not** set `status=paid` unless `invoice.paid` also received |
| Fallback | `payment_intent.succeeded` | **Remove paid side effects** — metadata/audit only or no-op |

**Rationale**: Fixes observed contradiction: `payment_intent.succeeded` inserted `invoice_payments` with `status=paid` without updating Mason invoice consistently; `checkout.session.completed` partial flow called `insertInvoicePaymentOnce` without always setting invoice paid. Aligns with clarification C.

**Implementation note**: After `invoice.paid`, optionally fetch Stripe Invoice via org-scoped client and assert `amount_remaining === 0` before `status=paid` (FR-014).

## R8 — Global env deprecation

**Decision**: Phase rollout: (1) ship per-org config + resolver; (2) migrate Churchill; (3) remove reads of `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY` for orgs with config rows; (4) fail closed if invoice `organization_id` has no config. Keep global env temporarily for single-org fallback behind feature flag **off** in production.

**Rationale**: Prevents accidental cross-tenant routing during migration.

## R9 — Client publishable key

**Decision**: New Edge Function `stripe-get-publishable-key` (JWT authenticated, org member): input `{ invoice_id }`, returns `{ publishable_key, mode }` from resolved credentials. `StripeProvider` / `StripePaymentForm` accept per-invoice `publishableKey` prop via `loadStripe(publishableKey)` instead of global `VITE_STRIPE_PUBLISHABLE_KEY`.

**Rationale**: FR-005; avoids exposing secret keys; removes global key footgun.

## R10 — Stripe Dashboard webhook URL format

**Decision**: Document per-org URLs:

```text
https://<project-ref>.supabase.co/functions/v1/stripe-webhook?organization_id=<ORG_UUID>
```

Configure **separately** in each organisation's **test** and **live** Stripe Dashboard webhook settings (same URL path; different signing secrets stored in Mason test vs live columns).

**Events to subscribe** (minimum): `checkout.session.completed`, `invoice.paid`, `invoice.updated`, `invoice.payment_succeeded`, `invoice.payment_failed`. Remove reliance on `payment_intent.succeeded` for paid state.
