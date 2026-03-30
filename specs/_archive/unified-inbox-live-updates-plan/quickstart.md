# Quickstart: Unified Inbox Live Updates

## Branch
`feature/unified-inbox-live-updates`

## Spec
`c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-live-updates.md`

## Run app
```bash
npm install
npm run dev
```
Navigate to **Unified Inbox** (`/dashboard/inbox`).

## Realtime (inbox_messages)

If new SMS/WhatsApp messages do not appear without refresh, enable Realtime for `inbox_messages` in the Supabase Dashboard: **Database → Replication** (or **Realtime**), then add the `inbox_messages` table to the publication used by Realtime (e.g. `supabase_realtime`). The app subscribes to `INSERT` on `public.inbox_messages` and invalidates the conversation list and open thread.

## Gmail 60s sync

- **Strategy A (preferred):** Supabase (or external) cron invokes `inbox-gmail-sync` every 60 seconds. No button; document the schedule (e.g. `*/1 * * * *`) and endpoint in this doc or README.
- **Strategy B:** Client polls every 60s while the inbox page is open; "Sync Email" button is removed.

## Verify (manual QA)

1. **Realtime (SMS/WhatsApp):** Send an inbound message via Twilio → conversation list and open conversation update without refresh.
2. **Gmail:** New email appears within ~60s (cron or client polling); no Sync Email button.
3. **Scroll:** No regressions; scroll guard and auto-read behavior unchanged.
4. **No duplicates:** Same external_message_id does not create duplicate messages.
5. **Build:** `npm run build` and `npm run lint` pass.

## Files to edit (summary)

- `src/modules/inbox/pages/UnifiedInboxPage.tsx` — Realtime subscription (single, page-level), debounced invalidation; remove Sync button; optional 60s polling.
- Optional: `src/modules/inbox/hooks/useInboxConversations.ts` — invalidate messages for selected conversation after Gmail sync.
- Optional: migration for Realtime publication and/or unique constraint on `inbox_messages.external_message_id`.
