# Research: Shared WhatsApp UI and Sender Identity

**Phase 0 — Architecture findings from codebase analysis**  
**Date**: 2026-03-31

---

## 1) WhatsApp Status Top-Bar Placement

**Decision**: Keep `WhatsAppConnectionStatus` as the single top-bar status surface.

**Rationale**: It is already mounted in `DashboardLayout` for all logged-in users, so admin gating can be added without introducing a second status component.

**Alternatives considered**:
- Build separate admin/non-admin components: rejected (duplicates status logic and increases drift risk).

---

## 2) Admin Mechanism

**Decision**: Use authenticated user email compared against `VITE_ADMIN_EMAIL` as the only admin check.

**Rationale**: This is the explicit product constraint and requires no backend schema or role changes.

**Alternatives considered**:
- Supabase role/claims based admin: rejected (out of scope and not requested).

---

## 3) Sender Metadata Scope

**Decision**: Persist sender identity only for WhatsApp outbound sends in `inbox-twilio-send` as `meta.sender_email`.

**Rationale**: Clarification explicitly limits sender storage to WhatsApp channel and keeps email/SMS unchanged.

**Alternatives considered**:
- Add sender metadata for email and SMS too: rejected (scope expansion).

---

## 4) Outbound Sender Label Behavior

**Decision**: Apply custom sender label logic only to outbound WhatsApp bubbles:
- Same sender email as current user -> `You`
- Different sender email -> show that email
- Missing sender email -> `You`

**Rationale**: This preserves backward compatibility for historical rows without metadata and keeps non-WhatsApp rendering untouched.

**Alternatives considered**:
- Global label logic across all channels: rejected (contradicts requirement).

---

## 5) Existing Save/Render Pipeline

**Decision**: Keep current frontend send pipeline and thread rendering architecture; only add additive metadata read/write paths.

**Rationale**: `useSendReply` already routes WhatsApp to `inbox-twilio-send`, and `ConversationThread` already computes `senderName` before passing to `InboxMessageBubble`.

**Alternatives considered**:
- Introduce new sender lookup API: rejected (unnecessary complexity).

---

## 6) Scope & Safety Constraints

**Decision**: No schema changes, migrations, or non-WhatsApp path updates.

**Rationale**: Required by feature constraints and constitution additive-first principle.

**Alternatives considered**:
- Schema-level normalization for sender fields: rejected (explicitly disallowed).
