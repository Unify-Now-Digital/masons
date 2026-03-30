# Quickstart — verify unlinked Customers tab (post-implementation)

1. **Seed state:** Create or use an `inbox_conversations` row with `person_id` NULL, `primary_handle` = known email, `channel` = `email`, `status` = `open`.
2. **Customers tab:** Confirm a row appears titled with that email, with **Unlinked** badge.
3. **Select row:** Middle pane shows only messages whose parent conversations match that exact handle (add second conversation same handle — both appear; different handle — excluded).
4. **Search:** Type substring of handle; row remains if server search returns matching conversations.
5. **Filters:** **Unlinked** shows only pseudo-rows; **All** shows linked + unlinked mixed by activity.
6. **AI summary:** Banner loads without error; change message content; summary invalidates after window/refetch.
7. **Link:** Link one conversation to a person; row disappears from unlinked group or shrinks; linked customer shows merged behavior as today.
8. **Orders:** With unlinked selected, right panel shows no orders / empty state for person.

## Deploy order

1. Apply DB migration (summaries + RLS).
2. Deploy edge function `inbox-ai-thread-summary`.
3. Deploy frontend.
