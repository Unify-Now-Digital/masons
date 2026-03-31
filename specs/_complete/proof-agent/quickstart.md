# Quickstart: Verify Proof Agent

Manual verification steps. Run `npm run dev` and have Supabase dashboard access before starting.

---

## Prerequisites

1. Migration SQL has been executed in the Supabase dashboard SQL editor (in order):
   - `create_order_proofs_table.sql`
   - `create_proof_renders_bucket.sql`
2. Edge Functions deployed: `proof-generate`, `proof-send`
3. Supabase secret `OPENAI_API_KEY` set in project secrets
4. At least one Order exists with a `product_photo_url` set
5. That Order has an `inscriptions` row with `type='front'` and `inscription_text` set
6. That Order is linked to a Job (via `job_id` on the order or `order_id` on the job)

---

## Scenario 1 — Generate Proof (AI Render)

**Setup**: Open an order that has `product_photo_url` and at least one inscription.

1. Open the Order detail sidebar.
2. **Expected**: A "Generate Proof" section/button is visible with no existing proof.
3. Click "Generate Proof".
4. **Expected**: `ProofGenerateForm` opens with inscription text pre-populated from the linked `inscriptions` row; stone photo URL pre-populated from `order.product_photo_url`.
5. Optionally edit inscription text or select font style. Click "Generate".
6. **Expected**: Panel shows "Generating proof…" spinner. The `order_proofs` row in Supabase shows `state = 'generating'`.
7. After AI completes (up to ~30 s):
8. **Expected**: Draft proof image renders in the panel. Row shows `state = 'draft'`, `render_url` is set, `render_meta` contains the raw OpenAI response.

---

## Scenario 2 — Generate Proof (Manual Upload)

1. Open `ProofGenerateForm`. Remove the pre-populated stone photo URL and enter a direct PNG URL you control (or use a placeholder test URL).
2. Click "Generate".
3. **Expected**: Same flow as Scenario 1.

---

## Scenario 3 — Send Proof to Customer via Email

**Setup**: Proof is in `draft` state. Order has `customer_email` set.

1. Click "Send to Customer" in `ProofPanel`.
2. **Expected**: `ProofSendModal` opens with Email checkbox checked by default; customer email pre-populated.
3. Uncheck WhatsApp, leave Email checked. Click "Send".
4. **Expected**: Modal shows "Proof sent successfully". Close modal.
5. **Expected**: `ProofPanel` shows `state = sent` with sent timestamp and channel (Email).
6. Open the Inbox. **Expected**: A new email conversation appears for the customer's email address with an outbound message containing the proof image.

---

## Scenario 4 — Send Proof via WhatsApp

**Setup**: Proof in `draft`. Order has `customer_phone` set. WhatsApp is configured (managed or manual).

1. Open `ProofSendModal`. Check "WhatsApp", uncheck "Email".
2. **Expected**: Phone field shows `customer_phone`.
3. Click "Send".
4. **Expected**: Proof transitions to `sent`. A WhatsApp conversation appears in Inbox.

---

## Scenario 5 — Mark Proof Approved

**Setup**: Proof in `sent` state.

1. In `ProofPanel`, click "Mark Approved".
2. **Expected**: Confirmation prompt or immediate transition. Panel shows green "Approved" badge + timestamp.
3. Check Supabase: `order_proofs.state = 'approved'`, `approved_by = 'staff_manual'`, `approved_at` is set.

---

## Scenario 6 — Job Gate Enforcement

**Setup**: Order linked to a Job. Proof is NOT approved (e.g., `state = 'draft'` or `state = 'sent'`).

1. Open the Job's edit drawer.
2. **Expected**: The status dropdown "In Progress" option is disabled. Tooltip reads "Proof not yet approved — approve the customer proof before starting this job".
3. Now approve the proof (Scenario 5). Reopen the Job edit drawer.
4. **Expected**: "In Progress" is now selectable. Change status to "In Progress" and save.
5. Verify `ProofApprovalBadge` on the Jobs list shows "Approved" (green) for the corresponding job's linked order.

---

## Scenario 7 — Job Gate: No Linked Order

**Setup**: A Job with no `order_id` linked.

1. Open the Job edit drawer.
2. **Expected**: "In Progress" option is NOT disabled — jobs without linked orders are not gated.

---

## Scenario 8 — Customer Requests Changes

**Setup**: Proof in `sent` state.

1. In `ProofPanel`, click "Request Changes". Enter a change note.
2. **Expected**: Panel transitions to `changes_requested` state showing the change note.
3. Click "Regenerate". `ProofGenerateForm` opens with the previous inscription text and the change note pre-filled in "Additional instructions".
4. Edit inscription/instructions. Click "Generate".
5. **Expected**: New render cycle begins (`generating` → `draft`); updated image shown.

---

## Scenario 9 — AI Render Failure Recovery

**Setup**: Temporarily set an invalid `OPENAI_API_KEY` secret, or pass an unreachable `stone_photo_url`.

1. Trigger proof generation.
2. **Expected**: After the attempt, proof shows `state = 'failed'` with an error message. `render_meta` contains the raw error response.
3. Restore the correct API key / photo URL.
4. Click "Retry". **Expected**: New generation attempt starts cleanly.

---

## Scenario 10 — ProofApprovalBadge in Order List

1. Open the Orders page list view.
2. **Expected**: Each order row with a proof shows a `ProofApprovalBadge` reflecting the current proof state. Orders with no proof show "No Proof" (gray).
3. The badge MUST show green "Approved" only for orders with `state = 'approved'`.

---

## Approved Proof Cannot Be Overwritten

**Setup**: Order with `state = 'approved'` proof.

1. Attempt to click "Generate Proof" or trigger `proof-generate` for this order.
2. **Expected**: Action is blocked; error or disabled state indicates the proof is already approved.
3. `order_proofs` row remains unchanged.
