# Fix inbox_conversations Schema Alignment in Twilio Webhook

## Overview

The Twilio webhook writes to `public.inbox_conversations` via update and insert. The **actual schema** has no `updated_at` column, and requires NOT NULL for `link_state` and `link_meta`. This spec inspects the exact payloads in `twilio-sms-webhook/index.ts`, confirms mismatches, and lists the exact code changes. **No implementation in this phase.**

**Context:**
- File: `supabase/functions/twilio-sms-webhook/index.ts`
- Schema facts (from user): no `updated_at`; required NOT NULL columns include `channel`, `primary_handle`, `status`, `unread_count`, `link_state`, `link_meta`; `user_id` nullable

**Goal:**
- Inspect update and insert payloads
- Confirm use of non-existent columns and missing required columns
- Report root cause(s) and exact change list

---

## 1. Existing conversation update payload

There are **two** update paths that touch `inbox_conversations`:

### 1a. Optional user_id backfill (lines 166–170)

When `existingConv` exists but `!existingConv.user_id`:

```ts
await supabase
  .from('inbox_conversations')
  .update({ user_id: ownerUserId, updated_at: new Date().toISOString() })
  .eq('id', conversationId);
```

- **Writes:** `user_id`, **`updated_at`**
- **Issue:** Schema has **no `updated_at`** column. Writing it can cause the update to fail (e.g. Postgres "column does not exist") or be ignored depending on client/driver behavior.

### 1b. Post–message-insert metadata update (lines 230–244)

After inserting the new message:

```ts
const updatePayload: Record<string, unknown> = {
  last_message_at: sentAt,
  last_message_preview: preview,
  updated_at: sentAt,
};
if (existingConv) {
  updatePayload.unread_count = (existingConv.unread_count ?? 0) + 1;
}
// ...
await supabase.from('inbox_conversations').update(updatePayload).eq('id', conversationId)...
```

- **Writes:** `last_message_at`, `last_message_preview`, **`updated_at`**, and optionally `unread_count`
- **Issue:** Again **`updated_at`** is not in the schema. This can cause the update to fail or affect 0 rows, so the conversation does not move to the top (list is ordered by `last_message_at`).

**Finding:** Both existing-conversation updates include **`updated_at`**, which does **not** exist on `public.inbox_conversations`. That is a concrete bug and a likely root cause of failed or ineffective updates.

---

## 2. New conversation insert payload

New inbound WhatsApp conversation insert (lines 174–191):

```ts
.insert({
  channel,
  primary_handle: primaryHandle,
  external_thread_id: externalThreadId,
  subject: null,
  status: 'open',
  unread_count: 1,
  last_message_at: sentAt,
  last_message_preview: preview,
  updated_at: sentAt,
  user_id: ownerUserId,
})
```

**Supplied columns:**  
`channel`, `primary_handle`, `external_thread_id`, `subject`, `status`, `unread_count`, `last_message_at`, `last_message_preview`, `updated_at`, `user_id`

**Required NOT NULL (per user):**  
`channel`, `primary_handle`, `status`, `unread_count`, `link_state`, `link_meta`

**Findings:**

1. **`updated_at`** — Column is not in the schema. Including it can cause insert failure (e.g. "column does not exist").
2. **`link_state`** — Required NOT NULL; **not** in the insert. If the table has no default for `link_state`, the insert will fail. Migration `20260124130000` adds `link_state` with `default 'unlinked'`, so DB may accept the insert; if that default was later dropped or the table was recreated without it, the insert would fail.
3. **`link_meta`** — Required NOT NULL; **not** in the insert. Same as above: migration adds `default '{}'::jsonb`; if no default in current schema, insert fails.

**Conclusion:** The insert **omits required columns `link_state` and `link_meta`** and **includes non-existent `updated_at`**. Depending on current schema (defaults vs NOT NULL without defaults), this can cause new-conversation insert to fail. At minimum, the payload is schema-inconsistent.

---

## 3. Root causes

| # | Root cause | Effect |
|---|------------|--------|
| 1 | **Update writes `updated_at`** (in both the optional user_id update and the post-message metadata update) but **`inbox_conversations` has no `updated_at` column**. | Update can fail or affect 0 rows; conversation does not refresh (e.g. does not move to top). |
| 2 | **Insert writes `updated_at`** which does not exist. | Insert can fail with "column does not exist" (or similar). |
| 3 | **Insert does not set `link_state` or `link_meta`**. If the table has NOT NULL and no default for these, insert fails. | New conversation insert can fail; customer-first messages create no row. |

---

## 4. Exact change list (no implementation yet)

1. **Remove `updated_at` from both existing-conversation updates**
   - **1a.** Optional user_id backfill (lines 166–170): remove `updated_at` from the update object; keep only `user_id` (and any other valid columns if needed).
   - **1b.** Post–message-insert update (lines 231–234): remove `updated_at` from `updatePayload`; keep `last_message_at`, `last_message_preview`, and conditional `unread_count`.

2. **Fix new-conversation insert**
   - Remove **`updated_at`** from the insert object.
   - Add **`link_state: 'unlinked'`** (or the appropriate initial value per product rules).
   - Add **`link_meta: {}`** (or `'{}'::jsonb` equivalent in the client; e.g. `{}` as JSONB).

3. **No schema migration required** for this fix if the goal is only to align the webhook with the existing table (no `updated_at`; provide link_state and link_meta). If the table actually has defaults for `link_state` and `link_meta`, adding them explicitly in the insert is still correct and future-proof.

4. **Do not change:** connection lookup, message insert, auto-link, or any other logic; only adjust which columns are sent in the two updates and the one insert.

---

## What NOT to Do

- Do not add an `updated_at` column to the schema unless that is a separate, approved change.
- Do not change frontend or other callers in this task; scope is the Twilio webhook payloads only.
