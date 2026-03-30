# Tasks: Split Phone Tab into SMS + WhatsApp

## Task Summary

| # | Task | Type | File | Phase |
|---|------|------|------|-------|
| 0.1 | Confirm channel values in DB | Verify | SQL | 0 |
| 1.1 | Update ConversationFilters.channel type | Update | `inbox.types.ts` | 1 |
| 2.1 | Remove 'phone' mapping, support sms/whatsapp | Update | `inboxConversations.api.ts` | 2 |
| 3.1 | Replace Phone tab with SMS + WhatsApp tabs | Update | `UnifiedInboxPage.tsx` | 3 |
| 3.2 | Update filter mapping for sms/whatsapp | Update | `UnifiedInboxPage.tsx` | 3 |
| 4.1 | QA: All tabs and behavior | Verify | - | 4 |

---

## Phase 0: Confirm Channel Values

### Task 0.1: Run SQL Sanity Check

**Type:** VERIFY  
**Description:** Run `select channel, count(*) from inbox_conversations group by channel;` in Supabase SQL editor. Ensure channels are `email`, `sms`, `whatsapp` (lowercase). No `wa`, etc.

**Acceptance Criteria:** Filters will use `'sms'` and `'whatsapp'` directly.

---

## Phase 1: Types Update

### Task 1.1: Update ConversationFilters.channel

**Type:** UPDATE  
**File:** `src/modules/inbox/types/inbox.types.ts`

**Changes:**
- Remove `'phone'` from `ConversationFilters.channel` type
- Type: `channel?: 'email' | 'sms' | 'whatsapp'`

**Acceptance Criteria:** No `'phone'` in channel union. TS types align with new tabs.

---

## Phase 2: API Filter Mapping

### Task 2.1: Remove Phone Alias, Support sms/whatsapp

**Type:** UPDATE  
**File:** `src/modules/inbox/api/inboxConversations.api.ts`

**Changes:**
- Remove `filters.channel === 'phone'` branch (and `.in('channel', ['sms','whatsapp'])`)
- Use `.eq('channel', filters.channel)` for all channel values (`email`, `sms`, `whatsapp`)
- No special handling needed — single-channel filter already correct

**Acceptance Criteria:**
- `channel='email'` → email only
- `channel='sms'` → sms only
- `channel='whatsapp'` → whatsapp only
- No channel → all channels

---

## Phase 3: UI Tabs + Wiring

### Task 3.1: Replace Phone with SMS and WhatsApp Tabs

**Type:** UPDATE  
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Changes:**
- Change `TabsList` from `grid-cols-4` to `grid-cols-5`
- Replace `<TabsTrigger value="phone">Phone</TabsTrigger>` with:
  - `<TabsTrigger value="sms">SMS</TabsTrigger>`
  - `<TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>`

**Acceptance Criteria:** UI shows 5 tabs: All, Unread, Email, SMS, WhatsApp.

---

### Task 3.2: Update Filter Mapping

**Type:** UPDATE  
**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Changes:**
- Remove `activeTab === 'phone'` branch
- Add `activeTab === 'sms'` → `base.channel = 'sms'`
- Add `activeTab === 'whatsapp'` → `base.channel = 'whatsapp'`

**Acceptance Criteria:**
- SMS tab shows only sms
- WhatsApp tab shows only whatsapp
- All/Unread/Email unchanged

---

## Phase 4: QA

### Task 4.1: Manual QA

- [ ] All tab shows all channels
- [ ] Unread shows unread across email/sms/whatsapp
- [ ] Email tab shows only email
- [ ] SMS tab shows only sms
- [ ] WhatsApp tab shows only whatsapp
- [ ] Search works within each tab
- [ ] Archive removes convo from visible list (status filter unchanged)
- [ ] Build passes

---

## Commit Plan

Single commit: **"Split Phone tab into SMS and WhatsApp"**

Includes: types + api + ui

---

## Progress Tracking

**Phase 0**
- [X] Task 0.1: Confirm channel values

**Phase 1**
- [X] Task 1.1: Update types

**Phase 2**
- [X] Task 2.1: API filter mapping

**Phase 3**
- [X] Task 3.1: Replace Phone tab with SMS + WhatsApp
- [X] Task 3.2: Update filter mapping

**Phase 4**
- [ ] Task 4.1: QA
