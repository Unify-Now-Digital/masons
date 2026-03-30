# Research: Customer-Centric Unified Inbox Mode

## 1) Current architecture findings

### Active inbox route/page
- `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- Current state is conversation-centric:
  - list filters: `all | unread | urgent | unlinked`
  - channel filter: `all | email | sms | whatsapp`
  - selected entity: `selectedConversationId`

### Existing left list and filters
- `src/modules/inbox/components/InboxConversationList.tsx`
- Renders one row per `InboxConversation`.
- Already computes list-level unread totals and supports existing tabs/actions.

### Existing thread rendering/composer
- `src/modules/inbox/components/ConversationView.tsx`
- `src/modules/inbox/components/ConversationThread.tsx`
- `ConversationThread` already supports mixed timeline behaviors and channel badges.

### Existing person-unified timeline foundation
- `src/modules/inbox/hooks/useInboxMessages.ts`
  - `usePersonUnifiedTimeline(personId)` already fetches conversations for person, then messages by conversation IDs.
- `src/modules/inbox/api/inboxMessages.api.ts`
  - `fetchMessagesByConversationIds` already exists.

### Existing send routing foundation
- `useSendReply` in `useInboxMessages.ts` routes by channel:
  - Email -> `sendGmailReply` / `sendGmailFirstMessage`
  - SMS -> `sendSmsReply`
  - WhatsApp -> `sendTwilioMessage`
- This must be preserved.

## 2) Decision: frontend aggregation vs SQL/API

- **Selected:** frontend aggregation only.
- **Why now:** codebase already has the required primitives and query hooks; adding SQL view/API introduces unnecessary risk and migration overhead.
- **Scalability path:** add backend aggregate view/RPC only if large datasets cause measurable performance issues.

## 3) Risks and mitigation

- Risk: accidentally regressing existing tabs behavior.
  - Mitigation: isolate new logic behind explicit `viewMode === 'customers'`.
- Risk: channel selector defaults to wrong channel in unified mode.
  - Mitigation: derive from latest inbound message per person.
- Risk: missing channel destination for person.
  - Mitigation: show disabled channels and block send.
- Risk: duplicate/unstable ordering when combining channels.
  - Mitigation: stable sort by `sent_at`, fallback `created_at`, tie-break by `id`.

