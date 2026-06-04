# Data Model: Per-Organization Stripe (012-per-org-stripe)

## `public.organization_stripe_config` (new)

One row per organisation. Service-role and platform-admin writes only; members never read ciphertext.

| Column | Type | Notes |
|--------|------|-------|
| `organization_id` | `uuid` PK → `organizations(id)` | Tenant key |
| `live_payments_enabled` | `boolean NOT NULL DEFAULT false` | When true, API uses **live** credential triplet |
| `test_round_trip_passed_at` | `timestamptz` NULL | Set by `stripe-webhook` on successful test-mode authoritative paid event. **Reset to NULL on any credential upsert/rotation** for that org. |
| `test_secret_key_encrypted` | `bytea` NULL | `pgp_sym_encrypt(sk_test_…)` |
| `test_publishable_key` | `text` NULL | `pk_test_…` — safe for client via Edge |
| `test_webhook_secret_encrypted` | `bytea` NULL | `whsec_…` for test Stripe account |
| `live_secret_key_encrypted` | `bytea` NULL | `pgp_sym_encrypt(sk_live_…)` |
| `live_publishable_key` | `text` NULL | `pk_live_…` |
| `live_webhook_secret_encrypted` | `bytea` NULL | `whsec_…` for live Stripe account |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**RLS**: enabled; no policies for `authenticated` on secret columns; optional `SELECT` of `live_payments_enabled`, `test_round_trip_passed_at` for org admins (read-only status); **no** `INSERT`/`UPDATE` for authenticated (platform admin via Edge service role only).

## RPCs (new)

### `public.get_stripe_secret_key(p_organization_id uuid, p_mode text, p_encryption_key text) → text`

- `p_mode` ∈ `'test' | 'live'`
- Decrypts appropriate `*_secret_key_encrypted` column
- `SECURITY DEFINER`, `search_path = ''`
- `GRANT EXECUTE` to `service_role` only

### `public.get_stripe_webhook_secret(p_organization_id uuid, p_mode text, p_encryption_key text) → text`

- Same pattern for webhook signing secrets

### `public.upsert_organization_stripe_config(...)` (optional)

- May use direct service-role `.upsert()` from Edge instead of RPC if simpler; secrets encrypted in Edge before write using `pgp_sym_encrypt` via RPC or SQL function.

## `public.invoices` (delta — additive columns)

| Column | Type | Notes |
|--------|------|-------|
| `stripe_credential_mode` | `text` NULL CHECK (`stripe_credential_mode` IN ('test', 'live')) | Set at checkout session creation; used by webhook for in-flight FR-009b |

Existing: `organization_id`, `stripe_checkout_session_id`, `stripe_invoice_id`, `stripe_status`, `stripe_invoice_status`, payment columns — unchanged semantics.

## Logical types (Edge `_shared/stripeOrgCredentials.ts`)

```typescript
export type StripeCredentialMode = 'test' | 'live';

export type OrgStripeCredentials = {
  organizationId: string;
  mode: StripeCredentialMode;
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  livePaymentsEnabled: boolean;
  testRoundTripPassedAt: string | null;
};
```

## State transitions

```text
[no row] → operator registers test credentials → test round trip → test_round_trip_passed_at set
         → operator registers live credentials → enable live_payments_enabled (blocked until test pass)
         → live payments use live triplet; disable flag → new ops use test triplet; in-flight uses stripe_credential_mode
```

## Environment secrets

| Secret | Role |
|--------|------|
| `STRIPE_CREDENTIALS_ENCRYPTION_KEY` | Passed to decrypt RPCs (mirror `GHL_API_KEY_ENCRYPTION_KEY`) |
| `ADMIN_EMAILS` | Platform operator gate for `stripe-org-config` |
| `INBOX_ADMIN_TOKEN` | Existing staff Stripe invoice/checkout Edge calls |
| `STRIPE_*` (global) | Deprecated after per-org migration |

## Unchanged tables

- `invoice_payments` — continue idempotent inserts from authoritative handlers only
- `payment_reconciliation` — no schema change; source remains `'stripe'`
