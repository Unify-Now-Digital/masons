# Research: Proof Agent

**Phase 0 — Architecture findings from codebase analysis**
**Date**: 2026-03-31

---

## 1. Inscription Text Source

**Decision**: Pre-populate from `inscriptions` table (first `type='front'` row for the order), editable in ProofGenerateForm.

**Rationale**: The `inscriptions` module already exists with a full CRUD stack and is already consumed in `OrderDetailsSidebar` via `useInscriptionsByOrderId`. The `Inscription` type has `inscription_text`, `type` ('front' | 'back' | 'side' | 'plaque' | 'additional'), `style`, `color` — all relevant to proof generation. Using this avoids duplicating inscription data.

**Note**: The Memorial schema (`memorials.inscriptionText`) also contains inscription text but at the memorial record level rather than order level. The `inscriptions` table is the more appropriate source since it is scoped to a specific order.

**Alternatives considered**: Memorial `inscriptionText` field. Rejected — not order-scoped; may not match the specific inscription the mason is engraving.

---

## 2. proof-send: Image Delivery Cannot Reuse Existing Text-Only Send Functions

**Decision**: `proof-send` Edge Function delivers images directly via provider APIs; creates `inbox_conversations` + `inbox_messages` rows for Inbox visibility.

**Rationale**: Codebase audit confirms:
- `inbox-twilio-send`: accepts `{ conversation_id, body_text }` — text only, no `mediaUrl`
- `inbox-gmail-send`: accepts `{ conversation_id, body_text }` — text-only reply to existing Gmail thread
- `inbox-gmail-new-thread`: accepts `{ to, subject, body_text }` — creates new email thread, text only

All existing send functions are text-only. Proof delivery requires sending an image (PNG). The `proof-send` function must directly call:
- **Twilio**: `POST /2010-04-01/Accounts/{sid}/Messages.json` with `Body` + `MediaUrl[]` for WhatsApp image delivery
- **Gmail API**: `POST /gmail/v1/users/me/messages/send` with a multipart MIME message (text/plain intro + image/png attachment or inline reference)

After sending, `proof-send` creates:
- One `inbox_conversations` row per channel (`channel = 'email'` or `channel = 'whatsapp'`)
- One `inbox_messages` row per channel (`direction = 'outbound'`, `body_text = message_text`, meta stores the proof_id)

This ensures customer replies appear in the existing Inbox flow unchanged.

**Alternatives considered**: Extend `inbox-twilio-send` / `inbox-gmail-send` to support media. Rejected — would require breaking changes to existing callers; cleaner to keep proof delivery isolated.

---

## 3. proof-approve and proof-request-changes: No Edge Function Required

**Decision**: Direct Supabase client updates (`useApproveProof`, `useRequestProofChanges` hooks).

**Rationale**: These transitions are pure DB updates with no external service calls:
- `sent → approved`: set `state = 'approved'`, `approved_at`, `approved_by = 'staff_manual'`
- `sent → changes_requested`: set `state = 'changes_requested'`, `changes_requested_at`, `changes_note`

RLS (`user_id = (select auth.uid())`) ensures only the owner can update their own rows. Client-side pre-validation checks that the current state is valid before issuing the update.

**Alternatives considered**: Edge functions for these transitions. Rejected — no secrets involved; adds network round-trip with no security or business-logic benefit for MVP.

---

## 4. Job Start Gate — UI Enforcement Only (MVP)

**Decision**: Gate enforced in `EditJobDrawer` (status field) and `JobsPage` (inline status updates if any), querying `order_proofs` via `useProofByOrder(job.order_id)`.

**Rationale**: The `Job` type has `order_id: string | null`. The gate logic is: if `order_id` is set AND the proof query returns no row with `state = 'approved'`, all status → `in_progress` controls are disabled with a Tooltip. This is purely additive — `EditJobDrawer` already uses `useOrdersList()` for the order picker, so adding a single additional query for proof status is minimal overhead.

**What counts as "approved"**: Exactly `order_proofs.state = 'approved'` on any row for that `order_id`. A row in `draft`, `sent`, `failed`, or `changes_requested` does NOT satisfy the gate.

**Alternatives considered**: `proof-approve` Edge Function that also validates job start eligibility; or a DB trigger that blocks job status changes. Both rejected for MVP — over-engineered; UI gate is sufficient for a staff tool.

---

## 5. Supabase Storage: proof-renders Bucket

**Decision**: Private bucket `proof-renders`. Frontend uses client-side `createSignedUrl` (1-hour TTL) to display images. `proof-generate` uploads using the service role key.

**Rationale**: Proof images contain personal/sensitive data (deceased names, family memorial details). A public bucket would expose these to anyone with the URL. Signed URLs with a 1-hour TTL are sufficient for staff review.

**Path convention**: `{user_id}/{order_id}/{proof_id}.png` — enables RLS-equivalent path validation in storage policies (users can only access paths prefixed with their own user_id).

---

## 6. OpenAI images.edit Integration

**Decision**: `proof-generate` calls `POST https://api.openai.com/v1/images/edits` with the stone photo as the `image` parameter and a descriptive prompt. Store full response JSON in `render_meta`.

**Implementation notes**:
- Download `stone_photo_url` (order's product photo) server-side → stream as `FormData` `image` field
- Use `render_method = 'ai_image'` to record how the render was produced
- On success: upload PNG to `proof-renders/{user_id}/{order_id}/{proof_id}.png`, update `render_url` and `state = 'draft'`
- On failure: update `state = 'failed'`, `last_error = error message`, `render_meta = raw error response`
- The OpenAI secret key is read from `Deno.env.get('OPENAI_API_KEY')` — must be set as a Supabase project secret before deploying

**Prompt pattern** (advisory — final prompt is tuned at implementation):
```
Engrave the following inscription on the memorial stone in the image using a [font_style] font style.
Inscription: "[inscription_text]"
[additional_instructions if provided]
Make the engraving realistic, as if carved into the stone surface.
```

**Alternatives considered**: Replicate hosted models. Available as a fallback if OpenAI images.edit is unsatisfactory — architecture is provider-agnostic (`render_provider` field stores the actual provider used).

---

## 7. Migration Sequencing (No Supabase CLI)

**Decision**: Deliver two independent migration SQL blocks; apply via Supabase dashboard SQL editor in order.

1. `create_order_proofs_table.sql` — table + state/method constraints + RLS + updated_at trigger
2. `create_proof_renders_bucket.sql` — storage bucket + storage policy

**Rationale**: Dashboard-only workflow; each file is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE POLICY IF NOT EXISTS` where Postgres supports it, `DO $$ ... END $$` blocks for conditional logic).

---

## 8. What Is NOT Changing (Confirmed Stable)

| Area | Status |
|------|--------|
| `inbox-twilio-send` | Untouched |
| `inbox-gmail-send` | Untouched |
| `inbox-gmail-new-thread` | Untouched |
| `inscriptions` module | Untouched — read-only reference |
| `orders` table schema | Untouched — no new columns needed |
| `jobs` table schema | Untouched — `order_id` already present |
| All existing WhatsApp managed/manual send paths | Untouched |
| Manual WhatsApp flow in `WhatsAppConnectionStatus` | Untouched |
