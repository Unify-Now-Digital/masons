# Implementation Plan: Per-Organization Stripe Payments (Tenant Isolation)

**Branch**: `012-per-org-stripe` | **Date**: 2026-06-04 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/012-per-org-stripe/spec.md` + clarifications session 2026-06-04

## Summary

Replace the **global** `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `VITE_STRIPE_PUBLISHABLE_KEY` integration with **per-organisation dual credential sets** (test + live), encrypted at rest using the same `pgp_sym_encrypt` + service-role RPC pattern as GHL. All seven existing Stripe Edge Functions and the webhook resolve credentials from `invoices.organization_id`. Webhooks use `?organization_id=` for tenant routing before signature verification. Fix paid-state bugs by enforcing **path-specific** webhook authority and removing `payment_intent.succeeded` paid side effects. **Churchill** is first live enablement after automated test round trip.

## Technical Context

**Language/Version**: TypeScript 5.x (Vite React 18); Deno (Supabase Edge Functions)  
**Primary Dependencies**: `npm:stripe@14.21.0`, `@supabase/supabase-js`, TanStack React Query, `@stripe/react-stripe-js`  
**Storage**: PostgreSQL — new `public.organization_stripe_config`; additive `invoices.stripe_credential_mode`  
**Testing**: `npm run lint`; manual [quickstart.md](./quickstart.md); two-org test audit (SC-001)  
**Target Platform**: Supabase Edge + Vite web app  
**Project Type**: Brownfield — `supabase/functions/stripe-*`, `src/modules/invoicing`, `src/modules/payments`  
**Performance Goals**: No regression on checkout creation; webhook handling &lt;3s p95  
**Constraints**: Fail closed on missing org config; platform operators only for credential writes; no Stripe Connect; no payment schema rewrites  
**Scale/Scope**: ~2 pilot orgs (Churchill + one control); 7 existing Stripe functions + 2 new + 1 shared helper + 1 migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|--------|
| Dual router (`src/app/` + `src/pages/`) | **Pass** | No route changes; invoicing/payments components only |
| Module boundaries | **Pass** | Changes in `invoicing`, `payments`; shared Stripe helper in Edge `_shared` |
| Supabase + RLS | **Pass** | New config table RLS; decrypt RPCs service-role only |
| Secrets server-side | **Pass** | All secret keys/webhook secrets in Edge + encrypted bytea |
| Additive-first | **Pass** | New table + one invoice column; global env deprecated not deleted in v1 |

**Post-design re-check**: **Pass** — tenant isolation on every path; webhook org mismatch fails closed.

## Phase 0: Research

See [research.md](./research.md). All technical context items resolved; no NEEDS CLARIFICATION remain.

## Phase 1: Design artifacts

| Artifact | Purpose |
|----------|---------|
| [data-model.md](./data-model.md) | `organization_stripe_config`, RPCs, `stripe_credential_mode` |
| [contracts/stripe-org-config.md](./contracts/stripe-org-config.md) | Platform operator credential + live toggle API |
| [contracts/stripe-webhook.md](./contracts/stripe-webhook.md) | Org-scoped webhook URL + event authority |
| [contracts/stripe-get-publishable-key.md](./contracts/stripe-get-publishable-key.md) | Client publishable key per invoice |
| [quickstart.md](./quickstart.md) | Deploy order, Churchill rollout, verification |

## Project Structure

### Documentation (this feature)

```text
specs/012-per-org-stripe/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── stripe-org-config.md
│   ├── stripe-webhook.md
│   └── stripe-get-publishable-key.md
├── checklists/
│   └── requirements.md
└── tasks.md              # /speckit.tasks (next command)
```

### Source Code (repository root)

