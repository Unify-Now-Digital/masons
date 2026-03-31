# Research: Order Inscriptions

**Phase 0 — Codebase analysis**
**Date**: 2026-03-31

---

## 1. CreateOrderDrawer form structure and insertion point

**Decision**: Add Inscription section between "Additional Options" and "Notes" sections.

**Rationale**: Both sections end with a `</div>` wrapping a `<div className="space-y-4">`. The Inscription section follows the same `<div className="space-y-4">` + `<h3 className="text-sm font-semibold">` pattern. Confirmed insertion point: after line 773 (closing `</div>` of Additional Options section) and before line 775 (`{/* Notes */}`).

**Form field pattern** (from codebase):
```tsx
<FormField
  control={form.control}
  name="inscription_text"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Inscription Text</FormLabel>
      <FormControl>
        <Textarea
          placeholder="e.g. In Loving Memory of..."
          rows={4}
          value={field.value ?? ''}
          onChange={(e) => field.onChange(e.target.value || null)}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Select field pattern** (from existing material/color fields):
```tsx
<Select onValueChange={field.onChange} value={field.value ?? ''}>
  <FormControl>
    <SelectTrigger><SelectValue placeholder="Select font style" /></SelectTrigger>
  </FormControl>
  <SelectContent>
    <SelectItem value="Times New Roman">Times New Roman</SelectItem>
    ...
  </SelectContent>
</Select>
```

---

## 2. EditOrderDrawer form.reset() — where to add inscription fields

**Decision**: Add five inscription fields to `form.reset({...})` starting at line 216.

Pattern from existing optional string fields:
```ts
material: order.material || '',
color: order.color || '',
```

Inscription fields follow the same pattern:
```ts
inscription_text: order.inscription_text || '',
inscription_font: order.inscription_font || '',
inscription_font_other: order.inscription_font_other || '',
inscription_layout: order.inscription_layout || '',
inscription_additional: order.inscription_additional || '',
```

---

## 3. Font "Other" conditional field

**Decision**: Use `form.watch('inscription_font')` to derive `showFontOther` boolean. No separate `useState`.

**Rationale**: React Hook Form's `watch` is the idiomatic RHF pattern for conditional fields. The codebase already uses `form.watch` (e.g., `selectedOrderId = form.watch('order_ids')`). No extra state variable needed.

**Clear-on-switch**: When font value changes away from "Other", call `form.setValue('inscription_font_other', '')` in the `onValueChange` handler of the Select. This prevents stale custom font text from being submitted when a named font is later selected.

---

## 4. Submit payload — inscription fields

**Decision**: Map with `?.trim() || null` consistent with `renovation_service_description`.

Payload snippet (both CreateOrderDrawer and EditOrderDrawer):
```ts
inscription_text: data.inscription_text?.trim() || null,
inscription_font: data.inscription_font?.trim() || null,
inscription_font_other: data.inscription_font_other?.trim() || null,
inscription_layout: data.inscription_layout?.trim() || null,
inscription_additional: data.inscription_additional?.trim() || null,
```

---

## 5. OrderDetailsSidebar pre-population gap

**What currently happens**:
- Line 51: `useInscriptionsByOrderId(order.id)` fetches from the separate `inscriptions` table
- Line 762: `initialInscriptionText = inscriptions?.find((i) => i.type === 'front')?.inscription_text ?? null`
- `ProofPanel` receives this as the only inscription-related prop
- No `initialFontStyle` prop exists on `ProofPanel` or `ProofGenerateForm`

**What needs to change**:
1. Line 762: Change `initialInscriptionText` source to `order.inscription_text ?? null`
2. Add new `initialFontStyle` prop to `ProofPanel` → pass `order.inscription_font ?? null`
3. `ProofPanel` passes `initialFontStyle` to `ProofGenerateForm`
4. `ProofGenerateForm` uses it to seed `font_style` default value

**What stays unchanged**:
- Lines 33, 51, 719–744: The `useInscriptionsByOrderId` fetch and the "Inscriptions" display card remain completely unchanged — they serve a different purpose (showing the inscription record history)

---

## 6. ProofGenerateForm — font pre-population strategy

**Decision**: Add `initialFontStyle?: string | null` to `ProofGenerateForm` props and use it in `defaultValues.font_style`.

The font dropdown options in `ProofGenerateForm` are `'serif' | 'sans-serif' | 'script' | null` — these do NOT match the orders inscription font options (`'Times New Roman' | 'Arial' | 'Palatino'` etc.). This is a vocabulary mismatch.

**Resolution**: The `initialFontStyle` prop is passed through as-is to `ProofGenerateForm`. The ProofGenerateForm Select's `defaultValues.font_style` is set to the value if it matches one of the Select's `value` attributes, otherwise defaults to `null`. This means named fonts like `'Times New Roman'` won't match an existing Select option and will result in `null` default (user selects from form). Only if the inscription font happens to match one of `'serif'|'sans-serif'|'script'` would it pre-populate the dropdown.

**Better approach**: Expand `ProofGenerateForm`'s font_style dropdown to use the **same font options** as `order.inscription_font` (the 8 named options). This way the pre-population is a direct value match.

**Decision confirmed**: Update `ProofGenerateForm` font dropdown to use the same 8 font options as the inscription fieldset. The `proof-generate` edge function uses `font_style` in its OpenAI prompt, where any descriptive font name is valid text — no enum constraint on the edge function side.

---

## 7. What is NOT changing

| File / Area | Status |
|-------------|--------|
| `proof-generate` edge function | Untouched — reads from request body |
| `order_proofs` table | Untouched |
| `inscriptions` table and module | Untouched (fetch + display in sidebar remains) |
| Orders RLS policies | Untouched — new columns inherit existing policies |
| Orders API (`orders.api.ts`) | Untouched — Supabase `.insert()` and `.update()` pass through new fields automatically |
| `useOrders.ts` hooks | Untouched — `select('*')` already picks up new columns |
| `orderTransform.ts` | Untouched — no transform needed for new text fields |
