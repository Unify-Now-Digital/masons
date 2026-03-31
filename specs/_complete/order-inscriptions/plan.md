# Implementation Plan: Order Inscriptions

**Branch**: `feature/order-inscriptions` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/_active/order-inscriptions/spec.md`

---

## Summary

Add five nullable inscription columns to the existing `orders` table, expose them in the `Order` TypeScript type and `orderFormSchema`, add an "Inscription" fieldset to both `CreateOrderDrawer` and `EditOrderDrawer`, and fix the `OrderDetailsSidebar` pre-population path to read inscription data directly from the order record instead of a separate inscriptions table query.

---

## Technical Context

**Language/Version**: TypeScript 5.5 (frontend), Deno (edge functions — no changes needed)
**Primary Dependencies**: React 18, Vite, Tailwind, shadcn/ui, React Hook Form + Zod
**Storage**: Supabase Postgres (additive ALTER TABLE only — no new RLS)
**Testing**: Manual verification via quickstart.md
**Target Platform**: Web browser, desktop-primary staff tool
**Constraints**: No Supabase CLI; no new dependencies; additive-only changes to existing forms; all five inscription fields are optional; `proof-generate` edge function untouched

---

## Constitution Check

| Gate | Status | Notes |
|------|--------|-------|
| Dual router constraint | ✅ Pass | No routing changes |
| Module boundaries | ✅ Pass | All changes stay inside `src/modules/orders/` + one additive prop update in `OrderDetailsSidebar.tsx` |
| Supabase + RLS | ✅ Pass | New columns inherit existing orders table RLS; no new policies |
| Secrets stay server-side | ✅ Pass | No server-side changes at all |
| Additive-first | ✅ Pass | `IF NOT EXISTS` migration; form sections appended; no existing fields touched |

---

## Project Structure

### Documentation (this feature)

```text
specs/_active/order-inscriptions/
├── plan.md              ← this file
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── ui-contracts.md
```

### Source Code (affected files)

```text
supabase/migrations/
└── 20260331130000_add_inscription_columns_to_orders.sql   NEW

src/modules/orders/
├── types/orders.types.ts          MODIFIED — 5 new optional fields on Order interface
├── schemas/order.schema.ts        MODIFIED — 5 new optional Zod fields
├── components/
│   ├── CreateOrderDrawer.tsx      MODIFIED — Inscription section + submit payload
│   └── EditOrderDrawer.tsx        MODIFIED — Inscription section + form.reset + submit payload

src/modules/orders/components/OrderDetailsSidebar.tsx      MODIFIED — pre-population fix
src/modules/proofs/components/ProofPanel.tsx               MODIFIED — add initialFontStyle prop
src/modules/proofs/components/ProofGenerateForm.tsx        MODIFIED — accept + use initialFontStyle prop
```

---

## Phase 0: Research Findings

See [research.md](./research.md) for full analysis. Summary:

1. **CreateOrderDrawer form structure**: Sections are `<div className="space-y-4">` with `<h3 className="text-sm font-semibold">` headers. The Inscription section slots between "Additional Options" and "Notes" — matching the logical workflow order. Fields use `Form / FormField / FormItem / FormLabel / FormControl / FormMessage` pattern throughout.

2. **EditOrderDrawer form reset**: `form.reset({...})` at line 216 hydrates every form field from `order.*`. The five inscription fields must be added to this reset call: `inscription_text: order.inscription_text || ''`, etc. The submit payload (line ~380) must also include all five fields.

3. **Font "Other" conditional visibility**: No special state management needed — use `form.watch('inscription_font')` to compute `showFontOther = watchedFont === 'Other'` and conditionally render the "Font — Other" input. When font switches away from "Other", the `inscription_font_other` value should be cleared via `form.setValue('inscription_font_other', '')` in the `onChange` handler.

4. **`OrderDetailsSidebar` pre-population gap**: Currently passes `inscriptions?.find((i) => i.type === 'front')?.inscription_text ?? null` to `ProofPanel.initialInscriptionText`. Change to `order.inscription_text ?? null`. Additionally, `ProofPanel` has no `initialFontStyle` prop — this prop needs adding (along with `ProofGenerateForm.initialFontStyle`) so font style is also pre-populated for FR-008.

5. **Submit payload pattern**: Optional string fields are mapped as `fieldName: data.fieldName?.trim() || null`. This is the existing pattern used for `renovation_service_description`.

6. **`inscriptions` table query in OrderDetailsSidebar**: The sidebar still fetches the `inscriptions` table (line 51 via `useInscriptionsByOrderId`) to display the existing "Inscriptions" display card (lines 711–744). This display card is separate from the `ProofPanel` section and should remain untouched. Only the `ProofPanel` prop argument (line 762) needs updating; the rest of the `inscriptions` fetch and display logic stays.

---

## Phase 1: Design

### Core Decisions

1. **Inscription section placement**: Between "Additional Options" and "Notes" in both forms. This matches the natural workflow: staff configure pricing options first, then record the inscription details, then add general notes.

2. **Font "Other" field**: Use `form.watch('inscription_font')` (not separate `useState`). Avoids state duplication and stays consistent with the codebase pattern of driving conditional fields from form state.

3. **Form default values** (CreateOrderDrawer): All five fields default to `''` (empty string), consistent with how other optional text fields default in `CreateOrderDrawer`.

4. **Form reset** (EditOrderDrawer): Map `order.inscription_text || ''`, `order.inscription_font || ''`, etc. — same pattern as `order.material || ''`.

5. **Submit payload**: `inscription_text: data.inscription_text?.trim() || null` — same pattern as `renovation_service_description`.

6. **ProofPanel `initialFontStyle` prop**: New optional prop added alongside existing `initialInscriptionText`. `ProofGenerateForm` receives it as `initialFontStyle?: string | null` and uses it to seed `font_style` in `defaultValues`. If `inscription_font === 'Other'`, pass `inscription_font_other` as a separate note in `additional_instructions` pre-population (or concatenated with any existing additional instructions).
