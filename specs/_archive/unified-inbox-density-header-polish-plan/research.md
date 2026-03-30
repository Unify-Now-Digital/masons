# Research: Unified Inbox — Density & Header Polish

## Guardrails
- **UI-only:** Styling/layout polish. No DB/API/query/logic changes.
- **Preserve:** Unread badge/count and Mark as Read behavior; scroll behavior (message list scroll only; no page jump).
- **No new features:** Visual polish only (no keyboard nav, search changes, etc.).

## Files to edit (concrete paths)

| Purpose | Absolute path |
|--------|----------------|
| Inbox page: tabs, conversation list rows | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\pages\UnifiedInboxPage.tsx` |
| Conversation header, message panel container (sticky header) | `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\inbox\components\ConversationView.tsx` |

**Route:** `src/app/router.tsx` — `Route path="inbox" element={<UnifiedInboxPage />} />` (no changes needed).

## Current implementation (reference)
- **Tabs:** UnifiedInboxPage — `Tabs`, `TabsList className="grid w-full grid-cols-4"`, `TabsTrigger` for all/email/sms/whatsapp.
- **Conversation list:** Same file — `Card` + `CardHeader className="p-2.5 pb-2"`, preview `line-clamp-1`, badges `text-xs px-2 py-0.5`, selected `ring-2 ring-blue-500`.
- **Conversation header:** ConversationView — Card with avatar, CardTitle, subject; separate banner when unlinked/ambiguous (`bg-amber-50`); "Link person" / "Choose person" / "Change link" buttons. Message list uses `messagesContainerRef` and `scrollTo` (no scrollIntoView).

## Technical decisions
- **Tabs:** Restyle TabsList/TabsTrigger to segmented control (container `bg-muted/40 p-1 rounded-lg`, tabs `h-8 text-xs font-medium`, active `bg-background shadow-sm`). Keep same `activeTab` state and filter logic.
- **List rows:** Keep Card or switch to div; apply `p-2`, `rounded-md`, `gap-1.5`, smaller typography and badges, `hover:bg-muted/30`, selected `bg-muted/50` and/or `ring-1 ring-primary/30`, optional `border-l-2 border-l-primary`.
- **Header:** Single compact row: avatar (h-8 w-8) + primary + secondary + status pill + action; remove full-width banner; add `sticky top-0 z-10 bg-background` on the header wrapper inside the conversation panel (so only the panel content scrolls, not the page).
