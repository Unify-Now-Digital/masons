# Implementation plan: AI thread summary (Inbox middle pane)

**Source of truth:** `specs/inbox-ai-conversation-summary.md`  
**Scope:** Persisted AI summary strip below `ConversationHeader`, above thread scroll, for **Conversations** and **Customers** modes — no broad inbox refactors.

---

## 1. Migration plan

### 1.1 Table: `public.inbox_ai_thread_summaries`

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `id` | `uuid` | NO | `primary key default gen_random_uuid()` |
| `scope` | `text` | NO | Check: `scope in ('conversation', 'customer_timeline')` |
| `conversation_id` | `uuid` | YES | FK → `public.inbox_conversations(id)` **ON DELETE CASCADE** |
| `person_id` | `uuid` | YES | FK → `public.customers(id)` **ON DELETE CASCADE** |
| `summary_text` | `text` | NO | One paragraph (server-enforced length in Edge optional) |
| `messages_fingerprint` | `text` | NO | Opaque fingerprint string (e.g. SHA-256 hex) |
| `updated_at` | `timestamptz` | NO | `default now()`; set to `now()` on every successful regenerate |

### 1.2 XOR + scope integrity (single `CHECK`)

```text
(scope = 'conversation' AND conversation_id IS NOT NULL AND person_id IS NULL)
OR
(scope = 'customer_timeline' AND person_id IS NOT NULL AND conversation_id IS NULL)
```

### 1.3 Uniqueness (partial unique indexes)

- **Conversation cache:** `create unique index ... on public.inbox_ai_thread_summaries (conversation_id) where scope = 'conversation';`
- **Customer timeline cache:** `create unique index ... on public.inbox_ai_thread_summaries (person_id) where scope = 'customer_timeline';`

### 1.4 Supporting indexes (optional but useful)

- None strictly required beyond uniques; Edge lookups are by `conversation_id` or `person_id` under partial index.

### 1.5 RLS

- **`alter table ... enable row level security`.**
- **No** `INSERT` / `UPDATE` / `DELETE` policies for `authenticated` — same model as `inbox_ai_suggestions`: **only service role (Edge Function)** writes.
- **`SELECT` for `authenticated`:** mirror ownership without trusting the client.

**Conversation rows** — user can read if the conversation row is theirs:

```sql
exists (
  select 1 from public.inbox_conversations c
  where c.id = inbox_ai_thread_summaries.conversation_id
    and c.user_id = (select auth.uid())
)
```

**Customer timeline rows** — tie to inbox access for that person (matches unified timeline scope: open conversations for `person_id` under current user):

```sql
exists (
  select 1 from public.inbox_conversations c
  where c.person_id = inbox_ai_thread_summaries.person_id
    and c.user_id = (select auth.uid())
    and c.status = 'open'
)
```

*Rationale:* Avoids depending on a separate `customers` RLS policy in migrations that may not exist; aligns with “this user sees this customer thread in Inbox.”

### 1.6 Triggers / helper SQL

- **No trigger required** for v1.
- **Optional:** `comment on table` / `comment on column` for documentation.
- **Persistence upsert in Edge:** Because partial unique indexes are awkward with `supabase-js` `.upsert({ onConflict: '...' })`, plan for **one of:**
  - **A)** Raw SQL via `supabase.rpc('upsert_inbox_ai_thread_summary', …)` implemented as `SECURITY DEFINER`, `search_path = ''`, fully qualified names (per project DB function rules), **granted to service role only**; *or*
  - **B)** Edge logic: `select id, messages_fingerprint …` then `update` by `id` or `insert` if missing (two round-trips, clear and sufficient for v1).

Recommend **B** first to avoid extra migration object unless you prefer a single atomic statement.

### 1.7 Migration file

- `supabase/migrations/YYYYMMDDHHMMSS_create_inbox_ai_thread_summaries.sql`
- Follow `.cursor/rules/create-migration.mdc` / `create-rls-policies.mdc`: lowercase keywords, `(select auth.uid())` in policies.

---

## 2. Edge Function plan (`inbox-ai-thread-summary`)

**Path:** `supabase/functions/inbox-ai-thread-summary/index.ts`

### 2.1 Request shape (JSON body, exactly one scope)

