# Data model: inbox_ai_suggestions

## New table: public.inbox_ai_suggestions

| Column           | Type      | Nullable | Default              | Description                    |
|------------------|-----------|----------|----------------------|--------------------------------|
| id               | uuid      | NO       | gen_random_uuid()    | Primary key                    |
| message_id       | uuid      | NO       | —                    | FK to inbox_messages(id)       |
| suggestion_text  | text      | NO       | —                    | Cached AI suggestion            |
| created_at       | timestamptz | NO     | now()                | When the suggestion was stored |

**Constraints:**
- PRIMARY KEY (id)
- UNIQUE (message_id) — at most one suggestion per message
- FOREIGN KEY (message_id) REFERENCES public.inbox_messages(id) ON DELETE CASCADE

**Indexes:**
- Unique constraint on message_id (for cache lookup and dedup)

**RLS:**
- Enable RLS.
- Policy for SELECT: allow authenticated users (e.g. `(select auth.uid()) is not null`). Optionally restrict to rows where the user can access the message (e.g. via a join to inbox_messages → inbox_conversations if tenant scoping is needed); for single-tenant or same-access-as-inbox, "authenticated" may suffice.
- Policy for INSERT: allow authenticated users (Edge Function uses service role so insert bypasses RLS; policy is for any direct client insert if needed).
- No UPDATE/DELETE required for minimal flow (cache is append-only per message).

## Relationship

- **inbox_messages** 1 ———— (0..1) **inbox_ai_suggestions**
- One suggestion row per message; message_id is the natural key for cache lookup.

## Migration file

- Name: `supabase/migrations/YYYYMMDDHHMMSS_create_inbox_ai_suggestions.sql`
- Contents: create table, unique constraint, FK, RLS enable, policies (select + insert for authenticated).
