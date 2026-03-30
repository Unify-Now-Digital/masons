# Inbox Georgian: Preview vs Full-Body Path Investigation

## Overview

**Observed behavior:** Georgian text displays correctly on the Inbox conversation card (e.g. subject/preview), but the same or another message in the full conversation window shows corrupted/mojibake body text. So the **preview path** and the **full-body path** do not behave the same.

**Goal:** Pin down the exact data and rendering path difference between the card and the full conversation body so we can fix the corruption and recommend a minimal fix.

---

## 1. Conversation card data source

**Component:** `src/modules/inbox/components/InboxConversationList.tsx` (lines 290–292, 341–346).

**Fields used on the card:**

| Display | Source | DB / origin |
|--------|--------|-------------|
| **Subject / first line** | `previewFirst = conversation.subject \|\| conversation.last_message_preview \|\| 'No preview'` | **inbox_conversations.subject** or **inbox_conversations.last_message_preview** |
| **Second line (preview)** | `previewSecond = conversation.subject && conversation.last_message_preview ? conversation.last_message_preview : null` | **inbox_conversations.last_message_preview** (only when both subject and preview exist) |

So the card uses **only**:

- **inbox_conversations.subject**
- **inbox_conversations.last_message_preview**

**Where these are set (Gmail sync):**  
`supabase/functions/gmail-sync-now/index.ts`:

- **subject** — Set when the conversation is **created** (insert): `subject = getHeader('Subject')` from the **current** message (the one that creates the conversation). It is **not** updated when later messages in the thread are synced. So `inbox_conversations.subject` is the **first message’s** Gmail Subject header.
- **last_message_preview** — Set on **insert** as `bodyText.slice(0, 120)` of the current message. On **update** (existing conversation), it is updated only when the current message is the **newest** in the thread (`msgAt >= lastAt`), again as `bodyText.slice(0, 120)` (lines 359–362). So **inbox_conversations.last_message_preview** always comes from the **latest** message in the thread (by `last_message_at`) that we have synced.

So the card can show:

- Correct **subject** (first message’s Subject header; headers are often ASCII or correctly encoded).
- Correct **preview** (latest message’s body excerpt) while an **older** message in the same thread still has corrupted body in the full view.

---

## 2. Full conversation window data source

**Components:**  
`ConversationView` loads the conversation and messages, then `ConversationThread` renders each message.

**Data flow:**

- **Conversation:** `useConversation(conversationId)` → **inbox_conversations** (subject, etc.).
- **Messages:** `useMessagesByConversation(conversationId)` → **inbox_messages** for that conversation.
- **Per-message body:** In `ConversationThread` (lines 286, 292, 322–323, etc.): `body = message.body_text ?? ''`. That value is used for:
  - HTML detection and iframe/sanitized HTML (email): `body` → `sanitizeHtml(body)` in iframe or raw `<pre>`.
  - Plain text (SMS/WhatsApp or non-HTML email): `<p>{body}</p>`.

So the **full conversation window body** is always:

- **inbox_messages.body_text** for the message being rendered.

There is no **inbox_messages.body_html** or separate “raw” body field in the thread view; the same `body_text` is used for both plain and HTML rendering (iframe or `<p>`). So the exact **DB field** for the full body is **inbox_messages.body_text**.

---

## 3. For one broken message: what to compare

For **one** conversation where the card looks correct but a message body is corrupted:

| Item | Where it comes from | What to check |
|------|---------------------|----------------|
| **Subject on card** | inbox_conversations.subject (first message’s Subject header) | Correct? |
| **Preview on card** | inbox_conversations.last_message_preview (latest message’s body slice) | Correct? |
| **Stored body for the broken message** | inbox_messages.body_text for that message row | Corrupted? |
| **Stored body for the latest message** | inbox_messages.body_text for the message that “owns” last_message_preview | Correct or corrupted? |
| **What the thread actually renders** | Same as body_text (plain or via sanitizeHtml in iframe) | Matches body_text. |

**Conclusion from paths:**

- If the **preview** is correct, it is the **latest** message’s body (sliced) from the same sync that wrote that message’s **body_text**. So either (a) the **latest** message has correct body_text and the **broken** one is an **older** message (different row), or (b) the conversation’s last_message_preview was updated by a **different** sync run than the one that wrote the broken message’s body_text (e.g. preview updated later with a fix, but the broken message’s row was never updated because of duplicate-skip).
- If the **subject** is correct, it is the first message’s Subject **header**; that path is independent of body decoding. So subject can be correct even when an older message’s body_text is corrupted.

---

## 4. Is the full window showing something different?

**Possibilities:**

- **Old corrupted body_text row** — The message you are looking at is an **older** message in the thread. Its **inbox_messages.body_text** was stored when it was first synced (e.g. with wrong decoding or snippet) and is **never** updated (gmail-sync-now skips “duplicate” by Gmail message ID and does not update existing rows). So the full window is showing **stale** body_text for that message. The card looks correct because **subject** is from headers and **last_message_preview** is from the **latest** message’s body, not from this old message.
- **Different field** — No. The thread uses only **body_text** for the body (no body_html or other field).
- **HTML rendering path** — The same **body_text** is passed into the iframe (sanitized) or `<p>`. So if body_text is corrupted, HTML view will show the same corruption. The problem is the **value** of body_text, not a separate “HTML decode” path.
- **Different message** — The card shows subject + preview (first + latest message); the thread shows **all** messages. So the corrupted body can be from a **different** message (e.g. an older one) than the message that supplied the preview. That is a **message selection / which row** difference, not a different field.

