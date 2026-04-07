# Quickstart: Verify WhatsApp 24-Hour Composer Session

## Prerequisites

- Dev app running; inbox with at least one **WhatsApp** conversation linked to a person.
- Ability to see **inbound** WhatsApp messages in thread (or seed data).

## Checks

### A. Session open (banner hidden, toggle visible)

1. Open a WhatsApp conversation whose **last inbound** message is **within 24 hours** (adjust clock or use fresh test thread).
2. Select **WhatsApp** as reply channel if unified.
3. **Expect**: No amber banner; **Freeform** and **Template** buttons visible; freeform send works.

### B. Session closed — stale inbound (banner + template-only)

1. Use a conversation whose last **inbound WhatsApp** message is **older than 24 hours** (or mock `sent_at` in dev data).
2. **Expect**: Amber banner with expiry copy; **no** Freeform/Template toggle; composer in template mode; only template send path.

### C. Session closed — no inbound

1. Open or simulate a WhatsApp thread with **only outbound** messages in loaded history.
2. **Expect**: Same as B (closed).

### D. Email / SMS regression

1. Switch reply channel to **Email** or **SMS**.
2. **Expect**: No WhatsApp session banner; no template-only lock from this feature.

### E. Mixed timeline (Customers tab)

1. Open a **linked customer** with messages across channels; select **WhatsApp** and a WA `activeConversationId` with old/no inbound WA.
2. **Expect**: Closed session UI based on **WhatsApp** inbound for **that** conversation id, not on a recent SMS/email inbound.

## Lint / typecheck

```bash
npx tsc --noEmit
npm run lint
```
