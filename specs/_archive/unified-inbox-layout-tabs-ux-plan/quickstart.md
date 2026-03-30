# Quickstart: Unified Inbox Layout & Tabs UX Update

## Branch
`feature/unified-inbox-layout-tabs-ux`

## Spec
`c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-layout-tabs-ux.md`

## Run app
```bash
npm install
npm run dev
```
Navigate to **Unified Inbox** (e.g. `/dashboard/inbox`).

## Verify (manual QA)
1. **Tabs:** Unread tab is gone; All / Email / SMS / WhatsApp work; unread badges and "Mark as Read" still work.
2. **Layout:** People ~180px, Conversations ~260px, conversation panel uses remaining width; no page scroll jump when switching conversations.
3. **Cards:** Denser; preview one line; smaller badges; selected state visible.
4. **Bubbles:** Capped at ~75% width in conversation panel.
5. **Build:** `npm run build` and `npm run lint` pass.

## Files to edit (summary)
- `src/modules/inbox/pages/UnifiedInboxPage.tsx` — tabs, filters, layout grid, card styles
- `src/modules/inbox/components/ConversationView.tsx` — bubble `max-w-[75%]`
- `src/modules/inbox/components/PeopleSidebar.tsx` — optional width alignment (column width controlled by parent grid)
