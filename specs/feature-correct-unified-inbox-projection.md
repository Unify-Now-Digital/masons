## Correct UnifiedInboxPage to a Pure Read-Only Projection of `public.messages`

## Overview

Correct the recently implemented `UnifiedInboxPage` so that the Inbox is a **pure, read-only projection** of `public.messages`, without Inbox-specific lifecycle semantics or domain logic.

**Context:**
- `UnifiedInboxPage` has already been wired to real data via the existing `public.messages` data access (e.g. `fetchMessages` / `useMessagesList`).
- The current implementation unintentionally introduced Inbox semantics such as read/unread status, unread counts, type-based filters, and default priority values.
- Orders-related surfaces (`SortableOrdersTable`, `OrderDetailsSidebar`) are already integrated with messages and must not be changed.

**Goal:**
- Ensure the Inbox UI is a **thin, read-only projection** of the `Message` entity, with no added lifecycle semantics.
- Preserve the existing Inbox layout, tabs, and cards visually while making the tab and list behavior semantics-free.

---

## Current State Analysis

### Inbox Projection Schema

**Entity:** `Message` (source of truth)

**Current Structure (relevant fields):**
- `id: uuid`
- `order_id: uuid | null`
- `from_name: text`
- `subject: text | null`
- `content: text`
- `priority: 'low' | 'medium' | 'high'`
- `created_at: timestamptz`

**Observations:**
- These fields are sufficient to render the current Inbox cards (sender, subject, body preview, created-at timestamp, optional priority, optional order badge).
- Additional fields like `type`, `direction`, and `is_read` exist on `Message` but must **not** be used to derive inbox lifecycle semantics in this feature.

### Unified Inbox UI Schema

**Entity:** `UnifiedInboxPage` view model

**Current Structure (unintended semantics):**
- Derived `status: 'unread' | 'read'` from `message.is_read`.
- Unread counts and an "Unread" tab that filter based on this derived status.
- Derived or defaulted `type` (e.g. `email` / `phone`) from `message.type` or fabricated defaults, used for tab-based filtering.
- Defaulted `priority` (e.g. falling back to `'medium'`) when `message.priority` is falsy.

**Observations:**
- The view model is not a pure projection of `Message`; it injects lifecycle meaning (read/unread) and fabricated defaults.
- Tabs currently combine **layout concerns** (visible segments of the UI) with **semantic concerns** (inbox state machines), which is out of scope.

### Relationship Analysis

**Current Relationship:**
- `UnifiedInboxPage` consumes `Message[]` from `public.messages` via existing data-access.
- The page transforms each `Message` into a richer view model that includes:
  - A derived status,
  - A derived/assumed type,
  - A default priority value.
- Tabs and counts use these derived fields to implement pseudo-inbox behavior.

**Gaps/Issues:**
- The Inbox UI applies application-level semantics over `Message` that:
  - Are not part of the requested scope.
  - Risk conflicting with any future, explicit Inbox lifecycle model.
  - Make the page harder to reason about as a simple projection layer.

### Data Access Patterns

**How `Message` is Currently Accessed:**
- `useMessagesList()` → `fetchMessages()`:
  - Selects from `public.messages`.
  - Orders by `created_at DESC` (already correct for Inbox display needs).

**How `UnifiedInboxPage` Currently Uses Data:**
- Uses the real `Message[]` as its backing data.
- Applies in-memory mapping to add derived fields (status, type, default priority).
- Applies in-memory filters for:
  - Unread items (using derived status).
  - Type-based tabs (email/phone).

**How They Are Queried Together (if at all):**
- No additional joins or server-side aggregation are used for Inbox; everything is client-side behavior layered on top of `Message[]`.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- **None.**

**Non-Destructive Constraints:**
- Do not change `public.messages` schema.
- Do not change any existing migrations, indexes, or constraints.
- Preserve current server-side ordering by `created_at DESC`.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Continue to use the existing `useMessagesList()` / `fetchMessages()` path.
- Confirm (but do not change) that `fetchMessages()` orders by `created_at DESC`.
- Do **not** introduce any new query functions or parameters for Inbox semantics.