---

## 5. Root cause (summary)

**Exact root cause:** The **conversation card** uses **inbox_conversations.subject** and **inbox_conversations.last_message_preview**. Subject is the **first** message’s Subject header. Last_message_preview is the **latest** message’s body excerpt and is updated whenever we sync a newer message. So the card can show correct Georgian when (a) subject is correct (header encoding) and (b) the **latest** message’s body was synced correctly (or the preview was updated later). The **full conversation window** shows **inbox_messages.body_text** for **each** message. If an **older** message’s body_text was stored when it was first synced (with bad decoding or snippet) and the sync **never updates** existing message rows (duplicate skip), that older message’s body stays corrupted. So the path difference is:

- **Card:** conversation-level subject (first message) + conversation-level last_message_preview (latest message).
- **Full body:** per-message **inbox_messages.body_text** (each row written once, never updated on re-sync).

So the problem is **stale historical body_text** for at least one message in the thread (the one that appears corrupted in the full window). The “preview vs body” difference is that the preview is from the **latest** message (or was updated later), while the corrupted body is from an **older** message whose body_text was never fixed.

**Alternative:** If the **same** message is both the latest and the one with corrupted body (e.g. single-message thread), then either (a) last_message_preview was updated in a later sync with correct extraction while the message row was skipped (so body_text stayed wrong), or (b) subject is correct (header) but both preview and body_text are from the same broken body — then preview and body would both be wrong unless the UI is showing something else for the first line (e.g. subject only). So for “preview correct, body wrong” the most consistent explanation is: **preview = latest message’s slice; body = an older message’s body_text that was never updated.**

---

## 6. Exact file / component / function and DB field

| Role | Location | DB field |
|------|----------|----------|
| **Card subject** | InboxConversationList.tsx: `conversation.subject` | **inbox_conversations.subject** |
| **Card preview** | InboxConversationList.tsx: `conversation.last_message_preview` | **inbox_conversations.last_message_preview** |
| **Full conversation body** | ConversationThread.tsx: `message.body_text` for each message | **inbox_messages.body_text** |
| **Where body_text is written (no update on duplicate)** | gmail-sync-now/index.ts: insert into inbox_messages; duplicate check skips, no UPDATE | **inbox_messages.body_text** (set once per message) |
| **Where subject and last_message_preview are set** | gmail-sync-now/index.ts: conversation insert/update | **inbox_conversations.subject**, **inbox_conversations.last_message_preview** |

So the **full conversation body path** is: **inbox_messages.body_text** → **ConversationThread** → `message.body_text` → plain `<p>` or iframe `srcDoc={sanitizeHtml(body)}` / raw `<pre>`. The **exact** component/function for the corrupted content is **ConversationThread** rendering **inbox_messages.body_text** for that message row.

---

## 7. Recommended minimal fix

1. **Fix extraction for new syncs** — Ensure gmail-sync-now (and inbox-gmail-sync) decode body correctly (e.g. HTML fallback, charset-aware decode, or other MIME fix) so **new** messages get correct body_text.
2. **Fix existing corrupted rows** — For messages that already have wrong body_text (e.g. older message in a thread), the current sync does not update them. So:
   - **Option A:** Add a **backfill** (one-off or script): for affected Gmail message IDs (or for conversations with corrupted bodies), re-fetch from Gmail, re-run extraction, and **UPDATE** inbox_messages SET body_text = … WHERE meta->gmail->messageId = … .
   - **Option B:** When syncing, if we have improved extraction, **update** existing message rows for the same Gmail message ID (upsert or UPDATE body_text when we would have skipped as duplicate), so re-syncing the thread gradually fixes old rows.

Recommendation: implement **Option A** (targeted backfill for known broken messages or time window) so existing corrupted body_text is fixed without changing duplicate semantics for every sync; keep **Option B** as an optional improvement so future re-syncs can refresh body_text when extraction is improved.

---

## 8. Confirm which case applies

For the **one** broken conversation, confirm:

- **Is the corrupted body in the thread from the same message that “owns” the card preview?**  
  - If **yes** (single message or the latest message is the broken one): then either preview is from a different source (e.g. subject-only on first line) or there is a rare path where preview was updated but body_text was not.  
  - If **no** (corrupted body is from an older message): that matches **stale historical body_text**; card is correct because it shows latest (or subject); fix is backfill/update for that message’s row.

- **Compare one row:** For the message that displays corrupted, read **inbox_messages.body_text** and **inbox_conversations.last_message_preview** for that conversation. If preview is correct and body_text for that **same** message is wrong, then we have a path where the same message’s body is stored differently (e.g. conversation updated in a later run, message row never updated). If the corrupted body_text belongs to a **different** message (older), then the explanation is as above: preview = latest; body = older message’s stale body_text.
