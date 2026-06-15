# Quickstart: Inbox Consolidation (015)

**Branch**: `015-inbox-consolidation` | **Trunk**: `staging`

## Prerequisites

- Active workshop with mixed inbox data: unlinked WhatsApp/SMS enquiries, linked orders, email threads
- Two user accounts in same org (for email privacy check)
- 013 org-stamp fixes applied or done in same branch

## Setup

```bash
npm install
npm run dev
# Apply migration when added:
# supabase db push   # or deploy migration via your usual pipeline
```

## Smoke tests

### 1. Navigation consolidation

- [ ] Sidebar **Inbox** opens `/dashboard/inbox`
- [ ] Direct `/dashboard/enquiry-triage` redirects to `/dashboard/inbox?segment=enquiries`
- [ ] `/dashboard/ghl-inbox` unchanged
- [ ] `rg enquiryTriage src/` returns **no matches** after module deletion

### 2. Enquiries segment (human pipeline)

- [ ] Switch to **Enquiries** segment — **two-column** card/pipeline layout visible (**New** | **In progress** only; no third column)
- [ ] Only open, order-unlinked conversations appear
- [ ] New enquiry defaults to **New** column
- [ ] **Mark in progress** moves card to **In progress**; persists on refresh
- [ ] Zero AI confidence / "not yet analysed" / `AIBadge` chrome
- [ ] Channel filter (Email / WhatsApp / SMS) works within Enquiries
- [ ] **No Order created column** — linked enquiries are not shown on the board

### 3. All / Linked segment (regression)

- [ ] Reply works on Email, WhatsApp, SMS
- [ ] Link / unlink person and order still works
- [ ] Linked conversation shows **Order context** right panel (invoice + full order)
- [ ] Customers tab still works

### 4. Create order from enquiry

- [ ] Select unlinked enquiry with linked person → right panel shows create-order with person fields prefilled from `people`
- [ ] Select unlinked enquiry with handle only → email/phone prefilled from channel + handle
- [ ] Complete order → conversation gets `order_id` and `enquiry_stage = 'order_created'` in DB; **card disappears from Enquiries funnel** with brief confirmation (toast or inline ack); open linked thread via **All / Linked** or Orders

### 5. Dual-scoped visibility

- [ ] User A: email enquiries visible only to User A (not User B)
- [ ] User A + User B: same WhatsApp enquiry visible to both; stage change by either visible to both

### 6. Org stamp (AC-005)

**Client internal note**:

```bash
# In browser: add internal note on a conversation
# Network: POST inbox_messages includes organization_id matching parent conversation
```

**Edge inbound** (WhatsApp/SMS test message):

```sql
select m.id, m.conversation_id, m.organization_id, c.organization_id as parent_org
from public.inbox_messages m
join public.inbox_conversations c on c.id = m.conversation_id
order by m.created_at desc
limit 5;
```

- [ ] `m.organization_id = c.organization_id` for new inbound rows

## Lint

```bash
npm run lint
```

## Out of scope — do not test here

- GHL inbox behaviour changes
- GHL history backfill
- AI extraction worker / `inbox_enquiry_extraction` population
- `ghl-webhook` (does not write inbox messages)
