# Implementation Plan: Unified Inbox Live Updates

## Input spec
`specs/unified-inbox-live-updates.md`

## Plan artifacts (all paths absolute)

| Artifact | Path |
|----------|------|
| Research | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-live-updates-plan\research.md` |
| Data model | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-live-updates-plan\data-model.md` |
| Tasks | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-live-updates-plan\tasks.md` |
| Quickstart | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\unified-inbox-live-updates-plan\quickstart.md` |

## Summary

- **Realtime:** Single subscription at `UnifiedInboxPage` to `public.inbox_messages` INSERT (filter by `company_id` or `org_id` if column exists; else RLS only). Handler **only invalidates** React Query; **debounce** 300–500 ms. Keys: `inboxKeys.conversations.all`, `inboxKeys.messages.byConversation(conversationId)`.
- **Gmail:** (A) Supabase scheduled Edge Function every 60s, or (B) client 60s polling. Remove "Sync Email" button.
- **SQL:** Enable Realtime for `inbox_messages`; ensure unique index on `external_message_id`.
- **Constraints:** Subscribe once at page level; no state patch; preserve scroll guard and auto-read logic.

## Progress

- [x] Phase 0: research + data model
- [x] Phase 1: tasks + quickstart
- [ ] Phase 2: implementation (follow tasks.md)
- [ ] Phase 3: test checklist (see tasks.md Phase 4)

## Branch
`feature/unified-inbox-live-updates`
