# Contract: `gmail-send-reply` (edge function)

Send a reply on an existing email conversation from the **org's** connected mailbox. Any member of
the conversation's org may send. Runs with the **service-role** client (bypasses RLS → enforce
`organization_id` in code).

## Request

`POST` (JWT required; `verify_jwt=true` inherited — no `[functions.*]` block).
Body: `{ conversation_id: string, message_body: string, subject?: string }`

## Preconditions / auth

1. `getUserFromRequest(req)` → `user`; 401 if none. **(import from `../_shared/auth.ts`)**
2. Validate `conversation_id` + non-empty `message_body` → 400.

## Behaviour (changes from current)

| Step | Current | Required |
|---|---|---|
| Fetch conversation | `.eq('id', id).eq('user_id', userId)` | `.eq('id', id)` **only**; select `organization_id, channel, primary_handle, subject, external_thread_id` |
| Derive org | `conversation.organization_id ?? resolveOrganizationIdForUser(...)` | `orgId = conversation.organization_id`; 404 if conversation missing |
| Caller guard | `isUserInOrganization(supabase, userId, orgId)` | **KEEP** — 404/403 if caller not a member |
| Channel check | `channel==='email'` else 400 | unchanged |
| Message history (threadId) | `.eq('conversation_id', id).eq('user_id', userId)` | drop `user_id`; scope by `conversation_id` + `channel='email'` |
| Connection lookup | `.eq('user_id', userId).eq('status','active')` (+ per-message hint) | `.eq('organization_id', orgId).eq('status','active')`; **drop** `user_id`. Drop the `preferredConnectionId` hint (single active org row is unambiguous) — see research D4.3 |
| Org-mismatch guard | `connection.organization_id !== orgId → 404` | redundant once resolved by org, but harmless to keep |
| Sender identity | `From: connection.email_address` | unchanged (the org mailbox) |
| Outbound insert | stamps `user_id, organization_id, gmail_connection_id` | unchanged; `user_id` = acting caller (audit) |

## Token failure (FR-016)

On Google token refresh: if HTTP 400 and body `error==='invalid_grant'` → set the org connection
`status='revoked'` (existing enum) then return 502. Transient (5xx/network) → 502 without status
change. No retries.

## Responses

- `200 { ok: true, message_id }`
- `400` invalid body / not an email channel / no Gmail thread
- `401` unauthorized
- `404` conversation not found / caller not a member of the conversation's org
- `404/500` no active connection for the org (clear, org-scoped — never fall back cross-tenant)
- `502` Gmail auth/send failure

## Acceptance

- A member who is **not** `user_id` owner sends successfully (was 404). Maps **FR-003/004/005/006**,
  **SC-001**.
- Org A send never uses Org B's connection (**FR-013**, **SC-003**).
- Imports resolve from `../_shared/` (**FR-014**, **SC-006**).
