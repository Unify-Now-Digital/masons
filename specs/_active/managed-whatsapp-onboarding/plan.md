# Implementation Plan: Managed WhatsApp Onboarding — UI/UX Modal Improvement

**Branch**: `feature/managed-whatsapp-onboarding` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/_active/managed-whatsapp-onboarding/spec.md`

---

## Summary

Replace the two ad-hoc inline `<Dialog>` components embedded inside `WhatsAppConnectionStatus`
with a single `ManagedWhatsAppModal` component that renders the correct screen based on the
current managed connection state. Add soft-disconnect for managed connections, meta pre-population
for `action_required` recovery, and context-sensitive dropdown menu items for passive re-entry.
Backend edge functions are untouched; all changes are purely frontend.

---

## Technical Context

**Language/Version**: TypeScript 5.5  
**Primary Dependencies**: React 18, Vite, Tailwind CSS, shadcn/ui (Dialog, Button, Input, Label, Badge), React Hook Form + Zod, React Query (@tanstack/react-query v5)  
**Storage**: Supabase Postgres (direct client queries for `whatsapp_managed_connections.meta`; edge function calls for state transitions)  
**Testing**: Manual verification via quickstart.md scenarios; no automated test framework configured  
**Target Platform**: Web browser (desktop-primary staff tool)  
**Performance Goals**: Modal renders within one React render cycle; polling at 10 s interval for pending states (already implemented in `useManagedWhatsAppStatus`)  
**Constraints**: Must not touch backend edge functions; must not break legacy manual WhatsApp flow; must not introduce cross-module imports  
**Scale/Scope**: Single-user per tenant; one active managed connection per user

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Dual router constraint | ✅ Pass | No routing changes — component lives inside `src/modules/inbox/` |
| Module boundaries | ✅ Pass | All new/changed files stay inside `src/modules/inbox/`; no cross-module imports |
| Supabase + RLS | ✅ Pass | Direct Supabase query for `meta` is RLS-gated (own row only); no policy changes needed |
| Secrets | ✅ Pass | No new secrets; edge function calls use existing session token pattern |
| Additive-first | ✅ Pass | New component added; existing `WhatsAppConnectionStatus` shrinks; no deletions of API/hook exports |

*Re-checked post-design: no violations introduced.*

---

## Project Structure

### Documentation (this feature)

```text
specs/_active/managed-whatsapp-onboarding/
├── plan.md              ← this file
├── research.md          ← Phase 0 findings
├── data-model.md        ← frontend types + state machine
├── quickstart.md        ← manual verification steps
├── contracts/
│   └── ui-contracts.md  ← component interface contracts
└── checklists/
    └── requirements.md  ← spec quality checklist
```

### Source Code (affected files)

```text
src/modules/inbox/
├── components/
│   ├── ManagedWhatsAppModal.tsx          NEW — multi-step managed onboarding modal
│   └── WhatsAppConnectionStatus.tsx      MODIFIED — wire in modal, replace inline dialogs,
│                                                     fix dropdown items
├── api/
│   └── whatsappConnections.api.ts        MODIFIED — add fetchManagedWhatsAppMeta(),
│                                                     disconnectManagedWhatsApp()
└── hooks/
    └── useWhatsAppConnection.ts          MODIFIED — add useManagedWhatsAppMeta(),
                                                      useManagedWhatsAppDisconnect()
```

---

## Phase 0: Research Findings

See [research.md](./research.md) for full analysis. Summary:

1. `whatsapp-managed-status` edge function does **not** return `meta` (business details). Pre-populating the business form on `action_required` re-entry requires a direct Supabase query on `whatsapp_managed_connections.meta`.
2. `'draft'` is the API-level virtual status when no row exists (`exists: false`) — it is valid but must be replaced with explicit `exists`-based step derivation in the new modal.
3. Soft disconnect for managed connections can go directly from the frontend via Supabase client update (RLS allows user to update own row; no secrets involved; no edge function needed).
4. `whatsapp-managed-start` already handles the `disconnected`/`failed` → `collecting_business_info` reset, so clicking "Start new onboarding" after disconnect simply calls `managedStartMutation.mutate()`.
5. The `meta` JSON column stores `{ business_name, business_email, business_phone, meta_business_id }` written by `whatsapp-managed-submit-business`.

---

## Phase 1: Design

### Core Architectural Decision

The new `ManagedWhatsAppModal` derives its displayed screen from a **pure step-derivation function** `deriveModalStep(status)` rather than from React state. This means:

- No `currentStep` state that can get out of sync with the server
- Re-opening the modal always shows the correct screen for the current row state
- Step derivation is independently testable

The modal owns no server mutations directly — it receives mutation hooks as wiring from `WhatsAppConnectionStatus` (or imports them internally; see contracts).

### Step Map

| Managed status | Modal screen |
|---------------|-------------|
| `undefined` / `!exists` / `'draft'` / `'not_connected'` | **Step 1**: Start (intro + confirm) |
| `'collecting_business_info'` | **Step 2**: Business Details form |
| `'pending_provider_review'` / `'provisioning'` / `'requested'` / `'pending_meta_action'` | **Step 3**: Pending holding screen |
| `'action_required'` | **Step 4**: Action Required (reason message + re-submit form) |
| `'failed'` / `'error'` / `'degraded'` | **Step 5**: Failed / Error (explanation + start over) |
| `'connected'` (all four criteria met) | **Step 6**: Connected (display number + disconnect) |
| `'disconnected'` | **Step 7**: Disconnected (start new onboarding) |

### Dropdown Menu Item Map

| Managed status | Menu item label | Action |
|---------------|-----------------|--------|
| No row / `'draft'` / `'not_connected'` | "Connect via Managed WhatsApp" | open modal |
| `'collecting_business_info'` | "Resume onboarding" | open modal |
| `'pending_provider_review'` / `'provisioning'` / `'requested'` | "View pending status" | open modal |
| `'pending_meta_action'` / `'action_required'` | "Resolve action required" | open modal |
| `'failed'` / `'error'` / `'degraded'` | "Onboarding failed — start over" | open modal |
| `'connected'` | "Manage connection" | open modal |
| `'disconnected'` | "Reconnect WhatsApp" | open modal |

### Connected Criteria Gate

`managedConnected` evaluation is already correct in `WhatsAppConnectionStatus` (lines 113–118). The new modal re-uses the same four-field check. It MUST NOT re-implement this logic inline — the same expression or a shared utility must be used.

### New API / Hook Surface

See [contracts/ui-contracts.md](./contracts/ui-contracts.md) and [data-model.md](./data-model.md) for full interface definitions.

- `fetchManagedWhatsAppMeta()` — direct Supabase query returning `{ business_name, business_email, business_phone } | null`
- `useManagedWhatsAppMeta(enabled)` — React Query wrapper; enabled only when status is `action_required`
- `disconnectManagedWhatsApp(connectionId)` — direct Supabase update setting `state = 'disconnected'`
- `useManagedWhatsAppDisconnect()` — mutation wrapper; invalidates `managedStatus` query on success

### Stale 'draft' Check Fix

Line 415 in `WhatsAppConnectionStatus` (`managedStatus?.status === 'draft'`) is eliminated by removal — the entire inline `managedOpen` Dialog block is deleted and replaced with a single `<ManagedWhatsAppModal>` + context-sensitive menu item.

---

## Complexity Tracking

> No constitution violations. No complexity justification required.
