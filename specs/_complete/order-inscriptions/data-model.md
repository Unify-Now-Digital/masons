# Data Model: Order Inscriptions

---

## 1. Migration SQL — paste-ready for Supabase dashboard

```sql
-- ============================================================
-- Migration: add_inscription_columns_to_orders
-- Apply via: Supabase dashboard → SQL editor
-- Adds 5 nullable inscription columns to the existing orders
-- table. All columns inherit existing orders table RLS.
-- ============================================================

alter table public.orders
  add column if not exists inscription_text       text,
  add column if not exists inscription_font       text,
  add column if not exists inscription_font_other text,
  add column if not exists inscription_layout     text,
  add column if not exists inscription_additional text;
```

No indexes, no constraints, no triggers, no RLS changes. Pure additive column additions.

---

## 2. TypeScript — Order interface additions

**File**: `src/modules/orders/types/orders.types.ts`

Add to the existing `Order` interface (after `notes: string | null`):

```ts
// Inscription details for engraving
inscription_text?: string | null;
inscription_font?: string | null;
inscription_font_other?: string | null;
inscription_layout?: string | null;
inscription_additional?: string | null;
```

No changes to `OrderInsert`, `OrderUpdate`, or `OrderPerson`. The `Omit<Order, 'id' | 'created_at' | 'updated_at'>` for `OrderInsert` automatically includes the new fields.

---

## 3. Zod schema additions

**File**: `src/modules/orders/schemas/order.schema.ts`

Add to `orderFormSchema` (after `notes`):

```ts
// Inscription details
inscription_text: z.string().optional().nullable(),
inscription_font: z.string().optional().nullable(),
inscription_font_other: z.string().optional().nullable(),
inscription_layout: z.string().optional().nullable(),
inscription_additional: z.string().optional().nullable(),
```

---

## 4. Font style options (canonical list)

Used in both the Inscription fieldset Select and `ProofGenerateForm` Select:

```ts
export const INSCRIPTION_FONT_OPTIONS = [
  'Times New Roman',
  'Arial',
  'Palatino',
  'Garamond',
  'Script',
  'Block',
  'Old English',
  'Other',
] as const;

export type InscriptionFont = typeof INSCRIPTION_FONT_OPTIONS[number];
```

Define in `src/modules/orders/schemas/order.schema.ts` or a shared location imported by both the order form and `ProofGenerateForm`. Since `ProofGenerateForm` lives in `src/modules/proofs/`, a simple re-export from the order schema is cleanest:
- Define in `order.schema.ts`
- Re-export from `src/modules/orders/index.ts`
- Import in `ProofGenerateForm.tsx` via `@/modules/orders`

---

## 5. Form default values

### CreateOrderDrawer — add to `useForm` defaultValues:

```ts
inscription_text: '',
inscription_font: '',
inscription_font_other: '',
inscription_layout: '',
inscription_additional: '',
```

### EditOrderDrawer — add to `form.reset({...})`:

```ts
inscription_text: order.inscription_text || '',
inscription_font: order.inscription_font || '',
inscription_font_other: order.inscription_font_other || '',
inscription_layout: order.inscription_layout || '',
inscription_additional: order.inscription_additional || '',
```

---

## 6. Submit payload additions

Add to both `CreateOrderDrawer` and `EditOrderDrawer` order data objects:

```ts
inscription_text: data.inscription_text?.trim() || null,
inscription_font: data.inscription_font?.trim() || null,
inscription_font_other: data.inscription_font_other?.trim() || null,
inscription_layout: data.inscription_layout?.trim() || null,
inscription_additional: data.inscription_additional?.trim() || null,
```

---

## 7. ProofPanel + ProofGenerateForm prop additions

### ProofPanel — new prop

```ts
// In ProofPanelProps interface:
initialFontStyle?: string | null;

// Pass through to ProofGenerateForm:
<ProofGenerateForm
  orderId={orderId}
  initialInscriptionText={initialInscriptionText}
  initialStonePhotoUrl={initialStonePhotoUrl}
  initialFontStyle={initialFontStyle}   // NEW
  ...
/>
```

### ProofGenerateForm — new prop

```ts
// In ProofGenerateFormProps interface:
initialFontStyle?: string | null;

// In defaultValues:
defaultValues: {
  inscription_text: initialInscriptionText ?? '',
  stone_photo_url: initialStonePhotoUrl ?? '',
  font_style: initialFontStyle ?? null,  // was: null (hardcoded)
  additional_instructions: ...,
}
```

### OrderDetailsSidebar — updated ProofPanel call

```tsx
<ProofPanel
  orderId={order.id}
  initialInscriptionText={order.inscription_text ?? null}   // was: inscriptions?.find(...)
  initialStonePhotoUrl={order.product_photo_url ?? null}
  customerEmail={order.customer_email ?? null}
  customerPhone={order.customer_phone ?? null}
  initialFontStyle={order.inscription_font ?? null}         // NEW
/>
```
