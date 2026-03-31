# Research: Customer Linked Contacts

**Date**: 2026-03-31

---

## 1. fetchConversations is NOT suitable for reuse

**Decision**: Write a lightweight direct Supabase query, not a wrapper around `fetchConversations`.

**Rationale**: `fetchConversations` (in `inboxConversations.api.ts`) defaults to `status='open'`, fetches all columns (`select('*')`), and returns full `InboxConversation` objects. For linked contacts we only need `(channel, primary_handle)` and `link_state='linked'`, regardless of conversation status (a linked email should remain visible even if the conversation is archived). Using `fetchConversations` would require overriding the status filter AND would over-fetch data.

**Query used**:
```ts
supabase
  .from('inbox_conversations')
  .select('channel, primary_handle')
  .eq('person_id', customerId)
  .eq('link_state', 'linked')
```
No `status` filter — linked contacts from archived conversations are still valid contact handles.

---

## 2. Hook location: src/modules/customers/hooks/useLinkedContacts.ts

**Decision**: New dedicated file in the customers module.

**Rationale**: The hook is consumed by two different modules (customers UI + proofs UI) and is keyed by `customerId`. Placing it in `customers/hooks/` makes the module boundary clear: the customers module owns the concept of a customer's contact set. The proofs module imports it via the customers module's public index.

**Alternative considered**: `src/modules/inbox/hooks/` — rejected because the inbox module does not own the concept of "contacts for a customer"; it owns conversations.

---

## 3. customerId source in OrderDetailsSidebar

**Decision**: Use `order.person_id` directly. Remove `useOrderPeople` derivation.

**Rationale**: `order.person_id` is already on the `Order` object (confirmed in `orders.types.ts` line 32). The `useOrderPeople` hook + `primaryPerson` + `proofCustomerEmail/Phone` lines were added in a prior hotfix as a temporary workaround. Now that `ProofSendModal` fetches contacts internally, they are unnecessary overhead (one extra network request per sidebar open).

---

## 4. ProofSendModal internal data strategy

**Decision**: Modal calls two hooks internally — `useLinkedContactsByCustomer(customerId)` + `useCustomer(customerId)`.

**Rationale**: This makes the modal self-contained. The caller only needs to know the `customerId`, not resolve email/phone strings before opening. Both hooks are disabled when `customerId` is null/undefined, so the modal gracefully handles unlinked orders (all channels disabled).

**Static vs linked**: The static `customer.email` / `customer.phone` are merged into the email/phone option sets. The radio group shows "(Primary)" label next to the static value to help staff distinguish. Deduplication happens after merge so the same address is never shown twice.

---

## 5. Phone channel merging (sms + whatsapp → phone options)

**Decision**: For the "WhatsApp" channel picker, merge handles from both `channel='sms'` and `channel='whatsapp'` linked conversations.

**Rationale**: Both represent phone numbers reachable via WhatsApp or SMS. A phone number that appeared in an SMS thread is likely the same person's WhatsApp number. The picker shows the original channel label (`sms` / `whatsapp`) next to each handle so staff know the source, but does not exclude SMS contacts from the WhatsApp channel picker.

---

## 6. What is NOT changing

| Area | Status |
|------|--------|
| `inbox_conversations` table / schema | Untouched |
| `linkConversation` / `unlinkConversation` functions | Untouched |
| Static Email / Phone fields on customer record | Untouched (read + shown as "(Primary)" option) |
| Orders RLS, Jobs, Inscriptions | Untouched |
| `proof-generate` / `proof-send` edge functions | Untouched |
| `useConversationsList` / `fetchConversations` | Untouched — not reused |
