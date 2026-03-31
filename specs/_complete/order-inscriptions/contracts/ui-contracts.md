# UI Contracts: Order Inscriptions

---

## Inscription Fieldset (shared pattern — used in both drawers)

```tsx
{/* Inscription */}
<div className="space-y-4">
  <h3 className="text-sm font-semibold">Inscription</h3>

  {/* 1. Inscription Text */}
  <FormField
    control={form.control}
    name="inscription_text"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Inscription Text</FormLabel>
        <FormControl>
          <Textarea
            placeholder="Name, dates, epitaph…"
            rows={4}
            value={field.value ?? ''}
            onChange={(e) => field.onChange(e.target.value || null)}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />

  {/* 2. Additional Lines */}
  <FormField
    control={form.control}
    name="inscription_additional"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Additional Lines</FormLabel>
        <FormControl>
          <Textarea
            placeholder="Verse, symbols, additional text…"
            rows={2}
            value={field.value ?? ''}
            onChange={(e) => field.onChange(e.target.value || null)}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />

  {/* 3. Font Style */}
  <FormField
    control={form.control}
    name="inscription_font"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Font Style</FormLabel>
        <Select
          onValueChange={(val) => {
            field.onChange(val || null);
            // Clear the custom font when switching away from "Other"
            if (val !== 'Other') {
              form.setValue('inscription_font_other', '');
            }
          }}
          value={field.value ?? ''}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select font style (optional)" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {INSCRIPTION_FONT_OPTIONS.map((font) => (
              <SelectItem key={font} value={font}>{font}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />

  {/* 4. Font — Other (conditional) */}
  {showFontOther && (
    <FormField
      control={form.control}
      name="inscription_font_other"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Font — Other</FormLabel>
          <FormControl>
            <Input
              placeholder="Specify font name…"
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || null)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )}

  {/* 5. Layout / Position */}
  <FormField
    control={form.control}
    name="inscription_layout"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Layout / Position</FormLabel>
        <FormControl>
          <Input
            placeholder="e.g. Centred, top third of stone"
            value={field.value ?? ''}
            onChange={(e) => field.onChange(e.target.value || null)}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</div>
```

**`showFontOther` derivation** (add near top of component body, after `form` declaration):

```ts
const watchedFont = form.watch('inscription_font');
const showFontOther = watchedFont === 'Other';
```

---

## ProofGenerateForm — font dropdown update

Replace the existing hardcoded font options (`serif`, `sans-serif`, `script`) with `INSCRIPTION_FONT_OPTIONS`:

```tsx
<SelectContent>
  <SelectItem value="">No preference</SelectItem>
  {INSCRIPTION_FONT_OPTIONS.map((font) => (
    <SelectItem key={font} value={font}>{font}</SelectItem>
  ))}
</SelectContent>
```

**New `defaultValues` for font_style**:

```ts
font_style: initialFontStyle ?? null,
```

---

## Insertion points in each form

### CreateOrderDrawer.tsx

- Insert Inscription `<div className="space-y-4">` block **after** the closing `</div>` of the Additional Options section (after line 773) and **before** `{/* Notes */}` (line 775).
- Add `INSCRIPTION_FONT_OPTIONS` import from `@/modules/orders`.
- Add `showFontOther` derivation after `form` declaration.
- Add 5 inscription fields to `defaultValues` in `useForm`.
- Add 5 inscription fields to submit payload object.

### EditOrderDrawer.tsx

- Insert Inscription `<div className="space-y-4">` block at the same relative position (after Additional Options, before Notes).
- Add `INSCRIPTION_FONT_OPTIONS` import from `@/modules/orders`.
- Add `showFontOther` derivation after `form` declaration.
- Add 5 inscription fields to `form.reset({...})` call.
- Add 5 inscription fields to submit payload object.

---

## OrderDetailsSidebar.tsx — ProofPanel prop change (ADDITIVE)

Only the two prop values change — no structural change to the component:

```tsx
// Before:
initialInscriptionText={
  inscriptions?.find((i) => i.type === 'front')?.inscription_text ?? null
}
// (no initialFontStyle prop existed)

// After:
initialInscriptionText={order.inscription_text ?? null}
initialFontStyle={order.inscription_font ?? null}
```

The `useInscriptionsByOrderId` hook and "Inscriptions" display card remain untouched.
