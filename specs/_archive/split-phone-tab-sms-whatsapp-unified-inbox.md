# Split Phone Tab into SMS + WhatsApp Tabs in Unified Inbox

## Overview

**Goal:** Replace the current "Phone" tab (which shows both SMS + WhatsApp) with two separate tabs: **SMS** and **WhatsApp**. Result: 5 tabs total — All, Unread, Email, SMS, WhatsApp.

**Scope:** UI-only change in Unified Inbox. No DB schema, People linking, or Edge Function changes.

---

## Context

### Current State
- **Location:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- **Tabs (4):** All, Unread, Email, Phone
- **Phone tab:** Maps to `channel: 'phone'` in filters, which the API translates to `channel IN ('sms', 'whatsapp')`

### Data Model
- `inbox_conversations.channel` is one of: `'email' | 'sms' | 'whatsapp'` (lowercase in DB)
- API (`inboxConversations.api.ts`): When `filters.channel === 'phone'`, uses `.in('channel', ['sms', 'whatsapp'])`; otherwise uses `.eq('channel', filters.channel)`

---

## Functional Requirements

### 1. New Tab Layout (5 tabs)
| Tab      | Filter behavior                                         |
|----------|---------------------------------------------------------|
| All      | All channels (no channel filter)                        |
| Unread   | `unread_only: true`, all channels                       |
| Email    | `channel: 'email'`                                     |
| SMS      | `channel: 'sms'`                                       |
| WhatsApp | `channel: 'whatsapp'`                                  |

### 2. Rename and Split
- **Remove:** Phone tab
- **Add:** SMS tab → `channel: 'sms'`
- **Add:** WhatsApp tab → `channel: 'whatsapp'`

### 3. Preserved Behavior
- All: no channel filter
- Unread: `unread_only: true`, no channel filter (shows unread across email + sms + whatsapp)
- Email: `channel: 'email'` (unchanged)
- Search: continues to search within the currently selected tab
- Archive/status: `status='open'` for main list, archived hidden (unchanged)
- Selection: tab switch behavior unchanged (no explicit selection reset required)

### 4. API Changes
- Remove `'phone'` mapping in `ConversationFilters` / `fetchConversations`
- Add `channel: 'sms'` and `channel: 'whatsapp'` directly — API already supports `.eq('channel', filters.channel)` for single channels
- `ConversationFilters.channel` type: extend to keep `'phone'` for backward compatibility or remove; implementation will use `'sms'` and `'whatsapp'` only

---

## Non-Goals
- No DB schema changes
- No People linking logic changes
- No message send/ingest Edge Function changes
- No unread count computation changes

---

## Acceptance Criteria
- [ ] UI shows 5 tabs: All, Unread, Email, SMS, WhatsApp
- [ ] SMS tab shows only conversations with `channel='sms'`
- [ ] WhatsApp tab shows only conversations with `channel='whatsapp'`
- [ ] Email tab shows only `channel='email'`
- [ ] All and Unread behave exactly as before
- [ ] Build passes / no TS errors

---

## Implementation Notes

### Files to Modify
1. **`src/modules/inbox/pages/UnifiedInboxPage.tsx`**
   - Change `TabsList` from `grid-cols-4` to `grid-cols-5`
   - Replace `<TabsTrigger value="phone">Phone</TabsTrigger>` with:
     - `<TabsTrigger value="sms">SMS</TabsTrigger>`
     - `<TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>`
   - Update filters mapping:
     - Remove `activeTab === 'phone'` branch
     - Add `activeTab === 'sms'` → `base.channel = 'sms'`
     - Add `activeTab === 'whatsapp'` → `base.channel = 'whatsapp'`

2. **`src/modules/inbox/api/inboxConversations.api.ts`**
   - Remove or simplify `filters.channel === 'phone'` branch (no longer used)
   - Single-channel filters (`'email' | 'sms' | 'whatsapp'`) already use `.eq('channel', filters.channel)` — no change needed if we stop passing `'phone'`

3. **`src/modules/inbox/types/inbox.types.ts`**
   - Optional: remove `'phone'` from `ConversationFilters.channel` type if no longer used

### Icons
- SMS: reuse `Phone` icon (or `MessageSquare` if preferred)
- WhatsApp: reuse `MessageSquare` or `Phone`; or add WhatsApp-brand icon if available in lucide-react (check: no dedicated WhatsApp icon; use `MessageCircle` or `Phone`)

---

## QA Checklist
- [ ] Each tab displays correct conversations for sms/whatsapp/email sample data
- [ ] Unread tab includes unread WhatsApp and unread SMS
- [ ] Search works per-tab as before
- [ ] Archiving a WhatsApp conversation removes it from WhatsApp tab (status filter unchanged)

---

**Branch:** `feature/split-phone-tab-sms-whatsapp`  
**Spec version:** 1.0
