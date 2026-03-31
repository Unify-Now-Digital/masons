# Implementation Plan: Proof Agent

**Branch**: `feature/proof-agent` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/_active/proof-agent/spec.md`

---

## Summary

Build the Proof Agent feature: a new `order_proofs` table + `proof-renders` storage bucket gated by RLS, two privileged Edge Functions (`proof-generate` calling OpenAI, `proof-send` delivering the image via provider APIs), plus a `src/modules/proofs/` frontend module with a state-driven `ProofPanel`, generation form, send modal, and status badge — culminating in a UI-level Job start gate enforced wherever a Job's status can be changed to `in_progress`.

---

## Technical Context

**Language/Version**: TypeScript 5.5 (frontend), Deno (edge functions)
**Primary Dependencies**: React 18, Vite, Tailwind, shadcn/ui, React Query v5, Zod, React Hook Form; Supabase JS v2; OpenAI REST API (`images.edit`); Twilio REST API; Gmail API
**Storage**: Supabase Postgres (new `order_proofs` table); Supabase Storage (new `proof-renders` private bucket)
**Testing**: Manual verification via quickstart.md
**Target Platform**: Web browser (staff-facing desktop-primary)
**Performance Goals**: AI render returns within 30 s (OpenAI p95); UI gate evaluation is synchronous client-side
**Constraints**: No Supabase CLI — all migrations delivered as raw SQL; proof-send must handle image delivery (not text-only); Job gate in UI only for MVP
**Scale/Scope**: One active proof per order (latest drives gate); multi-proof history retained in DB

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Dual router constraint | ✅ Pass | No routing changes — proofs module is UI only inside existing Order views and Job views |
| Module boundaries | ✅ Pass | New `src/modules/proofs/` module; no cross-module deep imports; badge consumed via index export |
| Supabase + RLS | ✅ Pass | `order_proofs` has user_id-based RLS; direct client queries for approve/change-request are RLS-gated |
| Secrets stay server-side | ✅ Pass | OpenAI API key, Twilio credentials, Gmail credentials accessed only in Edge Functions |
| Additive-first | ✅ Pass | New table, new module, new edge functions; existing Order/Job components receive additive props/hooks only |

*Re-check post-design: no violations.*

---

## Project Structure

### Documentation (this feature)

```text
specs/_active/proof-agent/
├── plan.md              ← this file
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── api-contracts.md
    └── ui-contracts.md
```

### Source Code Layout

```text
supabase/
├── migrations/
│   ├── YYYYMMDDHHMMSS_create_order_proofs_table.sql     NEW
│   └── YYYYMMDDHHMMSS_create_proof_renders_bucket.sql  NEW
└── functions/
    ├── proof-generate/
    │   └── index.ts                                     NEW
    ├── proof-send/
    │   └── index.ts                                     NEW
    └── _shared/
        └── proofUtils.ts                                NEW (signed URL helper)

src/modules/proofs/
├── api/
│   └── proofs.api.ts                                    NEW
├── hooks/
│   └── useProofs.ts                                     NEW
├── types/
│   └── proofs.types.ts                                  NEW
├── schemas/
│   └── proof.schema.ts                                  NEW
├── components/
│   ├── ProofPanel.tsx                                   NEW
│   ├── ProofGenerateForm.tsx                            NEW
│   ├── ProofSendModal.tsx                               NEW
│   └── ProofApprovalBadge.tsx                          NEW
└── index.ts                                             NEW

# Touched (additive only):
src/modules/orders/components/OrderDetailsSidebar.tsx   MODIFIED — add ProofPanel
src/modules/jobs/pages/JobsPage.tsx                     MODIFIED — add ProofApprovalBadge, gate Start
src/modules/jobs/components/EditJobDrawer.tsx           MODIFIED — gate status→in_progress
```

---

## Phase 0: Research Findings

See [research.md](./research.md) for full analysis. Summary:

### 1. Inscription Text Source
`order_proofs.inscription_text` is entered/confirmed in `ProofGenerateForm`. Pre-populate from the `inscriptions` table (already used in `OrderDetailsSidebar` via `useInscriptionsByOrderId`), taking the first `type='front'` row's `inscription_text`. Fallback: empty field requiring manual entry.

### 2. Proof Send — Image Delivery Cannot Reuse Text-Only Send Functions
- `inbox-twilio-send` supports only `body_text` (text messages)
- `inbox-gmail-send` supports only plain-text replies to existing threads

The new `proof-send` function must deliver images by calling provider APIs directly:
- **Email**: Use Gmail API `messages.send` with multipart MIME (`text/plain` + `image/png` attachment), creating a new thread to the customer
- **WhatsApp**: Use Twilio Messages API with `Body` + `MediaUrl[]` pointing to a signed proof-renders URL, creating a new Twilio thread

After sending, `proof-send` creates an `inbox_conversations` row and an `inbox_messages` row so customer replies appear in the Inbox as normal.

### 3. proof-approve and proof-request-changes — No Edge Function Needed
These transitions (`sent → approved` and `sent → changes_requested`) involve no external secrets or provider calls — only Supabase updates. They are implemented as **direct Supabase client updates** in frontend hooks, gated by RLS (`user_id = (select auth.uid())`). State validity is checked client-side before calling; no server-side business logic guard is required for MVP.

### 4. Job Gate — UI Only for MVP
`jobs.order_id` links a job to an order. The gate is: when `job.order_id IS NOT NULL`, query `order_proofs` for any row with `order_id = job.order_id AND state = 'approved'`. If none, disable the "Start Job" status controls in `EditJobDrawer` and any inline status buttons in `JobsPage`. A tooltip explains the block. No Edge Function guard in MVP.

### 5. Storage Access Pattern
The `proof-renders` bucket is private. `proof-generate` writes the image using the service role key. The frontend obtains a short-lived signed URL via `supabase.storage.from('proof-renders').createSignedUrl(path, 3600)` to render the image — this is a client-side call, not a server-side call, and is gated by storage RLS.

### 6. OpenAI images.edit Strategy
- Pass `order.product_photo_url` as the base image (download → pass as `FormData` `image` field)
- Pass inscription details in the `prompt` field: font style, text, instructions
- Store the full raw response JSON in `render_meta` for debugging
- On failure: set `state = failed`, store `last_error`

---

## Phase 1: Design

### Core Architectural Decisions

1. **New module `src/modules/proofs/`** — owns all proof UI; `ProofPanel` is consumed by `OrderDetailsSidebar` via import from `@/modules/proofs`

2. **`proof-generate` and `proof-send` are Edge Functions** — they hold API keys; everything else is direct client interaction

3. **State transitions via direct Supabase update** for approve and request-changes — no edge function overhead; RLS is the guard

4. **One active proof per order** — UI always reads the latest proof row (ordered by `created_at DESC LIMIT 1`); all rows retained for audit

5. **Job gate is additive** — `EditJobDrawer` gains a `useProofByOrder(job.order_id)` call; if no approved proof, all status→`in_progress` controls are disabled

---

## Complexity Tracking

> No constitution violations. No complexity justification required.
