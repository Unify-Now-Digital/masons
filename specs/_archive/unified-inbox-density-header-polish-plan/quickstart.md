# Quickstart: Unified Inbox Density & Header Polish

## Branch
`feature/unified-inbox-density-header-polish`

## Spec
`c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-density-header-polish.md`

## Run app
```bash
npm install
npm run dev
```
Navigate to **Unified Inbox** (e.g. `/dashboard/inbox`).

## Verify (manual QA)
1. **Tabs:** Segmented control style; full width; active tab clear; no layout shift on switch.
2. **Conversation list:** Rows denser; smaller fonts; single-line preview; hover and selected states clear.
3. **Conversation header:** Compact row; avatar + primary + secondary; status pill (Not linked/Linked/Ambiguous); action button aligned; sticky within panel; no page scroll jump.
4. **Build:** `npm run build` and lint pass.

## Files to edit
- `src/modules/inbox/pages/UnifiedInboxPage.tsx` — tabs (segmented), conversation list row (density)
- `src/modules/inbox/components/ConversationView.tsx` — header redesign (compact row, pill, sticky)
