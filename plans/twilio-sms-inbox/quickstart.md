# Twilio SMS Inbox — Setup & Quickstart

**Spec:** `specs/implement twilio sms integration for unified inbox - inbound outbound.md`  
**Tasks:** `plans/twilio-sms-inbox/tasks.md`

---

## 1. Supabase secrets

Set (or verify) in your Supabase project:

```bash
supabase secrets set INBOX_ADMIN_TOKEN=your-token
supabase secrets set TWILIO_ACCOUNT_SID=AC...
supabase secrets set TWILIO_AUTH_TOKEN=...
supabase secrets set TWILIO_PHONE_NUMBER=+44...
```

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: usually pre-populated.

---

## 2. Twilio Console — Inbound SMS webhook

1. [Twilio Console](https://console.twilio.com) → **Phone Numbers** → select your number.
2. Under **Messaging**, set **A MESSAGE COMES IN**:
   - **Webhook URL:** `https://<PROJECT_REF>.supabase.co/functions/v1/twilio-sms-webhook`
   - **HTTP:** `POST`

---

## 3. Frontend env

In `.env`:

```
VITE_SUPABASE_FUNCTIONS_URL=https://<PROJECT_REF>.supabase.co/functions/v1
VITE_INBOX_ADMIN_TOKEN=<same as INBOX_ADMIN_TOKEN>
```

Restart Vite after changing any `VITE_*` vars.

---

## 4. Migrations & deploy

```bash
supabase db push
supabase functions deploy twilio-sms-webhook
supabase functions deploy inbox-sms-send
```

---

## 5. Local dev / testing

1. Run migrations (`supabase db push` or equivalent).
2. Set secrets; run `supabase functions serve twilio-sms-webhook inbox-sms-send` (or deploy).
3. **Inbound:** Send an SMS to your Twilio number. Confirm webhook creates a conversation and inbound message in the app (Unified Inbox).
4. **Outbound:** Open an SMS conversation, send a reply. Confirm it goes through `inbox-sms-send` and Twilio.
5. **Optional:** Use [ngrok](https://ngrok.com) (or similar) to expose your local webhook URL for Twilio during dev.

---

## Troubleshooting

- **Webhook 404:** Ensure `twilio-sms-webhook` is deployed and the URL matches Twilio config.
- **401 on send:** Check `X-Admin-Token` and `VITE_INBOX_ADMIN_TOKEN` match `INBOX_ADMIN_TOKEN`.
- **Duplicate messages:** Idempotency uses `external_message_id` (`twilio:MessageSid`). If duplicates appear, check migration and index.
