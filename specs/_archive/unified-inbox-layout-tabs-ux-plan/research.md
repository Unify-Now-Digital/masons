# Research: Unified Inbox Layout & Tabs UX Update

## Guardrails (read first)
- **UI-only:** Tabs, layout, styling. No data fetching, unread_count logic, linking logic, or DB changes.
- **Preserve:** "No page scroll jump" — message container scroll only (existing fix in ConversationView must remain).
- **Do not break:** Unread badges, unread_count display, "Mark as Read" button behavior.

## Key files (located)

| Purpose | File (absolute) |
|--------|------------------|
| Page, tabs, layout, conversation list cards | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\pages\UnifiedInboxPage.tsx` |
| Conversation panel, message bubbles | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\ConversationView.tsx` |
| People sidebar (column 1) | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\PeopleSidebar.tsx` |
| Filters API (no change; unread_only only removed from caller) | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\api\inboxConversations.api.ts` |
| Route | `src\app\router.tsx` — `Route path="inbox" element={<UnifiedInboxPage />} />` |

## Current structure (UnifiedInboxPage)
- **Tabs:** TabsList `grid-cols-5` with All, Unread, Email, SMS, WhatsApp. TabsContent shows conversation cards.
- **Filters useMemo:** `activeTab === 'unread'` → `base.unread_only = true`; else channel by tab.
- **Layout:** Outer `flex gap-0 min-h-[480px]`. PeopleSidebar (left). Then a `grid grid-cols-1 lg:grid-cols-2 gap-6` with (1) conversations list, (2) ConversationView + PersonOrdersPanel.
- **Conversation cards:** Card with CardHeader, `pb-2`, `space-x-3`, preview `text-sm text-slate-600 truncate`, badges in `gap-2 ml-9`.
- **PeopleSidebar:** `w-56 shrink-0`, `flex-1 overflow-y-auto` for list.

## Current structure (ConversationView)
- Message list container: `ref={messagesContainerRef}`, `overflow-y-auto max-h-96`; scroll via `scrollTo` (no scrollIntoView).
- Bubbles: `max-w-xs lg:max-w-md` on inner div (both inbound/outbound).

## Technical decisions
- **Tabs:** Remove Unread trigger only; keep All, Email, SMS, WhatsApp. Change grid to 4 columns.
- **Layout:** Use CSS grid `grid-cols-[180px_260px_1fr]` for the three columns (People, Conversations, Panel). PeopleSidebar currently has `w-56`; will be placed in first column (180px). Responsive: can use `min-w-0` and optionally stack on small screens (e.g. `grid-cols-1` below lg).
- **Cards:** No separate ConversationListItem; cards are inline in UnifiedInboxPage. Apply compact classes to Card/CardHeader and preview/badges.
- **Bubbles:** Single class change in ConversationView to `max-w-[75%]`.
