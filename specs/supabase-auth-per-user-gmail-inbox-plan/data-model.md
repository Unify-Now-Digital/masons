# Data model: Auth + per-user Gmail

## New table: gmail_connections

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | NOT NULL, references auth.users(id) ON DELETE CASCADE |
| provider | text | NOT NULL, default 'google' |
| email_address | text | NULL |
| access_token | text | NULL |
| refresh_token | text | NOT NULL |
| token_expires_at | timestamptz | NULL |
| scope | text | NULL |
| status | text | NOT NULL, default 'active', check in ('active','revoked','error') |
| created_at | timestamptz | NOT NULL default now() |
| updated_at | timestamptz | NOT NULL default now() |

- **Unique constraint:** At most one active connection per user: `UNIQUE (user_id)` **where status = 'active'** (partial unique index).
- **RLS:** Enable; SELECT/INSERT/UPDATE/DELETE only where `user_id = (select auth.uid())`.

## Inbox table changes (minimal)

- **inbox_conversations:** Add `user_id` uuid NOT NULL. Add FK to auth.users(id) ON DELETE CASCADE (or omit FK if preferred; at minimum NOT NULL + RLS). Backfill: **Option A — none.** Existing rows without user_id become inaccessible once RLS is enabled; prefer truncate or drop+recreate for inbox tables if acceptable, or add user_id nullable first, then delete where user_id is null, then set NOT NULL. **Chosen approach (Option A):** Add `user_id` as NOT NULL with no default; require new data only — so existing rows must be deleted before or in the same migration (truncate inbox_messages then inbox_conversations, then add user_id NOT NULL).
- **inbox_messages:** Add `user_id` uuid NOT NULL; add `gmail_connection_id` uuid NULL references gmail_connections(id). Same backfill: no backfill; clear existing data before adding NOT NULL user_id.

## Migration sequence (to avoid downtime / FK errors)

1. **Create gmail_connections** (no FK from inbox yet).
2. **Inbox tables:**  
   - Truncate or delete existing rows from inbox_messages, then inbox_conversations (Option A: no backfill).  
   - Add `user_id` to inbox_conversations (NOT NULL, reference auth.users if desired).  
   - Add `user_id` and `gmail_connection_id` to inbox_messages (NOT NULL, nullable respectively; gmail_connection_id → gmail_connections(id)).  
   - Create indexes: e.g. inbox_conversations(user_id), inbox_messages(user_id), inbox_messages(gmail_connection_id).
3. **RLS:** Enable on gmail_connections and inbox tables; create policies SELECT/INSERT/UPDATE/DELETE by user_id = auth.uid(). For sync/send, Edge Functions use service role and set user_id (and gmail_connection_id) on insert.

## People/customers

- If inbox references `customers` (people) and those are shared across users, spec says "align ownership to user_id where applicable." For this plan, assume customers/people are **not** given user_id in this phase unless the spec explicitly requires it; inbox ownership is via inbox_conversations and inbox_messages only.

## Summary

- **gmail_connections:** New table; one active per user (partial unique index).  
- **inbox_conversations:** user_id NOT NULL; clear existing data then add column.  
- **inbox_messages:** user_id NOT NULL, gmail_connection_id NULL; clear existing data then add columns.  
- **No backfill:** After migrations, inbox is empty until user connects Gmail and sync runs.
