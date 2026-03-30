# Tasks: Unified Inbox All Tab — Person Unified Timeline

Branch: `feature/unified-inbox-all-tab-person-unified-timeline`  
Spec: `specs/unified-inbox-all-tab-person-unified-timeline.md`

Guardrails: UI + query composition only. No DB/API/schema changes. Preserve channel tabs, scroll behavior, and selection logic. All tab read-only; click in All opens correct channel + conversation.

---

## Phase 1: Layout change for All tab (2 columns)

**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

- [x] Implement conditional layout:
  - If `activeTab === 'all'`: render **People sidebar + right timeline panel only** (2 columns).
  - Else: render People sidebar + conversation picker + conversation view (current 3-column layout).
- [x] Ensure timeline panel has `min-w-0` and correct scroll containment.

**Acceptance:** All tab has no conversation picker column; other tabs unchanged.

---

## Phase 2: Data pipeline for All timeline (person → conversations → messages)

Implement in **AllMessagesTimeline** component and/or new hook **usePersonUnifiedTimeline(personId)**.

- [x] Map person → conversation IDs:
  - Use existing `useConversationsList` / `fetchConversations` with `{ status: 'open', person_id: personId }` (no `channel` filter) to get all conversations for the person.
- [x] Add client-only helper **fetchMessagesByConversationIds(ids)** in `src/modules/inbox/api/inboxMessages.api.ts`:
  - Query `inbox_messages` with `.in('conversation_id', ids)` and `.order('sent_at', { ascending: true })`.
  - Return `InboxMessage[]`; if `ids.length === 0` return `[]` without calling Supabase.
- [x] Fetch messages for those conversation IDs (single query via new helper).
- [x] Merge and sort strictly chronological (ascending). Rely on server ordering; optional client sort fallback by `sent_at` / `created_at`.
- [x] Ensure payload includes: message id, conversation_id, channel, direction, timestamp (sent_at/created_at), body/snippet for UI and navigation.

**Acceptance:** Selecting a person produces a unified list of messages across channels in time order.

---

## Phase 3: UI for All timeline list

**Create:** `src/modules/inbox/components/AllMessagesTimeline.tsx`

- [x] Render scrollable timeline in right panel: `flex-1 overflow-auto min-w-0`.
- [x] Per message item:
  - Channel badge (Email / SMS / WhatsApp).
  - Direction indicator (in/out).
  - Timestamp.
  - Small context line (e.g. conversation handle).
  - Body with wrapping (`whitespace-pre-wrap break-words`) and existing overflow protections.
- [x] Dense, consistent styling: compact rows, subtle separators, hover highlight.

**Acceptance:** Timeline is readable, wraps long content, no overflow.

---

## Phase 4: Read-only behavior in All tab

- [x] Do not render the reply composer when `activeTab === 'all'` (timeline panel shows only AllMessagesTimeline, no ConversationView composer).
- [x] Ensure no send action is reachable from All timeline.

**Acceptance:** All tab cannot send replies.

---

## Phase 5: Click message → open underlying thread (navigation)

- [x] On timeline message click:
  1. Set `activeTab` to message’s channel (`email` | `sms` | `whatsapp`).
  2. Set `selectedConversationId` to message’s `conversation_id` (using existing state/setters).
  3. Optional: store transient `highlightMessageId` to scroll/highlight after navigation; otherwise omit.

**Acceptance:** Click reliably opens the correct channel tab and conversation.

---

## Phase 6: Empty states

- [x] No person selected: show “Select a person to view all messages.”
- [x] Person selected but no messages: show “No messages for this person yet.”
- [x] Unlinked group selected without concrete person context: show “Link a person to view combined messages.”

**Acceptance:** No blank panels; clear user guidance.

---

## Phase 7: QA checklist

- [x] All tab hides conversation picker.
- [x] People sidebar still works.
- [x] Timeline shows Email/SMS/WhatsApp together in chronological order.
- [x] All is read-only.
- [x] Clicking a timeline item opens correct channel tab + conversation.
- [x] No scroll regressions, no width overflow.
- [x] Build passes.

---

## Phase 8: Commit plan (3 commits)

1. `ui(inbox): All tab uses 2-column layout (hide conversation picker)`
2. `feat(inbox): person unified timeline component for All tab (read-only)`
3. `ui(inbox): All timeline click-to-open-thread + empty states`
