# Unified Inbox — "All" Tab = Person Unified Timeline (No Conversation Picker)

## Overview

**Goal:** In the Unified Inbox, change the **All** tab behavior so that:
- In **All** tab, the conversation picker (middle column) is **hidden**.
- The **People** sidebar (left) remains.
- The right panel shows a **single unified message timeline** for the **selected person**, combining messages from **Email + SMS + WhatsApp** in one chronological feed.
- The All timeline is **read-only** (no reply box).
- Clicking a message in the All timeline **navigates to the underlying conversation thread** (switch to the correct channel tab and select that conversation).

**Scope:** Layout, data aggregation, and navigation only. No DB/API/schema/RLS changes.

---

## Context

### Current state
- **Tabs:** All | Email | SMS | WhatsApp. All tab currently shows conversation list + conversation panel (3 columns).
- **Layout:** People (180px) | Conversations list (260px) | Conversation panel (1fr).
- **Linking:** Conversations link to people via `inbox_conversations.person_id`; messages belong to conversations.

### Non-goals (must not change)
- No DB/API/schema/RLS changes.
- No changes to existing channel-specific tabs (Email/SMS/WhatsApp) behavior.
- No changes to unread logic, linking logic, or syncing logic.
- Do not reintroduce scroll jump; keep scrolling confined to the message container.
- Do not implement replying inside All tab.

---

## UX Rules (decisions locked)

1. **Aggregation scope:** Per selected person (People sidebar selection drives the feed).
2. **People sidebar:** Visible in All tab.
3. **Sorting:** Strict chronological by message timestamp (ascending).
4. **Reply in All:** Disabled (read-only feed).
5. **Click behavior:** Click a message → open its thread in the appropriate channel tab and load that conversation.
6. **Unread/archive actions:** Remain in channel tabs only; All is read-only.

---

## Functional Requirements

### A) Layout: All tab hides conversation picker

When active tab is **All**:
- Hide the conversation picker column entirely.
- Layout becomes 2 columns: People (left, existing width) | Unified timeline (right, remaining width).
- Email/SMS/WhatsApp tabs keep the current 3-column layout (People | Conversations list | Conversation panel).

**Acceptance**
- [ ] In All tab, conversation list column is not visible.
- [ ] The right panel (timeline) uses remaining width.

---

### B) Data: unified messages for selected person

When a person is selected in the People sidebar:
- Load all messages from conversations linked to that person (across Email, SMS, WhatsApp).
- If "Unlinked" is selected (no person), show empty state or prompt—no new linking logic.
- **Sorting:** By message timestamp (`sent_at` or fallback `created_at`), strictly chronological (ascending for timeline order).

**Implementation guidance**
- Use existing Person → Conversation linking to get conversation IDs for the selected person.
- Fetch messages for those conversations (reuse existing message APIs/hooks where possible); merge and sort in client if server-side merge is not available.

**Acceptance**
- [ ] All tab shows a combined timeline of Email + SMS + WhatsApp messages for the selected person.
- [ ] Messages appear in correct time order.

---

### C) UI: unified timeline message item

Each message in the All timeline must show:
- Channel badge (Email / SMS / WhatsApp).
- Direction (inbound/outbound) — reuse existing bubble style or simplified row style.
- Sender/recipient context (small, muted).
- Timestamp.
- Message body (reuse existing wrap rules; no horizontal overflow).

The All timeline must be scrollable within its container (no whole-page scroll).

**Acceptance**
- [ ] Timeline is readable and consistent; no horizontal overflow.
- [ ] Existing wrap rules (break-words, etc.) apply.

---

### D) Read-only behavior in All

- No reply composer in All tab (remove or hide).
- No Send Reply button; no input field.

**Acceptance**
- [ ] Users cannot send messages from All tab.

---

### E) Click to open underlying thread (navigation)

When the user clicks a message in the All timeline:
- Set active tab to the message’s channel (Email, SMS, or WhatsApp).
- Select/open the conversation that contains that message (same as if user had clicked it in the conversation picker).
- Optionally scroll to or highlight the clicked message in the thread (optional).
- User can then reply in the normal thread view.

**Acceptance**
- [ ] Clicking an All message opens the correct conversation in the correct channel tab.

---

### F) Empty states

- **No person selected:** Show “Select a person to view all messages.”
- **Selected person has no linked conversations/messages:** Show “No messages for this person yet.”
- **Unlinked group selected (no person context):** Show “Link a person to view combined messages.”

**Acceptance**
- [ ] No blank or broken panels; helpful guidance text in each case.

---

## Implementation Notes

### Files likely to change
- **UnifiedInboxPage.tsx:** Conditional layout (2 columns when tab is All, 3 columns otherwise); active tab and selected conversation state; handling “open conversation by id/channel” when coming from All.
- **New component (recommended):** `AllMessagesTimeline.tsx` (or similar) for the unified feed UI (message items, empty states, scroll container, click handler that switches tab + selects conversation).
- Reuse existing conversation/message fetching and navigation logic where possible; avoid duplicating query code.

### Data flow (guidance)
- Selected person from People sidebar → conversation IDs linked to that person → messages for those conversations → merge + sort by timestamp → render in AllMessagesTimeline.
- On message click: conversationId + channel → setActiveTab(channel), setSelectedConversationId(conversationId).

---

## Done when

- All tab hides the conversation picker and shows a person-scoped unified timeline.
- Timeline merges all channels in strict chronological order.
- All tab is read-only; clicking a message opens the correct thread in the right channel tab.
- No regressions in scroll behavior or in Email/SMS/WhatsApp tabs.
- Build passes.
