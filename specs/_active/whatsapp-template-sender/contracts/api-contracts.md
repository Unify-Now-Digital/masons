# API Contracts: WhatsApp Template Sender

---

## 1) Frontend to Edge Function: `inbox-twilio-send`

Endpoint: `POST /functions/v1/inbox-twilio-send`  
Auth: Supabase JWT (existing behavior)

### Freeform request (existing)

```json
{
  "conversation_id": "uuid",
  "body_text": "Hello from staff"
}
```

### Template request (new additive mode)

```json
{
  "conversation_id": "uuid",
  "contentSid": "HX25cf06b0dd3b3c5f8223bc104ae2bca1",
  "contentVariables": {
    "1": "Customer Name",
    "2": "staff@example.com",
    "3": "Order #1234"
  },
  "body_text": "Rendered template text for inbox timeline"
}
```

### Success response (unchanged shape)

```json
{
  "success": true,
  "message_id": "uuid",
  "twilio_sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### Error response (existing style)

```json
{
  "error": "Failed to send message via Twilio"
}
```

or managed status structured errors:

```json
{
  "error": "managed_whatsapp_not_ready",
  "status": "connected",
  "status_reason_code": "managed_provider_credentials_missing",
  "status_reason_message": "Managed provider credentials are not configured.",
  "action_required": true
}
```

---

## 2) Template List Fetch Contract (Frontend Consumption)

Source: Server-mediated edge function `fetch-whatsapp-templates` (the edge function calls Twilio Content API).  
Selector behavior: fetch live on each open and expose approved templates only.

Required normalized fields for UI:

```ts
{
  sid: string;
  friendlyName: string;
  status: string;
  body: string;
  variables: string[];
}
```

Required-variable rule:
- Required variables are all `{{N}}` placeholders found in `body`.
- Frontend must block send if any required placeholder maps to empty/whitespace-only value.

---

## 3) Backward Compatibility Rules

- Existing freeform request (`conversation_id` + `body_text`) must remain valid.
- Email and SMS edge function paths are out of scope and unchanged.
- No schema migration or new table is required for this contract.
