# Research: Unified Inbox All Tab — Person Unified Timeline

## Existing state and utilities

### 1. Active tab state
- **Where:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`
- **State:** `activeTab` — `useState("all")`, values: `"all"` | `"email"` | `"sms"` | `"whatsapp"`
- **Setter:** `setActiveTab` — use to switch to channel when user clicks a message in All timeline

### 2. Selected person state
- **Where:** `UnifiedInboxPage.tsx`
- **State:** `selectedPersonId` — `useState<string | null>(null)` (People sidebar selection)
- **Setter:** `setSelectedPersonId` — passed to `PeopleSidebar` as `onSelectPerson`
- **Derived:** `activePersonId = selectedConversation?.person_id ?? selectedPersonId ?? null` (used for PersonOrdersPanel)

### 3. Selected conversation state
- **Where:** `UnifiedInboxPage.tsx`
- **State:** `selectedConversationId` — `useState<string | null>(null)`
- **Setter:** `setSelectedConversationId` — called when user clicks a conversation card in the list
- **Usage:** Passed to `ConversationView` as `conversationId`

### 4. Functions used when clicking a conversation
- **Conversation card click:** `onClick={() => setSelectedConversationId(conversation.id)}` (line ~223 in UnifiedInboxPage.tsx)
- **To open a specific conversation from All timeline:** call `setActiveTab(message.channel)` then `setSelectedConversationId(message.conversation_id)` (reuse same pattern; no separate `openConversation` helper exists)

### 5. Existing queries/hooks

| Purpose | Hook / API | File path |
|--------|------------|-----------|
| Conversations for filters (incl. person) | `useConversationsList(filters)` → `fetchConversations(filters)` | `hooks/useInboxConversations.ts`, `api/inboxConversations.api.ts` |
| Single conversation | `useConversation(id)` → `fetchConversation(id)` | same |
| Messages for one conversation | `useMessagesByConversation(conversationId)` → `fetchMessagesByConversation(conversationId)` | `hooks/useInboxMessages.ts`, `api/inboxMessages.api.ts` |

- **Person → conversation IDs:** Use `useConversationsList({ status: 'open', person_id: selectedPersonId })` when `selectedPersonId` is set. Do **not** set `channel` or `unlinked_only` when building filters for All tab so we get all channels for that person. When `activeTab === 'all'`, the same `filters` can still include `person_id`/`unlinked_only` for the People sidebar context; the conversation list is hidden, but we can use a dedicated query for timeline: e.g. `useConversationsList({ status: 'open', person_id: selectedPersonId })` with no channel filter to get all conversation IDs for the selected person.
- **Messages for multiple conversations:** There is no existing API that accepts multiple conversation IDs. Add a **client-only** helper in `inboxMessages.api.ts`: e.g. `fetchMessagesByConversationIds(ids: string[])` that queries `inbox_messages` with `.in('conversation_id', ids)` and `.order('sent_at', { ascending: true })`. No backend/schema change.

### 6. File paths summary

| Artifact | Absolute path |
|----------|----------------|
| Page (layout, tabs, state) | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\pages\UnifiedInboxPage.tsx` |
| People sidebar | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\PeopleSidebar.tsx` |
| Conversation view (thread + composer) | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\ConversationView.tsx` |
| Conversations hook/API | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\hooks\useInboxConversations.ts`, `api/inboxConversations.api.ts` |
| Messages hook/API | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\hooks\useInboxMessages.ts`, `api/inboxMessages.api.ts` |
| Inbox types | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\types\inbox.types.ts` |

### 7. Layout structure (current)
- Grid: `grid-cols-1 lg:grid-cols-[180px_260px_1fr]` — People | Conversations list | Conversation panel.
- For All tab: switch to 2 columns: `lg:grid-cols-[180px_1fr]` and render timeline in the right column; conversation picker column not rendered when `activeTab === 'all'`.

### 8. ConversationView and composer
- **ConversationView** shows thread + reply composer. For All tab we must not render ConversationView (or render a read-only timeline only). So when `activeTab === 'all'`, the right panel renders `AllMessagesTimeline` instead of `ConversationView`; no reply composer in All.
