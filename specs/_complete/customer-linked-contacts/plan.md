# Implementation Plan: Customer Linked Contacts — Visibility + Proof-Send Resolution

**Branch**: `fix/customer-linked-contacts` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)

---

## Summary

Add `useLinkedContactsByCustomer` hook querying `inbox_conversations` by `person_id`, display linked contacts read-only in `EditCustomerDrawer`, replace `customerEmail`/`customerPhone` string props throughout the proof delivery stack with a `customerId` prop + internal contact picker in `ProofSendModal`, and simplify `OrderDetailsSidebar` by removing the now-redundant `useOrderPeople` derivation.

---

## Technical Context

**Language/Version**: TypeScript 5.5 (frontend)
**Primary Dependencies**: React 18, Vite, Tailwind, shadcn/ui, React Query v5, Zod
**Storage**: Supabase Postgres (read-only query on `inbox_conversations`)
**Testing**: Manual verification via quickstart.md
**Target Platform**: Web browser, desktop-primary staff tool
**Constraints**: No new tables/columns; no migrations; no Inbox logic changes; all form changes additive

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Dual router constraint | ✅ Pass | No routing changes |
| Module boundaries | ✅ Pass | New hook in `src/modules/customers/hooks/`; ProofSendModal gets `customerId` and fetches data internally |
| Supabase + RLS | ✅ Pass | Query on `inbox_conversations` inherits existing RLS; no new policies |
| Secrets stay server-side | ✅ Pass | No server-side changes |
| Additive-first | ✅ Pass | EditCustomerDrawer gains a section; ProofSendModal and ProofPanel prop signatures change; OrderDetailsSidebar simplified |

---

## Project Structure

### Documentation

```text
specs/_active/customer-linked-contacts/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── ui-contracts.md
```

### Source Code (affected files)

```text
src/modules/customers/
├── hooks/
│   └── useLinkedContacts.ts               NEW — useLinkedContactsByCustomer hook
├── components/
│   └── EditCustomerDrawer.tsx             MODIFIED — add Linked Contacts section (additive)
└── index.ts                               MODIFIED — re-export useLinkedContactsByCustomer

src/modules/proofs/
├── components/
│   ├── ProofSendModal.tsx                 MODIFIED — prop signature + contact picker
│   └── ProofPanel.tsx                    MODIFIED — prop signature (string → customerId)

src/modules/orders/
└── components/
    └── OrderDetailsSidebar.tsx            MODIFIED — simplify (remove useOrderPeople + derivations)
```

---

## Phase 0: Research Findings

See [research.md](./research.md). Summary:

1. **`fetchConversations` is unsuitable for reuse** — it filters `status='open'` by default and fetches `*` (all columns + heavy joins). A lightweight direct Supabase query is required to fetch only `(channel, primary_handle)` for a specific `person_id`.

2. **Hook location decision**: New file `src/modules/customers/hooks/useLinkedContacts.ts`. The data is customer-scoped (keyed by `customerId`), consumed by customer UI (EditCustomerDrawer) and proof UI (ProofSendModal). Placing it in `customers/hooks/` keeps the module boundary clean.

3. **`customerId` source in OrderDetailsSidebar**: `order.person_id` — already available on the `Order` object. After this change, `useOrderPeople` and the `proofCustomerEmail`/`proofCustomerPhone` derivations can be fully removed.

4. **ProofSendModal internal data fetching**: Modal calls `useLinkedContactsByCustomer(customerId)` for linked contacts AND `useCustomer(customerId)` for static email/phone. Both hooks are enabled only when `customerId` is non-null. Static and linked options are merged and deduplicated before rendering.

5. **Phone channel merging**: For the "WhatsApp" channel in ProofSendModal, both `sms` and `whatsapp` linked conversations are valid — both represent phone-capable contacts. The picker merges them and shows the `whatsapp`/`sms` channel label next to each handle.

---

## Phase 1: Design

### Deduplication strategy

Deduplicate by normalised `handle.trim().toLowerCase()`. For email options, only `channel='email'` handles apply. For phone/WhatsApp options, both `channel='sms'` and `channel='whatsapp'` handles apply (they're the same user's phone). Static customer fields (`customer.email`, `customer.phone`) are included in the respective option sets before deduplication.

### Contact picker behaviour summary

```
Zero options for channel  → checkbox disabled + tooltip
One option               → checkbox pre-checked, no radio (address shown inline)
Multiple options         → checkbox enabled, radio group visible when checkbox checked
```

### OrderDetailsSidebar simplification

The `useOrderPeople` hook call + `primaryPerson` + `proofCustomerEmail` + `proofCustomerPhone` lines added during the hotfix are all removed. `ProofPanel` now receives `customerId={order.person_id ?? null}` only. This is cleaner and removes a redundant network request.
