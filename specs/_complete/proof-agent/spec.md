# Feature Specification: Proof Agent

**Feature Branch**: `feature/proof-agent`
**Created**: 2026-03-31
**Status**: Draft

---

## Context

A "proof" is a design mockup shown to the bereaved family before engraving begins on the memorial stone. The Proof Agent automates this workflow: generating a realistic AI-rendered image of the inscription on the stone, presenting it to staff for review, sending it to the customer for approval via the existing Inbox (email and/or WhatsApp), and gating Job start until approval is confirmed.

The Proof Agent sits in the operational spine:

```
Invoice → Order → [Proof Agent] → Job → Installation
```

---

## User Scenarios & Testing

### User Story 1 — Staff Generates a Proof (Priority: P1)

A staff member opens an Order detail view and clicks "Generate Proof". They confirm or edit the inscription text (pre-populated from the linked memorial record where available), verify the stone photo (pre-populated from the order's product photo), optionally select a font style and add instructions, then trigger the AI render. The system generates a realistic image of the inscription on the stone and presents the draft to the staff member for review.

**Why this priority**: This is the entry point of the entire proof workflow. Without it, nothing downstream is possible.

**Independent Test**: Staff can open any order, fill the proof generation form, trigger generation, and see a rendered draft image — all without sending to the customer.

**Acceptance Scenarios**:

1. **Given** an Order with no existing proof, **When** staff clicks "Generate Proof", **Then** a proof generation form appears pre-populated with inscription text (from linked memorial if available) and the stone photo (from order's product photo if available).
2. **Given** the form is complete, **When** staff clicks "Generate", **Then** the proof row is created with `state = generating` and a loading indicator is shown.
3. **Given** AI rendering succeeds, **When** the render completes, **Then** the proof transitions to `state = draft` and the rendered image is displayed in the ProofPanel.
4. **Given** AI rendering fails, **When** the render errors, **Then** the proof transitions to `state = failed` with an error message; staff can retry or upload a manual proof image.
5. **Given** an Order already has a `draft` proof, **When** staff views the Order, **Then** the existing draft is shown with options to send, regenerate, or upload manually.

---

### User Story 2 — Staff Sends Proof to Customer (Priority: P1)

After reviewing the draft image, the staff member sends it to the customer. They choose the delivery channel (email, WhatsApp, or both), preview the outbound message, and confirm. The customer receives the proof image and a request for approval.

**Why this priority**: This is the core value proposition — replacing manual email/WhatsApp attachments with a tracked, auditable send directly from the Order.

**Independent Test**: Starting from a `draft` proof, staff can send to the customer and the proof transitions to `sent` with a timestamped delivery record.

**Acceptance Scenarios**:

1. **Given** a proof with `state = draft`, **When** staff opens the send modal, **Then** available channels are pre-populated with the customer's known email and/or phone from the Order; staff can edit the contact details before sending.
2. **Given** staff selects "Email" and clicks "Send", **Then** the proof image is sent via the existing Inbox Gmail channel; an `inbox_conversations` thread is created or linked; proof transitions to `state = sent`.
3. **Given** staff selects "WhatsApp" and clicks "Send", **Then** the proof image is sent via the existing Inbox Twilio channel (managed or manual, as configured); proof transitions to `state = sent`.
4. **Given** staff selects "Both", **Then** the proof is sent on both channels; proof transitions to `state = sent`.
5. **Given** the proof is NOT in `draft` state, **When** staff views the Order, **Then** the send action is not available — preventing duplicate sends from incorrect states.
6. **Given** a send fails mid-flight, **Then** the proof remains in `draft` state and the error is surfaced; no partial-sent state is silently accepted.

---

### User Story 3 — Staff Marks Proof Approved (Priority: P1)

After the customer verbally or in writing approves the proof (the customer's response arrives in the Inbox as a normal message), the staff member manually marks the proof as approved in the Order view. This action gates Job start.

**Why this priority**: This is the explicit approval gate — without it, the Job cannot be started, and engraving cannot begin. It is intentionally manual in MVP to prevent premature or accidental approval.

**Independent Test**: Starting from a `sent` proof, staff can click "Mark Approved" and the proof transitions to `approved`; the associated Job becomes startable.

**Acceptance Scenarios**:

1. **Given** a proof with `state = sent`, **When** staff clicks "Mark Approved", **Then** the proof transitions to `state = approved` with `approved_at` timestamp and `approved_by = staff_manual`.
2. **Given** the proof is `approved`, **When** staff views the linked Job, **Then** the "Start Job" button is enabled.
3. **Given** NO approved proof exists on the Order, **When** staff views the linked Job, **Then** the "Start Job" button is disabled with a tooltip: "Proof not yet approved".
4. **Given** a proof is marked approved, **When** staff views the Order, **Then** the ProofPanel shows "Approved" status with the approval timestamp.

---

### User Story 4 — Customer Requests Changes (Priority: P2)

A customer replies to the proof message (via Inbox) requesting changes to the inscription. The staff member reads the reply in Inbox, records the change note on the proof, and triggers a new generation with updated details. The proof cycles back through the workflow.

**Why this priority**: Changes are common in the memorial trade. Without this path, staff are forced to create duplicate orders or handle changes entirely outside the system.

**Independent Test**: Starting from a `sent` proof, staff can click "Request Changes", enter a note, update the inscription details, and trigger a new render — the proof cycles back to `generating` and then `draft`.

**Acceptance Scenarios**:

1. **Given** a proof with `state = sent`, **When** staff clicks "Customer Requested Changes" and enters a change note, **Then** the proof transitions to `state = changes_requested` with `changes_requested_at` timestamp and `changes_note` stored.
2. **Given** a proof with `state = changes_requested`, **When** staff edits the inscription/instructions and clicks "Regenerate", **Then** the proof transitions to `state = generating` and a new render is triggered.
3. **Given** the new render succeeds, **When** generation completes, **Then** the proof transitions back to `state = draft`; the staff member reviews the updated image before re-sending.
4. **Given** a proof with `state = changes_requested`, **When** staff uploads a manual image instead of triggering AI, **Then** the proof transitions to `state = draft` using the uploaded image.

---

### User Story 5 — Job Start Gate (Priority: P1)

Any staff member attempting to start a Job from the Order or Job view is blocked unless the linked Order has a proof in `state = approved`. The block is visible and explained.

**Why this priority**: This is the safety gate that prevents engraving errors. It is non-negotiable — approved proof is the only valid condition for starting work.

**Independent Test**: With an Order having no proof, a pending proof, or a `sent` (but not yet approved) proof, the Job start action must be disabled. Only with `state = approved` is the action enabled.

**Acceptance Scenarios**:

1. **Given** an Order with no `order_proofs` row, **When** staff views the linked Job, **Then** "Start Job" is disabled with tooltip "Proof not yet approved".
2. **Given** an Order with a proof in `state = generating`, `draft`, or `sent`, **When** staff views the Job, **Then** "Start Job" is disabled with tooltip "Proof not yet approved".
3. **Given** an Order with `state = approved` proof, **When** staff views the Job, **Then** "Start Job" is enabled.
4. **Given** a previously approved proof is later discovered to be incorrect and staff somehow creates a new proof (changing state away from approved), **Then** the Job start gate re-engages until a new proof is approved.

---

### Edge Cases

- What happens when the Order has no `product_photo_url`? The ProofGenerateForm shows a manual upload field for the stone photo; generation is blocked until a photo is provided.
- What happens when the Order has no customer email or phone? The send modal shows those fields as empty and requires staff to enter contact details manually before sending; the proof is not sent until a valid destination exists.
- What happens when the AI render provider is unavailable? The proof transitions to `state = failed`; staff can retry or use the manual upload fallback.
- What happens when staff attempts to send a proof that is not in `draft` state? The send action is not available; the UI prevents it.
- What happens when the Order has multiple proofs (e.g. after changes and regeneration)? The UI shows only the latest proof. All proof rows are retained in the database for audit; only the most recent drives the Job gate.
- What happens if the customer approves via a reply in Inbox? In MVP, staff reads the reply and manually marks approved — no automatic parsing. The reply remains visible in the linked Inbox conversation thread.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide a "Generate Proof" action on the Order detail view that creates a proof and triggers AI rendering.
- **FR-002**: The proof generation form MUST pre-populate inscription text from the linked memorial record's inscription field where available; staff MUST be able to edit this text before triggering generation.
- **FR-003**: The proof generation form MUST pre-populate the stone photo from the order's product photo URL where available; staff MUST be able to change or replace this photo before triggering generation.
- **FR-004**: The proof generation form MUST support an optional font style selection and free-text additional instructions field.
- **FR-005**: The system MUST display the rendered proof image to staff after successful generation, before any send action is offered.
- **FR-006**: Staff MUST be able to upload a manual proof image as an alternative to AI generation at any point when the proof is in `draft` or `failed` state.
- **FR-007**: The send action MUST be restricted to proofs in `draft` state only; proofs in any other state MUST NOT be sendable.
- **FR-008**: The proof send modal MUST allow staff to choose from: email only, WhatsApp only, or both channels; it MUST pre-populate the customer's known email and phone from the Order.
- **FR-009**: Outbound proof delivery MUST use the existing Inbox send infrastructure (Gmail for email, Twilio for WhatsApp) without duplicating send logic.
- **FR-010**: Each outbound send MUST create or link an `inbox_conversations` thread for the proof, enabling customer replies to appear in the Inbox.
- **FR-011**: Staff MUST be able to manually mark a `sent` proof as approved via a single action ("Mark Approved") on the Order detail view.
- **FR-012**: A Job MUST NOT be startable unless the linked Order has at least one proof with `state = approved`; this gate MUST be enforced in the UI with a visible disabled state and explanatory tooltip.
- **FR-013**: Staff MUST be able to record a customer change request on a `sent` proof (with a free-text note) transitioning it to `changes_requested`.
- **FR-014**: Staff MUST be able to regenerate a proof from `changes_requested` state, cycling it back through `generating → draft`.
- **FR-015**: The system MUST retain the rendered image, all generation parameters, and the AI provider response metadata for every proof, regardless of state.
- **FR-016**: A `ProofApprovalBadge` MUST be displayed on the Order list and Job views, showing the current proof state at a glance.

### Architectural Constraints

- **AC-001**: All proof data MUST live within `src/modules/orders/` or a new `src/modules/proofs/` feature module; no cross-module deep imports.
- **AC-002**: Outbound messaging MUST reuse the existing Inbox send APIs (`inbox-twilio-send`, Gmail send); the Proof Agent MUST NOT implement its own send logic.
- **AC-003**: The Job start gate MUST be enforced in the UI; the UI check MUST evaluate `state = approved` on the proof row, not any other proxy condition.
- **AC-004**: AI provider calls MUST be made from backend Edge Functions only; no AI API keys are exposed to the frontend.
- **AC-005**: RLS MUST be applied to the `order_proofs` table with ownership via `user_id`.

### Key Entities

- **OrderProof**: One proof attempt per order per generation cycle. Key attributes: order reference, inscription text, stone photo URL, font style, additional instructions, rendered image URL, render method (AI image / canvas composite / manual upload), lifecycle state, send channel(s), send timestamp, linked inbox conversation, approval timestamp, approval actor, change request note, last error, AI provider response metadata.
- **ProofRender** (storage artefact): A PNG image stored in the `proof-renders` bucket at path `{user_id}/{order_id}/{proof_id}.png`.
- **Order** (existing): The parent entity. Gains a `proof_status` display field and a reference to the latest proof state for list views and the Job gate.
- **Job** (existing): Gains a UI gate on "Start Job" driven by the linked Order's proof approval state.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Staff can go from "no proof" to a rendered draft ready for customer review in under 3 minutes.
- **SC-002**: The Job start action is gated 100% of the time — zero cases where a Job is startable on an Order with no approved proof.
- **SC-003**: Staff can send a proof to a customer via Inbox in under 1 minute from the draft view.
- **SC-004**: Zero proof images are sent to customers without first being reviewed by staff (state must pass through `draft` before `sent`).
- **SC-005**: All AI generation attempts have their full provider response retained for audit and debugging — zero silent drops.
- **SC-006**: The proof state badge is visible on the Order list and Job list without opening a detail view, enabling at-a-glance status for all active orders.

---

## Assumptions

- Inscription text for the proof will be entered or confirmed by staff in the ProofGenerateForm. It will be pre-populated from the linked memorial record's `inscriptionText` field when available; if no memorial is linked, the field starts empty.
- The stone photo will be pre-populated from `order.product_photo_url`. If no product photo exists on the order, staff must provide one manually before generation can proceed.
- Customer email is resolved from `order.customer_email`. Customer WhatsApp contact is resolved from `order.customer_phone` (the `phone` field in the customers module doubles as the WhatsApp-capable phone number for MVP; no separate `whatsapp_number` field exists).
- MVP customer approval is staff-manual only: staff reads the customer's reply in the Inbox and manually clicks "Mark Approved". Automated keyword-detection approval is explicitly out of scope.
- AI rendering uses an external image generation API (specific provider TBD at implementation; OpenAI `images.edit` is recommended). The AI API key is a server-side secret managed in Supabase secrets — never exposed to the frontend.
- The `proof-renders` Supabase storage bucket will be created as part of this feature's migration. Access is private; signed URLs are used for frontend display.
- Only the latest proof row drives the Job gate and the ProofPanel display. All historical proof rows are retained for audit.
- The existing `proof_status` field on the `orders` table is a legacy display enum (`NA | Not_Received | Received | In_Progress | Lettered`) separate from the new `order_proofs` state machine. For MVP these co-exist; the `order_proofs` state is authoritative for the Job gate.
- Multi-proof version history navigation (browsing previous proofs) is out of scope for MVP; only the latest is shown in the UI.
- PDF proof generation, a customer-facing approval portal, and a proof template library are all out of scope for MVP.
