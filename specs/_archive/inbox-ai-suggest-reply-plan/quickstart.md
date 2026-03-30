# Quickstart: AI Suggested Reply

## Branch
`feature/inbox-ai-suggest-reply`

## Spec
`specs/inbox-ai-suggest-reply.md`

## Run
```bash
npm install
npm run dev
```
Go to Unified Inbox, select a conversation with at least one inbound message.

## Prerequisites
- Edge Function `inbox-ai-suggest-reply` deployed; `OPENAI_API_KEY` set in Supabase.

## Verify
1. Suggestion chip appears above reply box (or error).
2. Click chip to fill composer; edit and send.
3. Switch conversation to see suggestion for that thread.
4. No scroll or auto-read regressions.

## Files
- Migration: `supabase/migrations/` create inbox_ai_suggestions.
- Edge Function: `supabase/functions/inbox-ai-suggest-reply/index.ts`.
- Frontend: hook useSuggestedReply, ConversationThread chip.
