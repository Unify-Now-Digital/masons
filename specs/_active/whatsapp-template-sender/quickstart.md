# Quickstart: Verify WhatsApp Template Sender

Run `npm run dev` and ensure Supabase functions are deployed before testing.

---

## Prerequisites

1. User is signed in and has WhatsApp conversation access.
2. WhatsApp send path works in current freeform mode.
3. At least one approved Twilio template exists (e.g., `order_update`).
4. `inbox-twilio-send` deployment includes additive template payload support.

---

## Scenario 1: Freeform Send Regression Check

1. Open Inbox and select a WhatsApp conversation.
2. Keep mode as Freeform.
3. Send a normal text message.
4. **Expected**: Send succeeds exactly as before; outbound message appears in timeline.

---

## Scenario 2: Template Mode Visibility

1. In a WhatsApp conversation, open reply composer.
2. **Expected**: Mode toggle (Freeform/Template) is visible.
3. Switch to email/sms channel context.
4. **Expected**: Template controls are hidden; freeform composer remains.

---

## Scenario 3: Live Template Fetch on Selector Open

1. In WhatsApp template mode, open template selector.
2. Close selector.
3. Open selector again.
4. **Expected**: Template list is re-fetched each open and shows approved templates only.

---

## Scenario 4: Variable Prefill + Edit

1. Select template `order_update`.
2. **Expected**: Variables are prefilled from context where available.
3. Confirm variable `{{2}}` is prefilled with authenticated user email.
4. Edit one or more variables manually.
5. **Expected**: Edits are retained for send payload.

---

## Scenario 5: Template Send Success

1. In template mode, choose template and fill required variables.
2. Start a timer immediately before clicking Send.
3. Click Send.
4. **Expected**: Send succeeds through `inbox-twilio-send`.
5. **Expected**: Outbound timeline entry appears with fully rendered template text in body.
6. Stop timer when send success UI/timeline update is visible.
7. **Expected**: End-to-end completion time is under 60 seconds (SC-005 evidence capture).

---

## Scenario 6: Template Validation Failure

1. Leave one required variable empty.
2. Click Send.
3. **Expected**: Send is blocked with clear validation feedback; no edge call fired.

---

## Scenario 7: Non-WhatsApp Channels Unchanged

1. Send email reply in inbox.
2. Send SMS reply in inbox.
3. **Expected**: Both continue to function unchanged.
