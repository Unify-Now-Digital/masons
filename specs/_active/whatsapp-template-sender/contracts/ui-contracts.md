# UI Contracts: WhatsApp Template Sender

---

## 1) Composer Visibility Rules

- Template mode controls are visible only when active reply channel is `whatsapp`.
- For `email` or `sms`, composer remains current freeform-only behavior.

---

## 2) Composer Interaction Contract

### Mode switch
- Values: `freeform` | `template`
- Default: `freeform`
- Switching back to freeform must preserve existing send behavior.

### Template selector
- Opens list of approved templates.
- Fetches list live each open.
- If load fails, show non-blocking error and keep freeform available.

### Variable form
- Appears once a template is selected.
- Prefills from context:
  - customer fields from linked conversation/person/order context
  - staff `{{2}}` from authenticated user email
- All variables editable by staff before send.

---

## 3) Send Behavior Contract

### Freeform mode
- Uses current payload `{ conversation_id, body_text }`.
- Existing UX/status/errors unchanged.

### Template mode
- Sends `contentSid` + `contentVariables` (and rendered `body_text` for timeline persistence).
- Validation blocks send until required values are present.

---

## 4) Timeline Rendering Contract

- Sent template messages appear in thread as normal outbound messages.
- Timeline displays `inbox_messages.body_text` (rendered text), same as freeform.

---

## 5) Non-regression UI Contract

- No changes to non-WhatsApp channels.
- No changes to read-only thread rendering behavior.
- Existing keyboard send behavior (Enter / Shift+Enter) remains intact.
