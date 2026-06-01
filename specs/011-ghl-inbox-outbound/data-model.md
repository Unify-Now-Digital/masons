# Data Model: GHL Inbox — Phase 2 (Outbound Send)

**Branch**: `011-ghl-inbox-outbound` | **Date**: 2026-06-01

## Overview

Phase 2 adds **no message-body storage**. Schema changes are limited to:

1. Feature flag column on existing `ghl_connections`
2. Idempotency metadata table (send attempt tracking only)

Unified Inbox tables (`inbox_*`) are **unchanged**.

---

## `public.ghl_connections` (delta)

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `outbound_enabled` | `boolean` | `false` | When `false`, Edge Function rejects send; UI shows disabled composer |

Existing columns unchanged: `organization_id` (unique), `ghl_location_id`, `status`, `ghl_api_key` (bytea, server-only), timestamps.

### RLS impact

Existing policies on `ghl_connections` already allow org **members** to `SELECT` and **admins** to `UPDATE`. No new policies required for v1 — operators may enable outbound via Dashboard SQL; admins could toggle via future UI using existing update policy.

### Frontend type delta

```typescript
export type GhlConnectionRow = {
  // ...existing fields
  outbound_enabled: boolean;
};
```

Update `fetchGhlConnection` select list to include `outbound_enabled`.

---

## `public.ghl_send_idempotency` (new)

Durable dedupe for outbound send attempts. **Does not store message text.**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `request_id` | `uuid` | PRIMARY KEY | Client-generated per send attempt |
| `organization_id` | `uuid` | NOT NULL, FK → `organizations(id)` ON DELETE CASCADE | Tenant scope |
| `conversation_id` | `text` | NOT NULL | GHL conversation id |
| `contact_id` | `text` | NOT NULL | GHL contact id (audit) |
| `channel_type` | `text` | NOT NULL | Send `type` sent to GHL (SMS, WhatsApp, …) |
| `status` | `text` | NOT NULL, CHECK IN (`pending`, `completed`, `failed`) | Attempt lifecycle |
| `ghl_message_id` | `text` | NULL | Set on success |
| `ghl_conversation_id` | `text` | NULL | Echo from GHL response if present |
| `error_message` | `text` | NULL | Truncated GHL/user error on failure |
| `created_at` | `timestamptz` | NOT NULL DEFAULT `now()` | |
| `completed_at` | `timestamptz` | NULL | Set when terminal state reached |

### Indexes

```sql
create index ghl_send_idempotency_org_created_idx
  on public.ghl_send_idempotency (organization_id, created_at desc);
```

Optional retention: periodic delete of rows older than 30 days (manual or future cron — not v1 blocker).

### RLS

```sql
alter table public.ghl_send_idempotency enable row level security;
-- No policies for authenticated or anon → default deny
-- Edge Function uses service_role (bypasses RLS)
```

**Rationale**: Idempotency rows are write-only from Edge; no user-facing read in v1.

### State transitions

```text
                    ┌──────────┐
         INSERT ──► │ pending  │
                    └────┬─────┘
           GHL OK        │         GHL fail / validation fail
              ┌──────────┴──────────┐
              ▼                     ▼
       ┌────────────┐        ┌──────────┐
       │ completed  │        │  failed  │
       └────────────┘        └──────────┘

Duplicate request_id:
  completed → return cached success (no GHL call)
  pending (<60s) → 409 in progress
  failed → client must use NEW request_id to retry
```

---

## Edge Function access patterns

| Operation | Accessor | Method |
|-----------|----------|--------|
| Read `outbound_enabled` + connection | `ghl-send-message` | `getActiveGhlConnection` extended select |
| Insert/update idempotency | `ghl-send-message` | service role supabase client |
| Decrypt PIT | `ghl-send-message` | `getActiveGhlConnectionWithKey` (existing RPC) |

### `getActiveGhlConnection` extension

Add `outbound_enabled` to the select in `_shared/ghlClient.ts`:

```typescript
.select('id, organization_id, ghl_location_id, status, outbound_enabled')
```

Send function checks:

```typescript
if (!connection.outbound_enabled) {
  return json({ ok: false, error: 'Outbound messaging is not enabled for this organisation' }, 403);
}
```

---

## Migration file (sketch)

**File**: `supabase/migrations/YYYYMMDDHHmmss_ghl_outbound_send.sql`

```sql
-- outbound feature flag
alter table public.ghl_connections
  add column if not exists outbound_enabled boolean not null default false;

comment on column public.ghl_connections.outbound_enabled is
  'When true, org members may send outbound GHL messages via ghl-send-message Edge Function.';

-- idempotency table
create table if not exists public.ghl_send_idempotency (
  request_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id text not null,
  contact_id text not null,
  channel_type text not null,
  status text not null check (status in ('pending', 'completed', 'failed')),
  ghl_message_id text,
  ghl_conversation_id text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ghl_send_idempotency_org_created_idx
  on public.ghl_send_idempotency (organization_id, created_at desc);

alter table public.ghl_send_idempotency enable row level security;

-- Post-apply: NOTIFY pgrst, 'reload schema';
```

**Apply discipline**: Commit migration in repo → operator runs in Supabase Dashboard SQL Editor → schema cache refresh before Edge deploy.

---

## Logical entities (unchanged from Phase 1)

- **GHL Conversation / Message / Contact**: still read-through only; no Mason tables for bodies.
- **Send Attempt**: persisted only as idempotency metadata (`ghl_send_idempotency`), not as a user-visible inbox record.
