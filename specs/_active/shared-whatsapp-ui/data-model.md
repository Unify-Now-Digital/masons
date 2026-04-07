# Data Model: Shared WhatsApp UI and Sender Identity

---

## 1) Admin View Model (Frontend)

```ts
type AdminViewContext = {
  currentUserEmail: string;
  adminEmailFromEnv: string;
  isAdmin: boolean;
};
```

Validation rules:
- `isAdmin` is true only when both emails are non-empty and equal after trim/lowercase normalization.
- If `adminEmailFromEnv` is missing/empty, `isAdmin` is false.

---

## 2) WhatsApp Status Display Model (Frontend)

```ts
type WhatsAppStatusPresentation = {
  connected: boolean;
  statusLabel: string; // e.g. Connected, Not connected, Error
  showControls: boolean; // derived from isAdmin
};
```

Behavior rules:
- All logged-in users see status indicator and label.
- Only admin sees connect/disconnect/manage controls.

---

## 3) Outbound WhatsApp Sender Metadata (Persisted)

No schema changes.

Existing `inbox_messages.meta` JSON (outbound WhatsApp rows only) is extended additively:

```ts
type OutboundWhatsAppMeta = {
  sender_email?: string;
  // existing provider metadata may still exist in parallel
  twilio?: Record<string, unknown>;
};
```

Validation rules:
- On outbound WhatsApp send, `meta.sender_email` is set from authenticated user email when available.
- Existing metadata keys remain preserved.

---

## 4) Thread Sender Label Resolution (Frontend)

```ts
type SenderLabelInput = {
  channel: 'email' | 'sms' | 'whatsapp';
  direction: 'inbound' | 'outbound';
  currentUserEmail: string;
  metaSenderEmail?: string;
};
```

Resolution rules (WhatsApp outbound only):
1. `metaSenderEmail` missing -> `You`
2. `metaSenderEmail` equals `currentUserEmail` -> `You`
3. otherwise -> `metaSenderEmail`

For inbound or non-WhatsApp messages:
- Existing sender label behavior remains unchanged.

---

## 5) State/Flow Notes

- No new tables, migrations, or enum states.
- No lifecycle/state transition changes to conversation/message status.
- Additive UI and metadata behavior only.
