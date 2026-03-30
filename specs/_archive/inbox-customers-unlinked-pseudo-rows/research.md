# Phase 0 — Research (Inbox Customers unlinked pseudo-rows)

## Existing behavior verified in codebase

- **`useCustomerThreads.ts`** drops conversations without `person_id` and, when `listFilter === 'unlinked'`, skips emitting linked rows entirely — Customers tab cannot show unlinked work today.
- **`CustomerConversationView.tsx`** assumes a real `personId` and `useCustomer` + `customer_timeline` summary.
- **`fetchConversations`** supports `unlinked_only` (`person_id IS NULL`) and text search on `primary_handle`.
- **`inbox-ai-thread-summary`** supports `conversation` and `customer_timeline` only; `person_id` must be UUID.
- **`inbox_ai_thread_summaries`** table: two-scope CHECK; unique per `conversation_id` or `person_id`; RLS ties to `inbox_conversations`.

## Decisions

- Pseudo-customers are **derived** from `inbox_conversations` rows with `person_id IS NULL`; no new People table rows.
- **Exact** handle grouping uses stored `primary_handle` string equality.
- AI summary persistence **requires** schema extension + `user_id` (or equivalent) for unlinked uniqueness per tenant user.

## References (code paths)

- `c:/Users/owner/Desktop/unify-memorial-mason-main/src/modules/inbox/hooks/useCustomerThreads.ts`
- `c:/Users/owner/Desktop/unify-memorial-mason-main/src/modules/inbox/components/CustomerConversationView.tsx`
- `c:/Users/owner/Desktop/unify-memorial-mason-main/supabase/functions/inbox-ai-thread-summary/index.ts`
- `c:/Users/owner/Desktop/unify-memorial-mason-main/supabase/migrations/20260320120000_create_inbox_ai_thread_summaries.sql`
