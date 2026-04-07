# Data Model: WhatsApp Template Sender

---

## 1) Request Models (Additive)

### Frontend -> `inbox-twilio-send`

```ts
type FreeformSendRequest = {
  conversation_id: string;
  body_text: string;
};

type TemplateSendRequest = {
  conversation_id: string;
  contentSid: string;
  contentVariables: Record<string, string>;
  // body_text optional in template mode (used for persisted rendered text)
  body_text?: string;
};

type SendTwilioMessageRequest = FreeformSendRequest | TemplateSendRequest;
```

Validation rules:
- `conversation_id` required for all sends.
- Freeform mode requires non-empty `body_text`.
- Template mode requires non-empty `contentSid` and at least required variables present.

---

## 2) Template Selector UI Model

```ts
type WhatsAppTemplateSummary = {
  sid: string;          // Content SID (e.g. HX...)
  friendlyName: string; // Display label
  status: 'approved' | string;
  variables: string[];  // Placeholder keys, e.g. ['1','2','3']
};
```

Validation rules:
- Only `status = approved` templates are selectable.
- Template list is fetched live each selector open.

---

## 3) Template Variable Form Model

```ts
type TemplateVariableValues = Record<string, string>;
```

Initial value sources:
- Customer-related values: linked conversation person/order context.
- Staff placeholder `{{2}}`: authenticated user email.

Validation rules:
- Required placeholders must be non-empty before send.
- User may override any prefilled value.

---

## 4) Persisted Outbound Message Model (Existing Table)

No schema changes.

`inbox_messages` rows continue to store:
- `body_text`: fully rendered template text for template sends
- `status`: `sent`/`failed`
- `meta`: existing JSON metadata (can include Twilio/template details additively)

This preserves timeline rendering consistency with freeform messages.

---

## 5) State/Flow Notes

Composer-level state additions (frontend only):
- `replyMode`: `'freeform' | 'template'` (WhatsApp only)
- `selectedTemplateSid`: `string | null`
- `templateVariables`: `Record<string, string>`
- `templatesLoadState`: idle/loading/success/error

No database lifecycle/state transition changes are introduced.
