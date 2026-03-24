# Data Model — Managed WhatsApp Onboarding Redesign

## 1) Existing tables kept as-is

- `public.whatsapp_connections` (manual Twilio credentials flow) remains active and backward-compatible.
- `public.inbox_conversations` and `public.inbox_messages` remain the canonical inbox storage.

## 2) New table: `public.whatsapp_managed_connections`

Purpose: canonical lifecycle state for managed onboarding and provider-readiness.

Suggested fields:
- `id uuid primary key default gen_random_uuid()`
- `company_id uuid not null` (or equivalent tenant key used in this app)
- `created_by uuid not null references auth.users(id)`
- `updated_by uuid references auth.users(id)`
- `provider text not null default 'twilio'`
- `status text not null` check in:
  - `draft`
  - `collecting_business_info`
  - `provisioning`
  - `pending_meta_action`
  - `pending_provider_review`
  - `action_required`
  - `connected`
  - `degraded`
  - `failed`
  - `disconnected`
- `status_reason_code text`
- `status_reason_message text`
- `twilio_account_sid text`
- `twilio_subaccount_sid text`
- `twilio_whatsapp_sender_sid text`
- `whatsapp_from_address text`
- `display_phone_number text`
- `meta_business_id text`
- `meta_waba_id text`
- `last_provider_sync_at timestamptz`
- `connected_at timestamptz`
- `disconnected_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes/constraints:
- One active managed connection per tenant (partial unique index where status not in terminal-disconnected states).
- Lookup index: `(company_id, status, updated_at desc)`.
- Sender lookup index: `(twilio_account_sid, twilio_whatsapp_sender_sid)` and `(twilio_account_sid, whatsapp_from_address)`.

RLS:
- Tenant-scoped read/write for authenticated users within their company/workspace.
- Service role allowed for webhook/sync functions.

## 3) New table: `public.whatsapp_connection_events`

Purpose: append-only audit log for status changes, provider sync, send rejections.

Fields:
- `id uuid primary key default gen_random_uuid()`
- `connection_id uuid not null references public.whatsapp_managed_connections(id) on delete cascade`
- `company_id uuid not null`
- `actor_type text not null` (`system`, `user`, `provider_webhook`, `support`)
- `event_type text not null`
- `previous_status text`
- `new_status text`
- `payload jsonb not null default '{}'::jsonb`
- `request_id text`
- `correlation_id text`
- `occurred_at timestamptz not null default now()`

Indexes:
- `(connection_id, occurred_at desc)`, `(company_id, occurred_at desc)`.

RLS:
- Tenant-scoped select for authenticated; inserts by service-role and authenticated function paths only.

## 4) Existing inbox table additive fields

### `public.inbox_messages`
- Add nullable `whatsapp_connection_mode text` check in (`manual`, `managed`).
- Keep and reuse existing nullable `whatsapp_connection_id` for manual connection id.
- Add nullable `whatsapp_managed_connection_id uuid references public.whatsapp_managed_connections(id) on delete set null`.
- Add nullable `whatsapp_sender_sid text`.

### `public.inbox_conversations`
- Add nullable `whatsapp_connection_mode text` check in (`manual`, `managed`).
- Add nullable `whatsapp_managed_connection_id uuid`.

## 5) Runtime selector storage

Add tenant preference field (existing tenant/profile table):
- `preferred_whatsapp_mode text not null default 'manual' check in ('manual', 'managed')`

Rationale:
- Enforces explicit runtime choice.
- Prevents silent fallback between manual and managed.

## 6) Backfill strategy

- No destructive backfills.
- Existing records remain valid with null managed fields.
- Optional population of mode/source on new writes only; historical rows remain unchanged.

## 7) Connected invariant (managed)

A managed row is considered `connected` only if all are persisted:
- `status = 'connected'`
- `twilio_whatsapp_sender_sid` is non-null
- `whatsapp_from_address` is non-null and normalized
- latest provider sync indicates active/ready sender state
- no blocking reason code

This invariant is enforced in backend resolver, not frontend.
