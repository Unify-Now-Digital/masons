# Quickstart: People ↔ Inbox Linking

## Branch & Spec

- **Branch:** `feature/people-inbox-linking`
- **Spec:** `specs/people-inbox-linking-people-first-inbox.md`
- **Plan:** `specs/people-inbox-linking-plan/`

---

## Implementation Order

### 1. Migration

Create `supabase/migrations/20260124130000_add_person_link_to_inbox_conversations.sql`:

- Add `person_id`, `link_state`, `link_meta` to `inbox_conversations`
- Add indexes
- Apply: `npx supabase db push`

### 2. Edge Functions Auto-link

1. Create `supabase/functions/_shared/autoLinkConversation.ts` with `attemptAutoLink()`.
2. In `twilio-sms-webhook/index.ts`: call `attemptAutoLink(supabase, conversationId, 'sms', from.trim())` after conversation upsert.
3. In `inbox-gmail-sync/index.ts`: call `attemptAutoLink(supabase, conversationId, 'email', primaryHandle)` after conversation upsert.

### 3. Frontend Data Layer

1. **Types** (`inbox.types.ts`): Add `person_id`, `link_state`, `link_meta` to `InboxConversation`; add `person_id`, `unlinked_only` to `ConversationFilters`.
2. **API** (`inboxConversations.api.ts`): Extend `fetchConversations` filters; add `linkConversation`, `unlinkConversation`.
3. **Hooks** (`useInboxConversations.ts`): Add `useLinkConversation`, `useUnlinkConversation`.

### 4. UI

1. **PeopleSidebar** (`PeopleSidebar.tsx`): Search + list people, select person or "Unlinked".
2. **UnifiedInboxPage**: Add sidebar, `selectedPersonId` state, pass `person_id`/`unlinked_only` to filters.
3. **LinkConversationModal**: Search customers, select to link; unlink button.
4. **ConversationView**: Link banner when unlinked/ambiguous; person display when linked; handle ambiguous candidates.

---

## Key Files

| File | Action |
|------|--------|
| `supabase/migrations/20260124130000_add_person_link_to_inbox_conversations.sql` | Create |
| `supabase/functions/_shared/autoLinkConversation.ts` | Create |
| `supabase/functions/twilio-sms-webhook/index.ts` | Update |
| `supabase/functions/inbox-gmail-sync/index.ts` | Update |
| `src/modules/inbox/types/inbox.types.ts` | Update |
| `src/modules/inbox/api/inboxConversations.api.ts` | Update |
| `src/modules/inbox/hooks/useInboxConversations.ts` | Update |
| `src/modules/inbox/components/PeopleSidebar.tsx` | Create |
| `src/modules/inbox/components/LinkConversationModal.tsx` | Create |
| `src/modules/inbox/pages/UnifiedInboxPage.tsx` | Update |
| `src/modules/inbox/components/ConversationView.tsx` | Update |

---

## QA Checklist

1. Create customer with email X and phone Y.
2. Receive inbound email from X → conversation auto-links.
3. Receive inbound SMS from Y → conversation auto-links.
4. Create two customers with same phone → inbound SMS produces ambiguous banner with candidates.
5. Manual link resolves ambiguous and moves conversation under selected person.
6. Unlink returns conversation to Unlinked view.
7. Archive still works.

---

## Troubleshooting

**Auto-link not running:** Ensure `attemptAutoLink` is called after conversation upsert and that `primaryHandle` is trimmed.

**Unlinked filter empty:** Verify `unlinked_only: true` is passed when no person selected and that `fetchConversations` applies `.is('person_id', null)`.

**Person not displaying:** Check `useCustomer(person_id)` is called and that `first_name`/`last_name` exist; fallback to email/phone.
