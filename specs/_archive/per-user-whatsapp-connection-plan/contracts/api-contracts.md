# API contracts: WhatsApp connection and send

## 1. Connect / validate (Edge Function)

**Function name (example):** `whatsapp-connect` or `whatsapp-validate`.

**Request:** POST, JSON body. Caller: authenticated user (JWT in Authorization header).

```json
{
  "twilio_account_sid": "AC...",
  "twilio_api_key_sid": "SK...",
  "twilio_api_key_secret": "plaintext secret — never logged or stored unencrypted",
  "whatsapp_from": "+44..." or "whatsapp:+44..."
}
```

**Success (200):** Validate with Twilio (e.g. balance or test); encrypt secret; insert or update `whatsapp_connections` for auth.uid(); return e.g. `{ "ok": true, "id": "uuid", "status": "active" }`.

**Errors:** 400 invalid body/format; 401 no JWT; 402/502 Twilio validation failed (e.g. invalid credentials) — set status = 'error', last_error, return 4xx/5xx with message.

---

## 2. Disconnect

**Option A – Client update:** PATCH/update `whatsapp_connections` set status = 'disconnected', disconnected_at = now() where user_id = auth.uid() and id = :id. RLS allows. No Edge Function required.

**Option B – Edge Function:** POST to `whatsapp-disconnect` with optional connection id; service role or same user; set status and disconnected_at.

---

## 3. Test (optional Edge Function)

**Function name (example):** `whatsapp-test`.

**Request:** POST, optional body `{ "to": "whatsapp:+44..." }` or use a fixed test number. JWT required.

**Behavior:** Load user’s active connection; decrypt secret; send one test message via Twilio; update last_validated_at on success. Return 200 { "ok": true } or error with message.

---

## 4. Inbound webhook (twilio-sms-webhook)

**Request:** POST, application/x-www-form-urlencoded (Twilio). Params: MessageSid, AccountSid, From, To, Body, NumMedia, etc.

**Behavior:** Lookup (AccountSid, normalized To) in whatsapp_connections where status = 'active'. If no row: return 200 empty TwiML (no new conversation). If row: get user_id; find or create conversation with that user_id; insert message with user_id and whatsapp_connection_id; run attemptAutoLink (customers.id only). Return 200 TwiML.

---

## 5. Outbound send (inbox-twilio-send)

**Request:** POST, JSON. Headers: Authorization: Bearer &lt;JWT&gt; (required for per-user). Body: `{ "conversation_id": "uuid", "body_text": "..." }`.

**Behavior:** Resolve auth.uid() from JWT. Load conversation; enforce conversation.user_id = auth.uid(). Load whatsapp_connections where user_id = auth.uid() and status = 'active'. Decrypt secret; send via Twilio from connection.whatsapp_from. Insert outbound inbox_message with user_id and whatsapp_connection_id.

**Errors:** 400 missing/invalid body; 401 no/invalid JWT; 403 no active connection; 404 conversation not found or not owned; 502 Twilio API failure.
