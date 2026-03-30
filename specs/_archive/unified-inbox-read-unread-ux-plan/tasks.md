## Phases & Tasks – Unified Inbox Read/Unread UX

- [ ] Phase 1: Planning & Inventory
  - [ ] Review Unified Inbox components and hooks (page, list, header, messages) to locate `selectedConversationId` and existing mark-as-read mutation.
  - [ ] Confirm how `unread_count` is exposed in conversation types and query results.

- [ ] Phase 2: Auto-Mark Read on Open
  - [ ] Add a side-effect in `UnifiedInboxPage.tsx` (or central selection handler) that:
    - When `selectedConversationId` changes, looks up the selected conversation.
    - If `unread_count > 0` and channel supports unread, triggers the mark-as-read mutation once.
  - [ ] Implement optimistic cache updates so `unread_count` becomes `0` immediately for that conversation across relevant query keys.
  - [ ] Add guards to avoid spamming the API (only fire when transitioning from unread → read; do not re-fire for already-read conversations).
  - [ ] Handle mutation errors by rolling back or refetching conversations; surface a toast if needed.

- [ ] Phase 3: Read/Unread Toggle Button
  - [ ] Replace the existing “Mark as Read” toolbar button with a dynamic toggle that:
    - Shows **“Mark as Read”** when `unread_count > 0`.
    - Shows **“Mark as Unread”** when `unread_count === 0`.
  - [ ] Wire the button to:
    - Call the existing mark-as-read mutation for unread → read.
    - Call a new mark-as-unread mutation for read → unread.
  - [ ] Implement the mark-as-unread mutation in the inbox API/hooks layer with:
    - `unread_count = 1` for count-only model (or appropriate flag changes if richer read metadata exists).
    - Optimistic updates and error handling mirroring mark-as-read.

- [ ] Phase 4: Consistency & QA
  - [ ] Verify unread badges update immediately when:
    - Opening an unread conversation.
    - Toggling read ↔ unread via the button.
  - [ ] Ensure All + Email/SMS/WhatsApp tabs stay in sync for the same conversation’s unread state.
  - [ ] Confirm no regressions in scroll behavior or layout (especially around existing `min-w-0` and drawer layouts).
  - [ ] Run `npm run build` (and lint/tests if available) to confirm the build passes.

