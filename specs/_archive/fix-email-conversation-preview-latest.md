# Fix Email Conversation Card Preview (Use Latest Message)

## Overview

**Bug:** Email conversation cards show preview text from the **first/oldest** message in the conversation instead of the **latest** message. WhatsApp conversation previews are correct.

**Goal:** Identify the exact root cause(s) in the email ingestion/sending paths that write `public.inbox_conversations.last_message_preview`, and provide an exact change list. **No implementation in this phase.**

---

## Current State Analysis

### Inbox conversations preview source (UI)

- The UI reads `inbox_conversations.last_message_preview` directly for the card preview.
  - `src/modules/inbox/components/InboxConversationList.tsx` uses:
    - `const preview = conversation.last_message_preview ?? ''`
    - and displays it (also uses it for “urgent” detection in `UnifiedInboxPage.tsx`).
- There is no UI-side derivation of preview text for the list; **server-side `last_message_preview` is the source of truth**.

### WhatsApp/SMS path (working reference)

- `supabase/functions/twilio-sms-webhook/index.ts` sets the preview from the inbound message body and updates the conversation after inserting the message:
  - `updatePayload = { last_message_at: sentAt, last_message_preview: preview, ... }`
  - It **does not write `updated_at`** (schema does not have it).
  - It checks update errors and logs failures/0-row updates.

This path reliably keeps `last_message_preview` aligned with the latest message.

### Email paths that write `last_message_preview`

#### 1) `supabase/functions/gmail-sync-now/index.ts` (per-user Gmail ingestion)

It writes `last_message_preview` in two places:

1) **On conversation creation**:
- Inserts `inbox_conversations` with:
  - `last_message_at: sentAt`
  - `last_message_preview: bodyText.slice(0, 120)`

2) **On every processed message** (after inserting the inbox_message):
- Reads the current conversation row (`last_message_at, unread_count, status`)
- Builds an `update` object that **always** includes:
  - `last_message_preview: bodyText.slice(0, 120)`
  - **`updated_at: new Date().toISOString()`** ← schema mismatch
- Only updates `last_message_at` when `sentAt` is newer than existing `last_message_at`.

**Important behavior:** The code overwrites `last_message_preview` even when the message is **older** than `last_message_at`.

#### 2) `supabase/functions/inbox-gmail-sync/index.ts` (admin Gmail ingestion)

Same pattern as `gmail-sync-now`:

1) On conversation creation: sets `last_message_preview` from the currently processed message.
2) On every processed message: overwrites `last_message_preview` unconditionally, and also writes **`updated_at`** (schema mismatch), while only conditionally updating `last_message_at`.

#### 3) Outbound email senders update preview and also write `updated_at`

- `supabase/functions/inbox-gmail-send/index.ts`
- `supabase/functions/gmail-send-first-message/index.ts`
- `supabase/functions/gmail-send-reply/index.ts`

All update `inbox_conversations` with:
- `last_message_at`
- `last_message_preview`
- **`updated_at`** ← schema mismatch

`supabase/functions/inbox-gmail-new-thread/index.ts` creates a conversation and sets `last_message_preview` but does **not** write `updated_at` (and therefore is not the cause of the staleness by itself).

---

## Findings

1) **Email ingestion paths overwrite preview even when processing older messages**
- Both `gmail-sync-now` and `inbox-gmail-sync` set `last_message_preview` on every message without tying it to “is this the newest message for the conversation?”
- They only guard `last_message_at`, not the preview field. This allows a later-processed older email to overwrite the preview while `last_message_at` remains the newest.

2) **Multiple email paths write a non-existent `updated_at` column**
- Email ingestion updates and outbound email updates include `updated_at`, but `public.inbox_conversations` has **no `updated_at`**.
- Depending on runtime behavior, this can cause the update to error (or update 0 rows), leaving `last_message_preview` stuck at whatever value it had when the conversation was first created/last successfully updated.
- WhatsApp preview works because the webhook no longer writes `updated_at`.

3) **UI is not at fault**
- The conversation list reads `last_message_preview` directly and sorts by `last_message_at DESC`.
- Therefore stale preview is caused by backend write logic, not rendering logic.

---

## Exact root cause(s)

### Root cause A (logic): preview is updated unconditionally, independent of “latest message” selection

In both:
- `supabase/functions/gmail-sync-now/index.ts`
- `supabase/functions/inbox-gmail-sync/index.ts`

the update logic:
- always sets `last_message_preview` from the current message
- but only sets `last_message_at` when the current message is newer

This allows the conversation card preview to drift to an **older** email (including potentially the first email in the thread) while the conversation ordering is still based on the latest `last_message_at`.

### Root cause B (schema mismatch): email paths write `updated_at` which does not exist on `inbox_conversations`

The following functions update `public.inbox_conversations` and include an `updated_at` field in the update payload:
- `supabase/functions/gmail-sync-now/index.ts`
- `supabase/functions/inbox-gmail-sync/index.ts`
- `supabase/functions/inbox-gmail-send/index.ts`
- `supabase/functions/gmail-send-first-message/index.ts`
- `supabase/functions/gmail-send-reply/index.ts`

Because `public.inbox_conversations` has **no `updated_at`**, these updates can fail (or be partially/fully rejected), preventing `last_message_preview` from being correctly maintained for email conversations.

---

## Exact change list (no implementation yet)

### 1) Make preview updates conditional on “is latest message”

In **both** email ingestion functions:
- `supabase/functions/gmail-sync-now/index.ts`
- `supabase/functions/inbox-gmail-sync/index.ts`

Change the conversation metadata update so that:
- `last_message_preview` is only updated when the message’s `sentAt` is **>=** the current `last_message_at` (the same condition used to update `last_message_at`).

In other words:
- if `messageSentAt > existingLastMessageAt`: set **both** `last_message_at` and `last_message_preview`
- else: do **not** change `last_message_preview` (but unread_count logic may still apply if desired; keep current behavior unless it depends on “latest”)

### 2) Remove `updated_at` from all `inbox_conversations` updates in email-related functions

Remove `updated_at` from `inbox_conversations.update({...})` payloads in:
- `supabase/functions/gmail-sync-now/index.ts`
- `supabase/functions/inbox-gmail-sync/index.ts`
- `supabase/functions/inbox-gmail-send/index.ts`
- `supabase/functions/gmail-send-first-message/index.ts`
- `supabase/functions/gmail-send-reply/index.ts`

### 3) Keep WhatsApp path unchanged

- No changes needed in `supabase/functions/twilio-sms-webhook/index.ts` for this bug; it already updates `last_message_preview` correctly based on the message being inserted.

---

## What NOT to Do

- Do not change the frontend list to derive preview from messages; the backend field should remain the source of truth.
- Do not change schema in this task (no adding `updated_at` to `inbox_conversations`).
- Do not change WhatsApp behavior.

---

## Open Questions / Considerations

- If email sync sometimes processes messages out-of-order (newest-first), Root cause A is sufficient to explain “preview shows first/oldest”. If updates were also failing due to Root cause B, removing `updated_at` is required to make the fix effective.


