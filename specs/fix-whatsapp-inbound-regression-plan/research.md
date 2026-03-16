# Fix WhatsApp Inbound Regression — Research

**Spec:** `specs/fix-whatsapp-inbound-regression.md`

## Summary

- **Bug:** Inbound WhatsApp messages do not appear in Inbox when the customer messages first (no existing conversation). They do appear when the conversation was started from the web first.
- **Cause:** In `twilio-sms-webhook`, the `whatsapp_connections` lookup uses exact string match of Twilio’s `To` to `whatsapp_from`. Format differences (e.g. `whatsapp:44987654321` vs `whatsapp:+44987654321`) cause no match → webhook returns 200 without creating conversation or message.
- **Fix direction:** Normalize both sides for comparison (e.g. strip `whatsapp:` and trim) when resolving the connection for WhatsApp only; leave SMS and conversation identity unchanged.

## Key code references

- Connection lookup: `supabase/functions/twilio-sms-webhook/index.ts` lines 61–78.
- `normalizeHandle`: same file, strips `whatsapp:` and trim; reuse for connection match.
- Shared auto-link: `supabase/functions/_shared/autoLinkConversation.ts`; webhook must import via `../_shared/autoLinkConversation.ts`.
