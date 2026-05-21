# GHL Webhook Setup — Instructions for Arin (Client)

**Audience**: GHL administrator (Sears Melvin / GoHighLevel sub-account)  
**Developer action**: Share this document at go-live; no GHL dashboard access required for dev team.

---

## 1. Webhook URL to register

Use the production Supabase Edge Function URL:

```text
https://bfwohzcugtwbhhxdqgme.supabase.co/functions/v1/ghl-webhook
```

Confirm the exact URL in Supabase Dashboard → **Edge Functions** → `ghl-webhook` → **Details**.

---

## 2. Events to subscribe

Enable webhooks for these event types (labels in GHL should match the `type` field):

| Subscribe | Event type name | Why |
|-----------|-----------------|-----|
| Yes | **InboundMessage** | New customer messages (SMS, WhatsApp, email, etc.) |
| Yes | **OutboundMessage** | Replies sent from GHL so Mason stays in sync |
| Yes | **ContactCreate** | New contacts |
| Yes | **ContactUpdate** | Contact detail changes |

You do not need opportunity, calendar, invoice, or task events for Phase 1.

**Documentation**: [HighLevel Webhook docs](https://marketplace.gohighlevel.com/docs/category/webhook)

---

## 3. Authentication / signing

Mason verifies incoming webhooks automatically. You do not need to configure anything technical on your side for normal GHL webhook delivery.

**If** GHL prompts you for a **signing secret** during webhook setup: copy it once and send it to the dev team through your usual secure channel (for example a password manager share). Otherwise leave that field **blank**.

---

## 4. Private Integration Token (scopes)

Create the token under **Settings → Private Integrations** → **Create new Integration** (sub-account / location for Sears Melvin). Copy the token once and send it securely to the dev team for server configuration (`GHL_API_KEY`).

In **Step 3 — Select scopes**, enable exactly these permission labels (wording should match the GHL UI):

| Scope label (enable) | Used for |
|----------------------|----------|
| `conversations.readonly` | List/search conversations, get conversation (unread counts) |
| `conversations/message.readonly` | Load message threads |
| `contacts.readonly` | Contact details panel |
| `conversations/message.write` | Mark messages as read |
| `conversations.write` | Clear conversation unread count (fallback) |

**Source**: Scope strings are taken from the **Requirements → Scope(s)** section on each API method in the [HighLevel API docs](https://marketplace.gohighlevel.com/docs/ghl/conversations/get-messages/) (e.g. Get messages → `conversations/message.readonly`; Update Conversation → `conversations.write`). Private Integrations uses the same scope names in the picker ([Private Integrations](https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/)).

Also provide the sub-account **Location ID** for the same location as the webhooks (`GHL_LOCATION_ID`).

---

## 5. Verification checklist (Arin)

After registration:

1. Send a test WhatsApp/SMS to the GHL number.
2. Confirm Mason **GHL Inbox** shows the message within about 10 seconds.
3. In Mason, open the thread → **Mark as read** → confirm unread clears in GHL’s own inbox too.

---

## 6. Support contact

If webhooks do not fire, check GHL webhook delivery logs (marketplace app or location settings) and share failed delivery timestamps with the dev team. Message content is not required.