**Recommended Display Patterns:**
- Treat the Inbox as a **projection-only** view:
  - Cards are direct renderings of `Message` fields:
    - `from_name` → sender label.
    - `subject` → subject line (with optional fallback to content preview for display only, not inferred semantics).
    - `content` → body preview.
    - `created_at` → formatted timestamp.
    - `order_id` → optional order badge text only.
    - `priority` → optional badge only when truthy.
- Keep tabs (`All`, `Unread`, `Email`, `Phone`, etc.) and layout **visually** intact, but ensure that:
  - Tabs do not apply lifecycle or type-based filters.
  - Any tab-specific counts that implied semantics are removed or made purely presentational.

---

## Implementation Approach

### Phase 1: Remove Lifecycle Semantics from the View Model
- Delete any derived `status` field on the Inbox item view model that is computed from `message.is_read`.
- Remove all references to `status` from:
  - Unread badge counts.
  - Unread-only filters or tabs.
- Remove any direct references to `message.is_read` from `UnifiedInboxPage` (and related Inbox-only components).

### Phase 2: Neutralize Tab Behavior and Type Semantics
- Remove or neutralize filtering logic that depends on:
  - Derived or inferred `type` from `Message.type`.
  - Any fabricated default types (e.g. treating missing type as `email`).
- Keep the tab UI (buttons, labels) and layout unchanged, but:
  - Ensure all tabs show the same underlying `Message[]` projection.
  - If tab-specific filtering must remain for UX reasons, limit it to **non-semantic** concerns (e.g. simple client-side search text), not lifecycle or type.

### Phase 3: Remove Invented Defaults and Preserve Projection
- Stop defaulting `priority` to `'medium'` or any other value when `message.priority` is falsy.
- Only render a priority badge when `message.priority` is truthy, using the concrete value from the record.
- Ensure the Inbox item model used in `UnifiedInboxPage` is a **minimal projection**:
  - No extra fields beyond what is directly derived from `Message` for display formatting (e.g. formatted timestamp string).

### Phase 4: ConversationView Typing Only
- If `ConversationView` currently depends on the enriched Inbox view model:
  - Update its TypeScript props to accept the new, minimal projection type (or `Message` itself).
  - Do **not** change its rendering or runtime behavior beyond what is strictly required to satisfy the new type.
- Confirm that no new lifecycle behavior (e.g. mark-as-read) is added during refactor.

### Safety Considerations
- Changes must be **isolated to the Inbox module**, primarily `UnifiedInboxPage` and any local types used only there.
- Do not touch:
  - Orders APIs, hooks, or components.
  - Order-related message integrations (e.g. counts, sidebars).
- After implementation:
  - Run `npm run build` and `npm run lint` to ensure no type or lint errors.
  - Smoke test the Unified Inbox page to confirm:
    - Real messages still load and display.
    - Tabs render correctly but no longer encode lifecycle semantics.

---

## What NOT to Do

- **Do NOT** revert or remove the real-data wiring to `public.messages`.
- **Do NOT** introduce new Inbox behaviors such as:
  - Mark-as-read / mark-as-unread.
  - Archiving, deleting, or flagging messages.
  - Priority escalation or SLA timers.
- **Do NOT**:
  - Change database schema, migrations, or Supabase functions.
  - Add new API endpoints or React Query hooks.
  - Modify Orders-related components (`SortableOrdersTable`, `OrderDetailsSidebar`).
- **Do NOT** change the visual layout, spacing, or component structure of the Inbox UI.

---

## Open Questions / Considerations

- Should tabs remain purely cosmetic (all showing the same dataset), or should they be reinterpreted later with explicit, well-defined semantics in a future phase?
- Is there any existing or planned global Inbox domain model that this projection should explicitly align with in the future?
- Are there analytics or tracking requirements that depend on unread or type-based semantics, which should instead be implemented separately from this projection layer?