- `{ "scope": "conversation", "conversation_id": "<uuid>" }`
- `{ "scope": "customer_timeline", "person_id": "<uuid>" }`

Reject missing/invalid UUIDs or wrong combination with **400**.

### 2.2 Response shape

- **Success (200):** `{ "summary": string | null }`
  - `summary` is **non-null string** when messages exist and generation/cache succeeded.
  - **`summary: null`** when **zero messages** in scope (no OpenAI; do not surface error in UI).
- **Unauthorized:** `401` `{ "error": string }`
- **Forbidden:** `403` if resource not owned by JWT user (see 2.4).
- **AI not configured:** `500` `{ "error": "AI not configured" }` (or mirror `inbox-ai-suggest-reply` wording) when `OPENAI_API_KEY` missing and generation would be required.
- **Other failures:** `500` `{ "error": string }` — client shows quiet error in banner.

### 2.3 Auth flow

Copy **`inbox-ai-suggest-reply`**:

1. `OPTIONS` → CORS headers (include `x-internal-key` in Allow-Headers).
2. `POST` only.
3. Authorize if **Bearer JWT** validates via `createClient(supabaseUrl, anonKey, { global: { headers: { Authorization }}})` + `auth.getUser(token)` **OR** `x-internal-key === INTERNAL_FUNCTION_KEY`.
4. After auth, capture **`authUserId`** (`user.id`) for all data access filters when using service role.

### 2.4 Authorization / data ownership (service role + explicit filter)

Service role bypasses RLS; **must** filter like the app:

**Conversation scope**

1. `select * from inbox_conversations where id = conversation_id and user_id = authUserId` → if no row, **403**.

**Customer timeline scope**

1. Resolve conversation ids:  
   `select id from inbox_conversations where person_id = person_id_param and user_id = authUserId and status = 'open'`  
   (matches `usePersonUnifiedTimeline` + `fetchConversations({ status: 'open', person_id })` in `useInboxMessages.ts` / `inboxConversations.api.ts`).
2. If **no** conversations: treat as **zero messages** → `200 { summary: null }` (no 403 — user may still “see” person in UI edge cases; empty timeline is valid).

### 2.5 Loading messages

**Conversation scope**

- Query `inbox_messages` where `conversation_id = :id` **and** `user_id = authUserId` (defense in depth).
- Order for fingerprint and prompt: **`sent_at asc nulls last`, `id asc`** (tie-break; aligns with stable ordering).

**Customer timeline scope**

- Query `inbox_messages` where `conversation_id in (:openConversationIds)` **and** `user_id = authUserId`.
- Same **global sort** as client unified timeline: sort by `sent_at` / `created_at` / `id` **in the Edge** after fetch (mirror `usePersonUnifiedTimeline` sorted merge in `useInboxMessages.ts` lines 48–62) so fingerprint and UI “all messages” stay consistent.

**Columns to select:** at minimum `id`, `updated_at`, `sent_at`, `created_at`, `channel`, `direction`, `body_text`, `subject`, `from_handle`, `to_handle` (trim to what the prompt needs).

### 2.6 Fingerprint generation

- After messages are ordered, build a single string by concatenating each row’s stable identity, e.g.  
  `for each m in order: `${m.id}:${m.updated_at}``  
  (optionally append `:${m.sent_at}` if `updated_at` can lag; spec allows — pick one rule and document in code comment).
- **`messages_fingerprint = sha256(utf8Bytes(concatenated)).hex`** (Deno: `crypto.subtle.digest` + hex encode).

**Important:** Fingerprint must cover **all** messages in scope (not only the truncated prompt subset) so edits outside the prompt window still invalidate cache.

### 2.7 When OpenAI is skipped vs called

1. **Zero messages** → return `{ summary: null }`; **optional:** delete existing cache row for that scope key to avoid stale rows (nice-to-have).
2. **Non-zero messages:** load existing row from `inbox_ai_thread_summaries` for this `conversation_id` or `person_id` (and matching `scope`).
3. If row exists **and** `row.messages_fingerprint === computedFingerprint` → return `{ summary: row.summary_text }` (**no OpenAI**).
4. Else if regeneration needed **and** `OPENAI_API_KEY` missing → **500** (cannot produce new summary).
5. Else → build prompt, call OpenAI, then persist.

