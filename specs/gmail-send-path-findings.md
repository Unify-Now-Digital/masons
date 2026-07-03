# Email reply path — findings (2026-07-03)

## 1. Reply composer UI

The reply UI lives in src/modules/inbox/components/ConversationThread.tsx (component ConversationThread, line 687). It renders the message list and the composer: textarea "Type your reply..." (line 1524, Enter-to-send 1530), Send button (line 1627) → handleSendReply (1124) → sendReplyMutation. Parent: ConversationView.tsx (line 57) renders <ConversationThread readOnly={false}> at line 306.

## 2. Reachability — fully wired and live

router.tsx:72 /dashboard/inbox → UnifiedInboxPage → ConversationView.tsx:306 → ConversationThread composer → Send → handleSendReply → sendReplyMutation → useSendReply (useInboxMessages.ts:199) → email: sendGmailFirstMessage (228) or sendGmailReply (234) → fetch(.../gmail-send-reply) (inboxGmail.api.ts:84). A user viewing an email conversation can type and send a real Gmail reply.

## 3. Edge functions the UI invokes

Gmail send uses raw fetch() to ${VITE_SUPABASE_FUNCTIONS_URL}/<fn> with a user JWT bearer (not supabase.functions.invoke). All in src/modules/inbox/api/inboxGmail.api.ts:

| Function | Frontend reference |
|---|---|
| gmail-send-reply | YES — inboxGmail.api.ts:84 (existing threads) |
| gmail-send-first-message | YES — inboxGmail.api.ts:125 (first email in convo) |
| inbox-gmail-send | NO — not found in src/ (dead string; verify no HTTP callers before delete) |

## 4. Credential resolution & org-scoping per function

| Function | Auth model | Token source | Lookup scope | org stamped | user_id stamped |
|---|---|---|---|---|---|
| gmail-send-reply (live) | user JWT | gmail_connections.refresh_token | user_id + active | yes, validated | yes |
| gmail-send-first-message (live) | user JWT | gmail_connections.refresh_token | user_id + active | yes, validated | yes |
| gmail-sync-now | user JWT | gmail_connections.refresh_token | user_id + active | yes | yes |
| inbox-gmail-send (not wired) | shared INBOX_ADMIN_TOKEN | gmail_connections.refresh_token | newest active row platform-wide, unscoped | yes (from convo) | no |
| inbox-gmail-new-thread | shared admin token | env GMAIL_REFRESH_TOKEN | env email → 1 connection | yes | yes |
| inbox-gmail-sync | shared admin token | env GMAIL_REFRESH_TOKEN | env email → 1 connection | partial | no (messages) |
| gmail-sync (legacy) | user JWT (RLS) | gmail_accounts.refresh_token | user_id + active | none | n/a |

Detail on the live path: getUserFromRequest reads Bearer, supabase.auth.getUser(token) with anon key (_shared/auth.ts:22); service-role only after userId established. Reads gmail_connections (refresh_token, email_address, organization_id) by user_id + status='active'. Org: conversation.organization_id ?? resolveOrganizationIdForUser, enforced via isUserInOrganization; rejects if connection.organization_id !== orgId. Conversation fetched scoped by id + user_id. Insert stamps organization_id and user_id on inbox_messages.

## 5. Exact ownership filters (root cause of SM send failure)

Both send functions fetch the conversation with .eq('id', conversationId).eq('user_id', userId) — gmail-send-first-message lines 88–93, gmail-send-reply lines 73–78. For an org member who is not the conversation's user_id owner, this returns zero rows → HTTP 404 {"error":"Conversation not found"}. The later org-membership and connection-org-mismatch guards (110–121, 173–187) emit the identical error string. Connection lookup is also per-user: .eq('user_id', userId).eq('status','active') (gmail-send-reply additionally prefers a prior message's gmail_connection_id, still user-scoped). Net effect: sending in an org requires the sender to have personally connected a mailbox in that org.

## 6. config.toml / verify_jwt

No [functions.*] block for any Gmail function — all inherit verify_jwt = true (any signed project JWT passes; real authorization is in-function).

## 7. Key flags

1. inbox-gmail-send: unscoped platform-wide connection pick, shared-token auth, no user_id stamp — cross-tenant send risk; unreferenced in src/ but verify no HTTP callers (GHL/cron) before deletion.
2. inbox-gmail-new-thread / inbox-gmail-sync: hard-wired single mailbox via env GMAIL_REFRESH_TOKEN/GMAIL_USER_EMAIL; inbox-gmail-sync thread-matching not org-scoped, omits user_id on messages.
3. gmail-sync (legacy gmail_accounts/gmail_emails schema): stamps no organization_id.
4. Import drift: gmail-send-reply, gmail-send-first-message, gmail-sync-now import ./auth.ts, ./organizationMembership.ts, ./gmailBody.ts, ./autoLinkConversation.ts which do not exist in their directories (real files in _shared/) — unbundleable/undeployable as committed; deployed versions predate repo state. Same fix as inbox-twilio-send commit 6c59aa1.