```text
supabase/
├── migrations/
│   └── YYYYMMDDHHmmss_organization_stripe_config.sql
├── functions/
│   ├── _shared/
│   │   └── stripeOrgCredentials.ts          # NEW — resolve, validate, decrypt
│   ├── stripe-org-config/
│   │   └── index.ts                           # NEW — platform admin upsert / live toggle
│   ├── stripe-get-publishable-key/
│   │   └── index.ts                           # NEW — JWT member → publishable key
│   ├── stripe-webhook/
│   │   └── index.ts                           # org query param, dual whsec, paid-state fix
│   ├── stripe-create-checkout-session/
│   │   └── index.ts                           # org credentials + stripe_credential_mode
│   ├── stripe-create-invoice/
│   ├── stripe-send-invoice/
│   ├── stripe-fetch-invoice/
│   ├── stripe-revise-invoice/
│   └── stripe-create-invoice-payment-link/

src/
├── modules/
│   ├── invoicing/
│   │   └── api/stripe.api.ts                  # unchanged call shapes; server picks creds
│   └── payments/
│       ├── components/StripeProvider.tsx      # per-key loadStripe or prop-driven
│       └── components/StripePaymentForm.tsx   # fetch publishable key by invoice_id
```

**Structure Decision**: Brownfield extension; centralize credential resolution in `_shared/stripeOrgCredentials.ts` to avoid drift across seven Stripe functions.

## Implementation Phases (for /speckit.tasks)

### Phase A — Data + shared resolver (P1)

1. Migration: `organization_stripe_config` + decrypt RPCs + RLS + revoke column select
2. `_shared/stripeOrgCredentials.ts`: `getOrgStripeConfig`, `resolveStripeCredentials(orgId)`, `createStripeClient(orgId)`, `assertKeyModeMatch`
3. `stripe-org-config` Edge Function with `ADMIN_EMAILS` gate
   - `upsert_credentials` resets `test_round_trip_passed_at = NULL` (forces re-verification against new keys before live re-enable)

### Phase B — Webhook + paid-state fix (P1)

1. Parse `organization_id` query; dual webhook secret verification
2. Org-invoice ownership check on every handler
3. Path-specific paid rules; path derived from one canonical invoice signal (`stripe_checkout_session_id` vs `stripe_invoice_id`), consistent with how creation functions stamp it; neuter `payment_intent.succeeded` paid writes
4. Set `test_round_trip_passed_at` on test-mode authoritative paid event
5. Use `stripe_credential_mode` for in-flight API calls

### Phase C — Outbound Stripe API functions (P1)

Update each function to load invoice with `organization_id`, call `createStripeClient`, block if no config / live disabled for live charges:

- `stripe-create-checkout-session` — set `stripe_credential_mode`, metadata
- `stripe-create-invoice`, `send`, `fetch`, `revise`, `create-invoice-payment-link`

### Phase D — Frontend publishable key (P1)

1. `stripe-get-publishable-key` Edge Function
2. `StripePaymentForm` / callers pass `invoiceId`; dynamic `loadStripe`
3. Staff messaging when `payment_not_configured` or live disabled

### Phase E — Rollout (P2)

1. Register Churchill test + live credentials
2. Test round trip → enable live
3. Second org remains `live_payments_enabled=false` for SC-005 audit
4. Remove global env reads once verified (optional cleanup task)

## Complexity Tracking

No constitution violations requiring justification.

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Wrong webhook secret for test vs live event | Dual-secret verification (R3) |
| Cross-tenant webhook | Query org + invoice `organization_id` match |
| In-flight live disable breaks payment | `stripe_credential_mode` column |
| Partial payment + paid bug | `invoice.payment_succeeded` sync only; `invoice.paid` sets paid |
| Operator pastes test key in live fields | Prefix validation on upsert |
| Live enabled against rotated-but-unverified credentials (stale test-pass flag) | Credential upsert clears `test_round_trip_passed_at`; `enable_live` requires a post-rotation test round trip |

## Next command

`/speckit.tasks` — break phases A–E into ordered, testable tasks.
