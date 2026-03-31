# Feature Specification: Order Inscriptions

**Feature Branch**: `feature/order-inscriptions`
**Created**: 2026-03-31
**Status**: Draft

---

## Context

An inscription is the text and formatting details engraved onto a memorial stone. Currently, staff have no structured way to record inscription details inside an order — they rely on free-text notes. This feature adds a dedicated Inscription section to the Order create and edit forms, storing inscription data directly on the order record. This data flows directly into the Proof Agent, allowing proof generation to be pre-populated without manual re-entry.

---

## User Scenarios & Testing

### User Story 1 — Staff Enters Inscription Details at Order Creation (Priority: P1)

When creating a new order, a staff member fills in the inscription details as part of the same form. They enter the main inscription text (name, dates, epitaph), optionally add additional lines (a verse or symbol instructions), choose a font style from a dropdown, and note the desired layout position. All fields are optional so the form can be submitted without inscription details if not yet known.

**Why this priority**: This is the primary entry point. If staff can't record inscription details at order creation, they must re-enter them later — duplicating effort.

**Independent Test**: Create a new order, fill in all five inscription fields, save. Open the saved order and confirm all five values are stored and displayed correctly.

**Acceptance Scenarios**:

1. **Given** the Order create form is open, **When** the staff member scrolls to the Inscription section, **Then** they see five clearly labelled fields: Inscription Text, Additional Lines, Font Style (dropdown), Font — Other (hidden), and Layout / Position.
2. **Given** Font Style = "Other" is selected, **When** the staff member views the form, **Then** the "Font — Other" free-text input becomes visible.
3. **Given** Font Style is anything other than "Other", **When** the staff member views the form, **Then** the "Font — Other" input is hidden.
4. **Given** all inscription fields are left empty, **When** the staff member submits the order, **Then** the order saves successfully (all inscription fields are optional).
5. **Given** inscription fields are filled, **When** the order is saved, **Then** all five values are persisted and visible when the order is reopened.

---

### User Story 2 — Staff Edits Inscription Details on an Existing Order (Priority: P1)

When editing an existing order, a staff member can update any inscription field. Changes are saved when the order is updated.

**Why this priority**: Inscription details frequently evolve between order creation and engraving. Staff must be able to refine them at any point.

**Independent Test**: Open an existing order with no inscription data; add inscription details; save. Re-open and confirm the values appear. Then edit one field; save again; confirm the update is reflected.

**Acceptance Scenarios**:

1. **Given** an existing order with inscription data, **When** the staff member opens the edit form, **Then** the Inscription section is pre-populated with the existing values.
2. **Given** an existing order with no inscription data, **When** the staff member opens the edit form, **Then** the Inscription section fields are empty.
3. **Given** Font Style was previously "Times New Roman" and staff changes it to "Other" and types a custom font, **When** the order is saved, **Then** both the font style ("Other") and the custom font text are persisted.
4. **Given** staff clears all inscription fields, **When** the order is saved, **Then** all five fields are stored as empty / null (no validation error).

---

### User Story 3 — Proof Generation Pre-Populates from Order Inscription (Priority: P1)

When a staff member initiates proof generation from the Order detail view, the Proof Generate form is pre-populated with the inscription text and font style from the order's inscription fields — removing the need to re-enter this data.

**Why this priority**: This is the primary downstream consumer of the inscription data. Without this integration, the feature delivers no time-saving for the proof workflow.

**Independent Test**: On an order with `inscription_text = "In Loving Memory of John Smith"` and `inscription_font = "Palatino"`, open the Proof Panel and click Generate. The ProofGenerateForm must show the inscription text and font pre-populated from the order.

**Acceptance Scenarios**:

1. **Given** an order with `inscription_text` and `inscription_font` set, **When** the staff member opens the Proof Panel, **Then** the ProofGenerateForm shows those values pre-populated.
2. **Given** `inscription_font = "Other"` and `inscription_font_other = "Comic Sans"`, **When** the ProofGenerateForm opens, **Then** the font style field shows "Other" and the custom font value is included in the generation context.
3. **Given** an order with no inscription fields set, **When** the ProofGenerateForm opens, **Then** the inscription text and font fields are empty (staff enters them manually).
4. **Given** the order's inscription data has changed since the last proof was generated, **When** staff opens the ProofGenerateForm for a new proof, **Then** the freshly read order values are used — not cached stale data.

---

### Edge Cases