### 2.8 Prompt / OpenAI

- Reuse **`stripHtml`** pattern from `inbox-ai-suggest-reply` for email bodies.
- System: memorial masonry business, **one short paragraph**, neutral/professional; output **JSON** with single key `"summary"`.
- Model: e.g. `gpt-4o-mini`, `response_format: { type: 'json_object' }`.
- **Truncation:** if thread is huge, **truncate only the text sent to the model** (e.g. max messages and/or max chars from the **end** or **start** — document constant). **Do not** truncate the list used for fingerprinting.

### 2.9 Upsert / persistence

- After successful generation: **update** existing row for that scope key if present; else **insert**.
- Set `summary_text`, `messages_fingerprint`, `updated_at = now()`.
- Handle concurrent requests: last writer wins acceptable for v1.

### 2.10 Fallback / error behavior

- JSON parse failures from model → 500 or retry once (optional); client shows quiet error.
- DB errors on write → 500, log server-side, no body content in client logs.

### 2.11 Shared code (optional)

- If duplication is large, add `supabase/functions/_shared/inboxAiText.ts` with `stripHtml` and import from both functions (keep change small).

---

## 3. Frontend plan

### 3.1 New files

| File | Purpose |
|------|---------|
| `src/modules/inbox/hooks/useThreadSummary.ts` | React Query wrapper around `functions.invoke('inbox-ai-thread-summary')`. |
| `src/modules/inbox/components/ConversationSummaryBanner.tsx` | Presentational strip: loading / error / paragraph / null. |

### 3.2 Modified files

| File | Purpose |
|------|---------|
| `src/modules/inbox/components/ConversationView.tsx` | Render banner **after** `<ConversationHeader />`, **before** `<ConversationThread />` wrapper (same parent `flex` column as today). |
| `src/modules/inbox/components/CustomerConversationView.tsx` | Same placement. |
| `src/modules/inbox/pages/UnifiedInboxPage.tsx` | After `invalidateQueries({ queryKey: inboxKeys.all })`, also invalidate thread summary queries. |
| `src/modules/inbox/hooks/useInboxConversations.ts` | Every mutation `onSuccess` that already invalidates `inboxKeys.all` (or messages) → add summary invalidation **once per path** (avoid double work: prefer single helper or shared invalidation function). |
| `src/modules/inbox/hooks/useInboxMessages.ts` | If any send path invalidates without going through `inboxKeys.all`, add summary invalidation there too. |
| `src/modules/inbox/hooks/useGmailConnection.ts` | Where it invalidates inbox conversations/messages — add summary invalidation. |
| `src/modules/inbox/hooks/useWhatsAppConnection.ts` | Same. |
| `src/shared/types/database.types.ts` | Add table types if this project hand-maintains them (optional). |

### 3.3 `ConversationSummaryBanner` placement (exact structure)

**`ConversationView.tsx`** (today: shrink-0 header → flex-1 thread container):

```text
<div flex col>
  <div shrink-0> ConversationHeader </div>
  <div shrink-0> ConversationSummaryBanner </div>   <!-- NEW -->
  <div flex-1 min-h-0> ConversationThread </div>
</div>
```

**`CustomerConversationView.tsx`:** identical pattern inside the outer `flex-1 min-h-0 flex flex-col` (place **before** `ConversationThread`; keep loading line at bottom as-is unless it visually conflicts — optional polish later).

**Do not** change `ConversationHeader.tsx`.

### 3.4 `useThreadSummary` behavior

- **Input:** discriminated union:
  - `{ scope: 'conversation'; conversationId: string | null }`
  - `{ scope: 'customer_timeline'; personId: string | null }`
- **`useQuery`:**
  - **`queryKey`:** `['inbox', 'ai-thread-summary', scope, conversationId ?? personId]`  
    (third segment is always the id string for the active scope.)
  - **`enabled`:** `!!conversationId` or `!!personId` depending on scope.
  - **`queryFn`:** `supabase.functions.invoke` with body; pass **`x-internal-key`** when `VITE_INTERNAL_FUNCTION_KEY` set — copy from `useSuggestedReply.ts`.
  - **`staleTime`:** moderate (e.g. 1–5 min) **optional**; invalidation is the primary refresh driver. Fingerprint on server prevents duplicate OpenAI even if client refetches often.
  - **JWT errors:** mirror suggest-reply behavior if desired (sign-out on invalid JWT) — optional consistency.

