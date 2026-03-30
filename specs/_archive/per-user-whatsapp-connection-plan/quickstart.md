# Quickstart: Per-user WhatsApp connection

## Prerequisites

- Supabase project; migrations applied (whatsapp_connections, inbox_messages.whatsapp_connection_id).
- Env secret for encryption: e.g. `WHATSAPP_SECRET_ENCRYPTION_KEY` (32-byte base64) if using app-level encryption; or Vault configured if using pgsodium.
- Twilio: each user has (or will add) their own Account SID, API Key SID, API Key Secret, and WhatsApp From number (Sandbox or production).

## Deploy order

1. Run migrations (create whatsapp_connections, add whatsapp_connection_id to inbox_messages).
2. Set Edge Function secrets: encryption key; keep SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
3. Deploy Edge Functions: twilio-sms-webhook (updated), inbox-twilio-send (updated), whatsapp-connect, whatsapp-test (optional).
4. Twilio: point webhook URL to `https://<PROJECT_REF>.supabase.co/functions/v1/twilio-sms-webhook` (unchanged).
5. Frontend: build with new WhatsApp components and hooks; ensure JWT is sent when calling inbox-twilio-send.

## Rollout

- **Sandbox first:** Users connect Twilio Sandbox credentials in Profile; send/receive via Sandbox number.
- **Production:** Users replace with production WhatsApp-enabled number (same Replace flow); no schema change. Rotate encryption key only with re-encrypt of all rows (document procedure).

## Backfill (optional)

If legacy conversations (user_id NULL) should be visible to a designated user: run one-off update setting user_id to that user’s id for matching channel/conversations. Document in migration or runbook.
