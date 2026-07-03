# Contract: `gmail-send-first-message` (edge function)

Send the **first** email in a conversation that has no prior email message, from the org's mailbox.
Same auth/scoping model as `gmail-send-reply`; differs only in that there is no existing Gmail thread
to reply into (new thread, no `In-Reply-To`).

## Request

`POST` (JWT required). Body: `{ conversation_id: string, message_body: string, subject?: string }`
(**VERIFY** exact body shape against the function during implementation.)

## Behaviour (changes from current)

Identical org-scoping changes to `gmail-send-reply`:

1. Import from `../_shared/auth.ts` and `../_shared/organizationMembership.ts` (**FR-014**).
2. Fetch conversation by `.eq('id', id)` **only** — drop `.eq('user_id', …)`; `orgId =
   conversation.organization_id`.
3. **Keep** `isUserInOrganization(supabase, userId, orgId)` caller guard.
4. Resolve connection by `.eq('organization_id', orgId).eq('status','active')` — drop `user_id`.
5. `From:` = `connection.email_address` (org mailbox). Compose a new message (no `threadId` /
   `In-Reply-To`); on send, persist `meta.gmail.{messageId,threadId}` and set the conversation's
   `external_thread_id` from the Gmail response if not already set.
6. Outbound insert stamps `organization_id` (from conversation) + `user_id` (acting caller) +
   `gmail_connection_id`.
7. Token failure `invalid_grant` → set connection `status='revoked'` then 502 (**FR-016**).

## Responses

Same set as `gmail-send-reply` (`200/400/401/404/500/502`), with no "no Gmail thread" 400 (this
function creates the first message).

## Acceptance

- Non-owner org member starts a first email successfully (**FR-003/004/005/006**, spec US1 scenario 3).
- No cross-tenant connection use (**FR-013**, **SC-003**).
- Bundles/deploys cleanly (**FR-014**, **SC-006**).
