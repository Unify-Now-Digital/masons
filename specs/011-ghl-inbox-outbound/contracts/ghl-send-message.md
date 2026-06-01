# Contract: `ghl-send-message` Edge Function

## Purpose

Phase 2 **outbound send** to GoHighLevel: deliver a plain-text reply on the conversation's existing channel. Single write path besides existing `ghl-mark-read`. PIT never exposed to browser.

## Transport

- **Method**: `POST`
- **URL**: `{SUPABASE_URL}/functions/v1/ghl-send-message`
- **Auth**: `Authorization: Bearer <supabase_jwt>` (JWT verification **enabled** — do not deploy with `--no-verify-jwt`)

## Request

```json
{
  "organizationId": "uuid",
  "contactId": "string",
  "conversationId": "string",
  "type": "SMS",
  "message": "Hello, your proof is ready for review.",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Required | Validation |
|-------|----------|------------|
| `organizationId` | Yes | UUID; caller must be org member (`requireOrgMember`) |
| `contactId` | Yes | Non-empty GHL contact id |
| `conversationId` | Yes | Non-empty GHL conversation id |
| `type` | Yes | One of `SMS`, `Email`, `WhatsApp`, `IG`, `FB`, `Live_Chat` — client-derived, not user-picked |
| `message` | Yes | Non-empty after trim; max length TBD at implementation (suggest 4096) |
| `requestId` | Yes | UUID v4; unique per send attempt; used for idempotency |

## Server behaviour (ordered)

1. Authenticate JWT → verify org membership.
2. Validate body fields; reject whitespace-only `message` → **400**.
3. Load active connection via `getActiveGhlConnectionWithKey(organizationId)`.
   - No connection → **404** `{ ok: false, error: 'No GHL connection' }`
   - `outbound_enabled = false` → **403** `{ ok: false, error: 'Outbound messaging is not enabled for this organisation' }`
4. **Idempotency** (table `ghl_send_idempotency`):
   - New `request_id` → insert `pending` row; proceed.
   - Existing `completed` → return cached success (same `messageId`) without GHL call.
   - Existing `pending` (&lt;60s) → **409** `{ ok: false, error: 'Send already in progress' }`.
   - Existing `failed` → **409** `{ ok: false, error: 'Request already used; start a new send' }` (client must generate new `requestId`).
5. Call GHL upstream (see below).
6. On GHL success → update row `completed`, set `ghl_message_id`, return success JSON.
7. On GHL failure → update row `failed`, set `error_message`, return error JSON with GHL details.

## GHL upstream call

```
POST https://services.leadconnectorhq.com/conversations/messages
Authorization: Bearer {decrypted PIT}
Version: 2021-07-28          ← confirm in Gate G2; fallback 2021-04-15 if required
Accept: application/json
Content-Type: application/json
```

**Body** (locked after Gate G2 smoke test):

```json
{
  "type": "SMS",
  "contactId": "abc123",
  "conversationId": "conv456",
  "message": "Hello",
  "status": "pending"
}
```

| Item | Detail |
|------|--------|
| **Scope** | `conversations/message.write` |
| **Version header** | `2021-07-28` via `ghlFetch()` — **verify in G2**; fallback `2021-04-15` if GHL rejects |
| **Doc** | [Send a new message](https://marketplace.gohighlevel.com/docs/ghl/conversations/send-a-new-message) |
| **Omit** | `userId` (org-default sender voice) |
| **Implementation** | `supabase/functions/ghl-send-message/index.ts` |

### GHL success response (typical 200)

```json
{
  "conversationId": "ABC12h2F6uBrIkfXYazb",
  "messageId": "t22c6DQcTDf3MjRhwf77"
}
```

## Response 200

```json
{
  "ok": true,
  "messageId": "t22c6DQcTDf3MjRhwf77",
  "conversationId": "ABC12h2F6uBrIkfXYazb",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Error responses

| HTTP | Condition | Example body |
|------|-----------|----------------|
| 400 | Invalid JSON, missing fields, empty message | `{ "ok": false, "error": "message is required" }` |
| 401 | Missing/invalid JWT | `{ "ok": false, "error": "Unauthorized" }` |
| 403 | Not org member or outbound disabled | `{ "ok": false, "error": "Forbidden" }` or outbound message |
| 404 | No active GHL connection | `{ "ok": false, "error": "No GHL connection" }` |
| 409 | Duplicate in-flight or reused failed requestId | `{ "ok": false, "error": "Send already in progress" }` |
| 502 | GHL unreachable | `{ "ok": false, "error": "GHL API error", "ghlStatus": 502 }` |
| 4xx/5xx | GHL rejection (incl. WhatsApp window) | `{ "ok": false, "error": "…", "ghlStatus": 400, "ghlMessage": "…" }` |

Do not leak PIT or encryption key in any response.

## Client behaviour (React Query)

**Hook**: `useGhlSendMessage`

```typescript
// Per attempt
const requestId = crypto.randomUUID();

mutationFn: (input) =>
  sendGhlMessage({ ...input, organizationId, requestId });

onMutate: () => {
  // disable send via isPending
  // optimistic append outbound bubble
};

onSuccess: (_data, variables) => {
  queryClient.invalidateQueries({ queryKey: ghlInboxKeys.messages(orgId, conversationId) });
  queryClient.invalidateQueries({ queryKey: ghlInboxKeys.conversations(orgId) });
};

onError: () => {
  // preserve composer draft (do not clear textarea)
  // show error toast/banner with ghlMessage when present
};
```

**Composer rules**:

- Generate **new** `requestId` on each Send click (including retry after error).
- Disable Send button while `isPending`.
- Do not call send when `!outbound_enabled` or channel type unknown.

## Idempotency guarantees

| Scenario | Expected behaviour |
|----------|-------------------|
| Double-click Send | Second click blocked by `isPending`; if two requests race, second insert conflicts → 409 or returns cached completed |
| Retry after network timeout | Same `requestId` if still `pending` → 409; user clicks Send again → **new** `requestId` |
| Retry after definitive failure | Must use **new** `requestId` |
| Successful send + user sends another message | New `requestId` → new GHL message |

## CORS

Same headers as `ghl-fetch` / `ghl-mark-read`:

```typescript
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Methods': 'POST, OPTIONS',
'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
```

## Deploy

```bash
npx supabase functions deploy ghl-send-message --project-ref bfwohzcugtwbhhxdqgme
```

**Not** `--no-verify-jwt`.

## Related contracts

- [ghl-fetch.md](../../009-ghl-inbox-readonly/contracts/ghl-fetch.md) — thread re-fetch after send
- [ghl-mark-read.md](../../009-ghl-inbox-readonly/contracts/ghl-mark-read.md) — pattern reference for Edge structure
- [ghl-credentials.md](../../010-ghl-multi-org/contracts/ghl-credentials.md) — PIT encryption
