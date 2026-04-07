# API Contracts: Shared WhatsApp UI and Sender Identity

---

## 1) Edge Function Persistence Contract (`inbox-twilio-send`)

Endpoint: `POST /functions/v1/inbox-twilio-send`  
Auth: Supabase JWT (existing behavior)

Request contract is unchanged for WhatsApp sends (freeform/template already supported).

### New persistence requirement (outbound WhatsApp only)

When an outbound WhatsApp message is inserted into `inbox_messages`, `meta` must include:

```json
{
  "sender_email": "staff@example.com"
}
```

alongside any existing metadata fields (e.g. Twilio/provider details).

### Compatibility rules

- No request/response shape changes required for frontend callers.
- Email and SMS edge functions are unchanged and out of scope.
- No schema migration/table changes.

---

## 2) Error Handling Contract

- Existing `inbox-twilio-send` error response shapes remain unchanged.
- Sender metadata write must be additive; failure behavior follows existing insert error handling.
