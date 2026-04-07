# Quickstart: Inbox Channel Switching UX

Manual checks after implementation. Use a test workspace with Gmail + WhatsApp connected where possible.

## Scenario 1 — Conversations: channel with no thread (Email)

1. Open **Conversations** tab; select a conversation linked to a person who has **no** email thread (or use a person with only WhatsApp history).
2. Click **Reply via → Email** (or equivalent channel pill).
3. **Expect**: Channel filter updates; main area shows empty state with **Start new conversation** (not a silent no-op).
4. Click **Start new conversation**; **Expect**: `NewConversationModal` opens; **Subject** is required; person prefilled if applicable.
5. Submit with subject + valid recipient; **Expect**: New email thread selected and send works.

## Scenario 2 — Conversations: SMS unsupported

1. From a linked conversation, switch to **SMS** when there is **no** SMS thread.
2. **Expect**: Message that **new SMS conversation is not supported**; no destructive or confusing send path.

## Scenario 3 — Customers: start conversation before send

1. Open **Customers** tab; select a customer with history in one channel only.
2. Switch channel pill to a channel **without** an existing conversation.
3. **Expect**: Timeline still shows historical messages; composer shows **Start conversation** (not only a disabled Send).
4. Click **Start conversation** (Email/WhatsApp); complete modal.
5. **Expect**: Composer enables; send works; **WhatsApp** defaults to **Template** mode when the **entire** customer timeline has no messages yet (`messages.length === 0`). If there is already history on another channel, template mode is not forced automatically.

## Scenario 4 — Regression

1. Open an existing conversation with messages; reply in same channel.
2. **Expect**: No change to prior send behavior; no extra modal.

## Scenario 5 — Email subject validation

1. Open new email conversation modal; leave subject empty.
2. **Expect**: Cannot submit; clear validation message.

---

## Validation notes (2026-04-08)

- **Constitution**: Plan constitution check references `.specify/memory/constitution.md` v0.1.0 (frontend-only, inbox module scope, additive changes).
- **Unlinked (Conversations)**: Channel still updates; main message: *“Link a person to start a conversation in this channel.”* — no Start button until linked.
- **WhatsApp template default**: Uses **`messages.length === 0`** for the full message list passed into `ConversationThread`. On **Customers**, if the timeline already has any message (e.g. email history), switching to a **new** WhatsApp thread does **not** force template mode automatically.
- **Start conversation (Customers)**: Button only when **`linkedPersonId`** is set **and** the customer has **email** (Email channel) or **phone** (WhatsApp). Unlinked rows rely on existing single-channel behaviour; link person first for cross-channel start.
- **SMS**: New SMS threads remain out of scope; copy explains switching to Email/WhatsApp or using an existing SMS thread.