- What happens if `inscription_text` contains special characters (quotes, apostrophes, non-ASCII)? The text field accepts any valid text content; the form does not restrict character input.
- What happens if staff selects "Other" for font but leaves the custom font input empty? The order saves with `inscription_font = "Other"` and `inscription_font_other = null`; no validation error (both fields are optional).
- What happens when a very long inscription is entered? The field accepts free-form text without a length limit; display truncation (if any) is a UI concern, not a data constraint.
- What happens if the Proof Panel is opened before inscription data exists on the order? The ProofGenerateForm renders with empty pre-populated values; staff must enter inscription details manually before generating.

---

## Requirements

### Functional Requirements

- **FR-001**: The Order create form MUST include an "Inscription" section with five fields: Inscription Text (textarea), Additional Lines (textarea), Font Style (dropdown), Font — Other (conditional text input), and Layout / Position (text input).
- **FR-002**: The Order edit form MUST include the same Inscription section, pre-populated with any existing inscription values from the order being edited.
- **FR-003**: The Font Style dropdown MUST offer exactly these options: Times New Roman, Arial, Palatino, Garamond, Script, Block, Old English, Other.
- **FR-004**: The "Font — Other" text input MUST be visible only when Font Style is set to "Other"; it MUST be hidden (and its value cleared) when any other font style is selected.
- **FR-005**: All five inscription fields MUST be optional — the Order create and edit forms MUST submit successfully when all inscription fields are left empty.
- **FR-006**: Inscription data MUST be saved on the order record when the Order form is submitted; it MUST be retrievable when the order is subsequently opened for editing.
- **FR-007**: The Proof Generate form MUST pre-populate its inscription text field from the order's `inscription_text` value.
- **FR-008**: The Proof Generate form MUST pre-populate its font style field from the order's `inscription_font` and `inscription_font_other` values.
- **FR-009**: The pre-population path for inscription data in the Proof Panel MUST read directly from the order record, not from any separate inscriptions table.

### Architectural Constraints

- **AC-001 (Module boundaries)**: All inscription field additions to the Order form MUST live inside `src/modules/orders/` (create/edit drawers, type, schema). No cross-module deep imports.
- **AC-002 (RLS)**: No new RLS policies are required — the new columns inherit the existing orders table RLS policies unchanged.
- **AC-003 (No new table)**: Inscription data MUST be stored as columns on the existing `orders` table. No new table, no new FK relationships.
- **AC-004 (Additive schema)**: The migration MUST use `ADD COLUMN IF NOT EXISTS` so it is safe to run on a database where the columns may already exist.

### Key Entities

- **Order** (existing): Gains five new optional text columns: `inscription_text`, `inscription_font`, `inscription_font_other`, `inscription_layout`, `inscription_additional`. All nullable; all default to null.
- **OrderFormSchema** (existing Zod schema): Gains five new optional string fields mirroring the new DB columns.
- **Order TypeScript interface** (existing): Gains five new optional `string | null` properties.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Staff can enter all five inscription fields within the existing Order create or edit flow without navigating to a separate page or form — the entire inscription entry takes under 60 seconds for a typical inscription.
- **SC-002**: Inscription data entered during order creation is reflected in the ProofGenerateForm pre-population 100% of the time — zero cases where the proof form shows empty inscription fields for an order that has them set.
- **SC-003**: The Order create and edit forms continue to submit without errors after the inscription section is added — zero regressions in the existing order save flow.
- **SC-004**: Switching Font Style to "Other" and back to a named style within a single form session does not persist the custom font text — the "Font — Other" field is cleared when a named font is re-selected.

---

## Assumptions

- The Order create form is `CreateOrderDrawer.tsx` and the Order edit form is `EditOrderDrawer.tsx`; both are separate components requiring the Inscription section to be added independently (codebase confirmed).
- The `Order` TypeScript interface is defined in `src/modules/orders/types/orders.types.ts` and the Zod validation schema in `src/modules/orders/schemas/order.schema.ts` (codebase confirmed).
- `proof-generate` (Edge Function) accepts inscription data via request body and does NOT query the inscriptions table; no changes to the edge function are required. The only change needed is updating `OrderDetailsSidebar.tsx` to read `order.inscription_text` / `order.inscription_font` instead of the `inscriptions` table query result when passing props to `ProofPanel` (codebase confirmed).
- No existing font/style preference field exists on Product or Memorial records; no alignment with other entities is needed (codebase confirmed).
- Inscription data is staff-entered only; no customer-facing inscription entry is required for MVP.
- All five new fields are nullable with no default values; existing orders with no inscription data are unaffected by the migration.
