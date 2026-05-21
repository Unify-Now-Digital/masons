# Data Model: GHL Inbox — Phase 1

## Overview

Phase 1 persists **only** organisation-to-GHL location binding metadata in Postgres. All conversation, message, and contact payloads are **logical** entities fetched live from GHL via Edge Function proxies.

## 1) `public.ghl_connections` (new table — only schema change)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Row id |
| `organization_id` | `uuid` | NOT NULL, UNIQUE, FK → `organizations(id)` ON DELETE CASCADE | One GHL binding per org |
| `ghl_location_id` | `text` | NOT NULL | GHL sub-account location id |
| `status` | `text` | NOT NULL, CHECK in (`active`, `disconnected`, `error`) | Connection health |
| `last_verified_at` | `timestamptz` | NULL | Last successful API probe |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Audit |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Audit + **webhook pulse** target |

### Indexes

- Unique on `organization_id`
- Index on `ghl_location_id` (webhook lookup)

### RLS policies

| Operation | Policy |
|-----------|--------|
| SELECT | `user_is_member_of_org(organization_id)` |
| INSERT | `user_is_admin_of_org(organization_id)` |
| UPDATE | `user_is_admin_of_org(organization_id)` |
| DELETE | `user_is_admin_of_org(organization_id)` |

### Triggers

- `updated_at` auto-touch on admin updates (standard pattern)
- Webhook handler may set `updated_at = now()` via service role (no user context)

### Realtime

- Table added to `supabase_realtime` publication for `postgres_changes` UPDATE events (frontend invalidation).

### State transitions (`status`)

```text
disconnected → active   (admin connects / verifies)
active → disconnected   (admin disconnects)
active → error          (API verification failed)
error → active          (admin re-verifies successfully)
```

## 2) GHL Conversation (logical — API read model)

Mapped from `GET /conversations/search` and `GET /conversations/:id`.

| Field (typical) | Use in Mason |
|-----------------|--------------|
| `id` | Selection key, message fetch |
| `contactId` | Load contact panel |
| `locationId` | Must match connection row |
| `unreadCount` | List badge |
| `lastMessageDate` / sort fields | List ordering (use API sort params) |
| `lastMessageBody` / preview | List subtitle (if returned) |

## 3) GHL Message (logical)

Mapped from `GET /conversations/:conversationId/messages`.

| Field (typical) | Use in Mason |
|-----------------|--------------|
| `id` / `messageId` | React key |
| `body` / `plainText` | Thread bubble |
| `direction` | inbound vs outbound styling |
| `dateAdded` | Chronological sort |
| `messageType` | Channel icon (SMS, WhatsApp, Email, etc.) |
| `status` | Delivery state display |

**No Mason table** for messages in Phase 1.

## 4) GHL Contact (logical)

Mapped from `GET /contacts/:contactId`.

| Field (typical) | Use in Mason |
|-----------------|--------------|
| `id` | Panel identity |
| `firstName`, `lastName`, `name` | Display name |
| `email`, `phone` | Contact lines |
| `tags` | Optional chips (if returned) |

## 5) React Query cache keys (frontend)

```text
ghlInboxKeys.all = ['ghl-inbox']
ghlInboxKeys.connection(orgId)
ghlInboxKeys.conversations(orgId)
ghlInboxKeys.messages(orgId, conversationId)
ghlInboxKeys.contact(orgId, contactId)
```

Invalidation on Realtime pulse: `ghlInboxKeys.conversations(orgId)` and active `messages` key; optional `contact` if `ContactUpdate` webhook received (same pulse is sufficient for Phase 1).

## Validation rules

1. At most one `ghl_connections` row per `organization_id` (DB UNIQUE).
2. `ghl-fetch` / `ghl-mark-read` MUST NOT run when `status != 'active'`.
3. Webhook pulses MUST only update rows where `ghl_location_id` matches payload `locationId`.
4. Edge functions MUST NOT return `GHL_API_KEY` or raw PIT in responses or logs.

## Migration file

- Path: `supabase/migrations/YYYYMMDDHHmmss_ghl_connections.sql`
- Must run on production ref `bfwohzcugtwbhhxdqgme` before enabling webhooks.