**Returns:** `{ summary: string | null; isLoading: boolean; error: Error | null }`  
Map `data?.error` from JSON to thrown Error in `queryFn`.

### 3.5 `ConversationSummaryBanner` UI

- **`isLoading`:** single muted line, e.g. `text-[11px] text-slate-500` — “Summarising conversation…”
- **`error`:** single line “Couldn’t load summary” — **no** retry button.
- **`summary` null/empty and not loading/error:** render **`null`** (no strip / no reserved height).
- **`summary` present:** `text-sm text-slate-600`, `px-4 py-2`, subtle `border-b border-slate-100` or `bg-slate-50/50` to separate from scroll area — **must not** steal flex space from `ConversationThread` beyond content height (`shrink-0` wrapper).

### 3.6 Layout preservation

- `ConversationThread` props and internal scroll `ref` unchanged.
- AI reply **chip** stays in composer area in `ConversationThread.tsx` — **no** changes required there for v1.

---

## 4. Invalidation / regeneration plan

### 4.1 Canonical query prefix

Use a **shared constant** to avoid typos, e.g. in `useThreadSummary.ts`:

```ts
export const INBOX_THREAD_SUMMARY_QUERY_KEY = ['inbox', 'ai-thread-summary'] as const;
```

Invalidate with:

```ts
queryClient.invalidateQueries({ queryKey: INBOX_THREAD_SUMMARY_QUERY_KEY });
```

(Prefix match invalidates all `['inbox','ai-thread-summary', …]` queries.)

### 4.2 Places that **must** call this invalidation

Add **alongside** existing inbox invalidation (same `onSuccess` / handler block where possible):

| Location | Trigger |
|----------|---------|
| `UnifiedInboxPage.tsx` | Realtime / polling / unified refresh that calls `invalidateQueries({ queryKey: inboxKeys.all })` |
| `useInboxConversations.ts` | Every mutation already invalidating `inboxKeys.all` (mark read/unread, archive, delete, link, unlink, create, etc.) |
| `useInboxMessages.ts` | `useSendReply` `onSuccess` paths that invalidate `inboxKeys.all` / messages |
| `useGmailConnection.ts` | After connect/disconnect/sync invalidating inbox lists/messages |
| `useWhatsAppConnection.ts` | Same |

**Scan:** `rg "inboxKeys\\.all|invalidateQueries.*inbox" src/modules/inbox` during implement — any path that refreshes messages or conversations should also refresh summaries.

### 4.3 Inbound refresh paths

Covered by **UnifiedInboxPage** realtime invalidation + any webhook/sync hooks that invalidate inbox queries.

### 4.4 Outbound send paths

Covered by **`useSendReply`** (and any other send mutations in `useInboxMessages` or related APIs) + global invalidation.

### 4.5 Selection behavior

- Switching **conversation** or **customer** changes React Query **`queryKey`** id segment → **new** query runs automatically; no extra invalidation needed for selection alone.
- Stale data for **previous** thread is harmless (cached); optional `staleTime: 0` only if you want always refetch on revisit — **not** required because fingerprint prevents duplicate OpenAI.

### 4.6 Avoiding duplicate / excessive OpenAI calls

- **Server:** fingerprint short-circuit is the main guard.
- **Client:** avoid calling `invalidateQueries` in tight loops; use **one** invalidation per logical event (same as inbox).
- **React Query `refetchOnWindowFocus`:** default may refetch summaries — acceptable; server cache still cheap. Optionally `refetchOnWindowFocus: false` for this query if desired.

---

## 5. Data scope plan

### 5.1 Conversation summary key

- **Cache identity:** `(scope = 'conversation', conversation_id = <selected conversation id>)`
- **Message set:** all `inbox_messages` rows for that `conversation_id` with **`user_id = auth user`** (matches RLS).

### 5.2 Customer timeline summary key

- **Cache identity:** `(scope = 'customer_timeline', person_id = <selected person id>)`
- **Message set:** all messages belonging to **open** inbox conversations for that `person_id` and **same user**, merged and sorted **as in** `usePersonUnifiedTimeline` (`useInboxMessages.ts`).

