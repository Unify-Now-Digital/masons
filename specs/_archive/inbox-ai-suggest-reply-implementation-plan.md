# Implementation Plan: AI Suggested Reply for Unified Inbox

## Input spec
`c:\Users\owner\Desktop\unify-memorial-mason-main\specs\inbox-ai-suggest-reply.md`

## Plan artifacts (absolute paths)

| Artifact | Path |
|----------|------|
| Research | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\inbox-ai-suggest-reply-plan\research.md` |
| Data model | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\inbox-ai-suggest-reply-plan\data-model.md` |
| Contract | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\inbox-ai-suggest-reply-plan\contracts\edge-function-inbox-ai-suggest-reply.md` |
| Tasks | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\inbox-ai-suggest-reply-plan\tasks.md` |
| Quickstart | `c:\Users\owner\Desktop\unify-memorial-mason-main\specs\inbox-ai-suggest-reply-plan\quickstart.md` |

## Hard decisions (locked in)
- Provider: OpenAI Responses API from Edge Function; model: gpt-4o-mini.
- Input: last inbound message only; output: one suggestion string.
- Cache: DB table `inbox_ai_suggestions` unique(message_id).
- Auth: Edge Function requires Supabase auth; use service role inside function.
- Trigger: auto on selected conversation / last inbound message change; no manual button.

## Implementation order
1. **DB** — Migration for `inbox_ai_suggestions` + RLS.
2. **Edge Function** — `inbox-ai-suggest-reply`: request `{ message_id }`, validate inbound, cache lookup, OpenAI call, store + return.
3. **Frontend** — Hook `useSuggestedReply(messageId)`, invoke via `supabase.functions.invoke`; chip above composer in `ConversationThread`, click inserts into `replyText`; loading + error states.
4. **Testing** — Per tasks.md Phase 4 (migration, function contract, UI, stability).

## Branch
`feature/inbox-ai-suggest-reply`

## Progress
- [x] Phase 0: research, data-model, contracts
- [x] Phase 1: tasks + quickstart
- [ ] Phase 2: implementation (follow tasks.md)
- [ ] Phase 3: testing and acceptance
