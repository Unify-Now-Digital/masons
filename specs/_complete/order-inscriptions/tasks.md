---
description: "Task list for Order Inscriptions"
---

# Tasks: Order Inscriptions

**Input**: Design documents from `specs/_active/order-inscriptions/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ui-contracts.md ✅

**Tests**: Not requested — manual verification via quickstart.md scenarios.

**Organization**: Phase 1 (DB) → Phase 2 (Types + schema — blocks all UI) → Phase 3 (Form UI) → Phase 4 (Proof wiring) → Phase 5 (Polish). US1 and US2 are both P1 and can run in parallel in Phase 3 (different files). US3 runs after types are in place.

## Path Conventions

- **Orders module**: `src/modules/orders/` (types/, schemas/, components/)
- **Proofs module**: `src/modules/proofs/components/`
- **Shared sidebar**: `src/modules/orders/components/OrderDetailsSidebar.tsx`
- **`INSCRIPTION_FONT_OPTIONS`**: defined ONCE in `src/modules/orders/schemas/order.schema.ts` — imported everywhere else; never duplicated

---

## Phase 1: Database Setup

**Purpose**: Apply the migration before any code runs against the new columns.

⚠️ **CRITICAL**: Apply this migration in the Supabase dashboard SQL editor before any other task.

- [x] T001 Apply migration — execute the single SQL block from `specs/_active/order-inscriptions/data-model.md §1` in the Supabase dashboard SQL editor: `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS inscription_text text, inscription_font text, inscription_font_other text, inscription_layout text, inscription_additional text;`

**Checkpoint**: Verify in Supabase Table Editor that `orders` table has all 5 new nullable text columns.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: TypeScript type, Zod schema, and module export that all three user story phases depend on.

⚠️ **CRITICAL**: T005, T006, T007, T008, T009 all depend on T002–T004 being complete.

- [x] T002 [P] Update `src/modules/orders/types/orders.types.ts` — add 5 new optional fields to the `Order` interface after `notes: string | null`: `inscription_text?: string | null; inscription_font?: string | null; inscription_font_other?: string | null; inscription_layout?: string | null; inscription_additional?: string | null;` — no changes to `OrderInsert`, `OrderUpdate`, or `OrderPerson`

- [x] T003 [P] Update `src/modules/orders/schemas/order.schema.ts` — (a) add `INSCRIPTION_FONT_OPTIONS` constant (exported) as `['Times New Roman', 'Arial', 'Palatino', 'Garamond', 'Script', 'Block', 'Old English', 'Other'] as const` with exported `InscriptionFont` type; (b) add 5 optional Zod fields to `orderFormSchema` after `notes`: `inscription_text: z.string().optional().nullable(), inscription_font: z.string().optional().nullable(), inscription_font_other: z.string().optional().nullable(), inscription_layout: z.string().optional().nullable(), inscription_additional: z.string().optional().nullable()`; ⚠️ `INSCRIPTION_FONT_OPTIONS` MUST be defined here and ONLY here

- [x] T004 Update `src/modules/orders/index.ts` — add `INSCRIPTION_FONT_OPTIONS` and `InscriptionFont` to the existing exports so other modules (`ProofGenerateForm`) can import via `@/modules/orders`; depends on T003

**Checkpoint**: `npm run build` — TypeScript compiles with 0 errors after T002–T004.

---

## Phase 3: User Story 1 + User Story 2 — Form UI (Priority: P1) 🎯 MVP

**Goal US1**: Staff can enter all 5 inscription fields in the Order create form and save them to the database.

**Goal US2**: Staff can view and edit inscription fields in the Order edit form; values pre-populate from the existing order record.

**Independent Test US1**: Quickstart Scenarios 1 and 5 — create an order with inscription fields; verify all 5 values saved; create with empty fields and verify no validation error.

**Independent Test US2**: Quickstart Scenarios 2 and 4 — edit inscription fields; verify pre-population; verify font-other lifecycle on switch.

### Implementation for User Story 1 — CreateOrderDrawer

- [x] T005 [US1] Update `src/modules/orders/components/CreateOrderDrawer.tsx` (ADDITIVE ONLY) — insert new Inscription `<div className="space-y-4">` block between the "Additional Options" closing `</div>` and the `{/* Notes */}` comment:
  (a) Import `INSCRIPTION_FONT_OPTIONS` from `@/modules/orders` (additive import);
  (b) Add `showFontOther` derivation via `form.watch`: `const watchedInscriptionFont = form.watch('inscription_font'); const showFontOther = watchedInscriptionFont === 'Other';` — NO useState;
  (c) Add 5 inscription fields to `useForm` `defaultValues`: `inscription_text: '', inscription_font: '', inscription_font_other: '', inscription_layout: '', inscription_additional: ''`;
  (d) Add 5 inscription fields to submit payload object: `inscription_text: data.inscription_text?.trim() || null, inscription_font: data.inscription_font?.trim() || null, inscription_font_other: data.inscription_font_other?.trim() || null, inscription_layout: data.inscription_layout?.trim() || null, inscription_additional: data.inscription_additional?.trim() || null`;
  (e) Render inscription fieldset JSX per `contracts/ui-contracts.md` (Inscription Text textarea, Additional Lines textarea, Font Style Select with `INSCRIPTION_FONT_OPTIONS`, conditional Font-Other Input when `showFontOther`, Layout/Position Input); clear `inscription_font_other` via `form.setValue('inscription_font_other', '')` when font changes away from 'Other'; depends on T003, T004

**Checkpoint US1**: Run Quickstart Scenarios 1 and 5 — create order with and without inscription data; all 5 values persist correctly.

### Implementation for User Story 2 — EditOrderDrawer

- [x] T006 [P] [US2] Update `src/modules/orders/components/EditOrderDrawer.tsx` (ADDITIVE ONLY) — insert identical Inscription fieldset between Additional Options and Notes:
  (a) Import `INSCRIPTION_FONT_OPTIONS` from `@/modules/orders` (additive import);
  (b) Add `showFontOther` derivation via `form.watch` — same as T005, NO useState;
  (c) Add 5 inscription fields to `form.reset({...})` call (hydration from `order.*`): `inscription_text: order.inscription_text || '', inscription_font: order.inscription_font || '', inscription_font_other: order.inscription_font_other || '', inscription_layout: order.inscription_layout || '', inscription_additional: order.inscription_additional || ''`;
  (d) Add 5 inscription fields to submit payload: same `?.trim() || null` pattern as `renovation_service_description`;
  (e) Render same inscription fieldset JSX as T005 (Inscription Text, Additional Lines, Font Style Select, conditional Font-Other, Layout/Position); depends on T003, T004

**Checkpoint US2**: Run Quickstart Scenarios 2, 3, and 4 — edit inscription fields; verify pre-population; verify Font Other clears on switch.

---

## Phase 4: User Story 3 — Proof Agent Wiring (Priority: P1)

**Goal**: ProofGenerateForm pre-populates inscription text and font style from the order's inscription fields when staff opens the Proof Panel.

**Independent Test**: Quickstart Scenario 3 — open ProofPanel on an order with inscription data; verify inscription text and font are pre-populated; verify font dropdown shows all 8 options.

### Implementation for User Story 3

- [x] T007 [P] [US3] Update `src/modules/proofs/components/ProofPanel.tsx` (ADDITIVE ONLY) — add `initialFontStyle?: string | null` to `ProofPanelProps` interface; pass it through to `ProofGenerateForm` as `initialFontStyle={initialFontStyle}`; no other changes; depends on T002

- [x] T008 [P] [US3] Update `src/modules/proofs/components/ProofGenerateForm.tsx` (ADDITIVE ONLY) — (a) import `INSCRIPTION_FONT_OPTIONS` from `@/modules/orders` (additive import — no duplication); (b) add `initialFontStyle?: string | null` to `ProofGenerateFormProps`; (c) update `defaultValues.font_style` to `initialFontStyle ?? null` (was hardcoded `null`); (d) replace existing hardcoded font options in the Select with `INSCRIPTION_FONT_OPTIONS.map(...)` per `contracts/ui-contracts.md §ProofGenerateForm`; depends on T003, T004

- [x] T009 [US3] Update `src/modules/orders/components/OrderDetailsSidebar.tsx` (ADDITIVE ONLY — inscription display card unchanged) — change line 762 `initialInscriptionText` prop value from `inscriptions?.find((i) => i.type === 'front')?.inscription_text ?? null` to `order.inscription_text ?? null`; add new `initialFontStyle={order.inscription_font ?? null}` prop to the `<ProofPanel>` call at line 759; the `useInscriptionsByOrderId` hook and the "Inscriptions" display card (lines 711–744) remain completely untouched; depends on T007

**Checkpoint US3**: Run Quickstart Scenario 3 — open ProofPanel on an order with `inscription_text` and `inscription_font` set; ProofGenerateForm shows both pre-populated; font dropdown contains all 8 options.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T010 Run `npm run build` from repo root and fix any TypeScript or ESLint errors introduced by T002–T009 — common issues: `INSCRIPTION_FONT_OPTIONS` imported but not used (if `ProofGenerateForm` Select was not updated), missing field in `orderFormSchema` causing type mismatch in form submit payload

---

## Dependencies & Execution Order

### Phase Dependencies

- **Database (Phase 1)**: No dependencies — apply immediately; not strictly blocking code changes but columns must exist before runtime testing
- **Foundational (Phase 2)**: Depends on Phase 1 for runtime; T002 and T003 are independent of each other [P]; T004 depends on T003
- **Form UI (Phase 3)**: T005 and T006 both depend on T002, T003, T004; they are [P] with each other (different files)
- **Proof wiring (Phase 4)**: T007 and T008 depend on T002/T003/T004; they are [P] with each other (different files); T009 depends on T007
- **Polish (Phase 5)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2. Independent of US2 and US3.
- **US2 (P1)**: Depends on Phase 2. Independent of US1 and US3. T006 can run in parallel with T005.
- **US3 (P1)**: Depends on Phase 2 (for type) and T004 (for `INSCRIPTION_FONT_OPTIONS` export). T007 and T008 can run in parallel with T005 and T006 (all depend on Phase 2, all touch different files).

### Parallel Opportunities

After Phase 2 complete (T002, T003, T004):

```bash
# These 4 tasks can all run in parallel (different files, same dependencies):
T005: CreateOrderDrawer.tsx — Inscription section (US1)
T006: EditOrderDrawer.tsx   — Inscription section (US2)
T007: ProofPanel.tsx        — initialFontStyle prop (US3)
T008: ProofGenerateForm.tsx — initialFontStyle + font dropdown (US3)
```

After T007 completes:

```bash
T009: OrderDetailsSidebar.tsx — ProofPanel prop values (US3, depends on T007)
```

---

## Implementation Strategy

### MVP First (all 3 stories are P1 — implement sequentially)

1. Apply database migration (T001)
2. Complete Phase 2 (T002, T003, T004) — CRITICAL gate
3. Complete Phase 3 (T005, T006) — staff can enter inscription data
4. **STOP AND VALIDATE**: Quickstart Scenarios 1, 2, 5
5. Complete Phase 4 (T007, T008, T009) — proof pre-population works
6. **STOP AND VALIDATE**: Quickstart Scenarios 3, 4, 6
7. Polish (T010)

### Key constraints to preserve

- `INSCRIPTION_FONT_OPTIONS` defined ONCE in `order.schema.ts`, imported everywhere else via `@/modules/orders`
- `showFontOther` MUST use `form.watch('inscription_font')` — no `useState`
- T009 MUST NOT touch the `useInscriptionsByOrderId` hook call or the Inscriptions display card — only the `<ProofPanel>` call's prop values
- All T005 / T006 / T007 / T008 / T009 changes are ADDITIVE — no existing form fields, sections, or logic modified