### 5.3 Assumptions that must remain true

- `inbox_conversations.user_id` and `inbox_messages.user_id` reflect the owning workspace user (legacy `NULL` rows remain invisible to RLS — Edge must not return them for authenticated users).
- Customers mode list only shows threads built from **open** conversations for that person; summary must use the **same** filter so text matches what the user sees.
- `updated_at` on `inbox_messages` changes when message content or metadata relevant to thread changes; if the app ever updates messages without bumping `updated_at`, fingerprint could be stale — **assumption:** DB defaults/triggers keep `updated_at` honest (or use `id`+`sent_at` only if needed — document if changed).

---

## 6. Rollout order (minimize breakage)

1. **Migration** — deploy table + RLS; verify in SQL editor (no app dependency yet).
2. **Edge Function** — deploy `inbox-ai-thread-summary`; test with curl/Supabase dashboard (JWT + scope) before UI ships.
3. **`useThreadSummary` + constant export** — unit-testable `queryKey` / `enabled` in isolation.
4. **`ConversationSummaryBanner`** — story-less OK; quick visual check in dev.
5. **Wire `ConversationView` + `CustomerConversationView`** — behind no flag if migration + function already deployed.
6. **Invalidation** — add to all inbox invalidation sites; verify one send triggers refetch and summary updates after OpenAI round-trip.
7. **Types** — `database.types` if required by project conventions.

**Feature flag:** optional; not required if DB + function deploy atomically with frontend.

---

## 7. Risks / guardrails

| Risk | Mitigation |
|------|------------|
| **Large threads** | Prompt truncation only; fingerprint on full set; monitor token usage; optional max message cap constant. |
| **Duplicate generation** | Fingerprint equality short-circuit; unique partial indexes; tolerate rare race (last write wins). |
| **Stale summary** | Any message change should bump fingerprint or change message set; ensure invalidation runs on all send/sync paths (grep audit). |
| **RLS / auth** | Edge always filters by `authUserId` from JWT; never trust body user id; RLS on summary table for direct Select from client if ever exposed via PostgREST (optional future). |
| **Cross-tenant leak** | Missing `user_id` filter on service role queries is critical — code review checklist item. |
| **Customer without open conversations** | Empty message list → `summary: null`, banner hidden. |
| **Cost spikes** | Invalidation storms (e.g. rapid polling) — align with existing inbox polling frequency; fingerprint prevents OpenAI if nothing changed. |

---

## 8. File-by-file checklist

### New

- `supabase/migrations/YYYYMMDDHHMMSS_create_inbox_ai_thread_summaries.sql` — table, checks, partial uniques, RLS SELECT, comments.
- `supabase/functions/inbox-ai-thread-summary/index.ts` — full handler.
- `supabase/functions/_shared/...` (optional) — shared `stripHtml`.
- `src/modules/inbox/hooks/useThreadSummary.ts` — hook + exported query key constant.
- `src/modules/inbox/components/ConversationSummaryBanner.tsx` — UI.

### Modified

- `src/modules/inbox/components/ConversationView.tsx` — banner + hook calls.
- `src/modules/inbox/components/CustomerConversationView.tsx` — banner + hook calls.
- `src/modules/inbox/pages/UnifiedInboxPage.tsx` — invalidation.
- `src/modules/inbox/hooks/useInboxConversations.ts` — invalidation on mutations.
- `src/modules/inbox/hooks/useInboxMessages.ts` — invalidation if any path misses global invalidation.
- `src/modules/inbox/hooks/useGmailConnection.ts` — invalidation.
- `src/modules/inbox/hooks/useWhatsAppConnection.ts` — invalidation.
- `src/shared/types/database.types.ts` — optional type rows for new table.

### Unchanged (explicit)

- `src/modules/inbox/components/ConversationHeader.tsx`
- `src/modules/inbox/components/ConversationThread.tsx` (AI reply chip / composer)
- `supabase/functions/inbox-ai-suggest-reply/index.ts` (reference only)

---

## Next step

`/implement` using this plan + `specs/inbox-ai-conversation-summary.md`, in the rollout order above.
