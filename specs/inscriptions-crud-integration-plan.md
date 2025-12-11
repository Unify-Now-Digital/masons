# Implementation Plan: Inscriptions Module (Phase 1)

**Branch:** `feature/inscriptions-crud-integration`  
**Specification:** `specs/inscriptions-crud-integration-plan.md`

---

## Overview

Create a new Inscriptions CRUD module for managing inscription items for memorial orders. Each Order can have multiple inscriptions (front, back, side, plaque, additional, etc.). Each inscription has its own workflow status (pending → proofing → approved → engraving → completed → installed). Phase 1 includes no file upload, only a text proof_url field.

**Database Schema:** Already created in Supabase - `public.inscriptions` table exists with all required fields.

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Create inscription schema | Create | `src/modules/inscriptions/schemas/inscription.schema.ts` | High | None |
| 2 | Create data transform utils | Create | `src/modules/inscriptions/utils/inscriptionTransform.ts` | High | None |
| 3 | Create CRUD hooks | Create | `src/modules/inscriptions/hooks/useInscriptions.ts` | High | None |
| 4 | Create CreateInscriptionDrawer | Create | `src/modules/inscriptions/components/CreateInscriptionDrawer.tsx` | High | Tasks 1-3 |
| 5 | Create EditInscriptionDrawer | Create | `src/modules/inscriptions/components/EditInscriptionDrawer.tsx` | High | Tasks 1-3 |
| 6 | Create DeleteInscriptionDialog | Create | `src/modules/inscriptions/components/DeleteInscriptionDialog.tsx` | High | Task 3 |
| 7 | Build InscriptionsPage | Create | `src/modules/inscriptions/pages/InscriptionsPage.tsx` | High | Tasks 1-6 |
| 8 | Add module barrel | Create | `src/modules/inscriptions/index.ts` | Medium | Tasks 1-7 |
| 9 | Update router | Update | `src/app/router.tsx` | High | Task 8 |
| 10 | Update sidebar nav | Update | `src/app/layout/AppSidebar.tsx` | High | Task 8 |
| 11 | Validate build & lint | Verify | - | High | Tasks 1-10 |

---

## Task 1: Create Inscription Schema

**File:** `src/modules/inscriptions/schemas/inscription.schema.ts`  
**Action:** CREATE

**Content requirements:**
- Export `inscriptionFormSchema` using Zod.
- Required fields:
  - `orderId` (required, UUID string) - MUST belong to an Order
  - `inscriptionText` (required, trimmed, min length 1)
  - `type` (required enum: 'front' | 'back' | 'side' | 'plaque' | 'additional')
  - `status` (required enum: 'pending' | 'proofing' | 'approved' | 'engraving' | 'completed' | 'installed', default 'pending')
- Optional fields:
  - `style` (optional, trimmed string or null)
  - `color` (optional enum: 'gold' | 'silver' | 'white' | 'black' | 'natural' | 'other' or null)
  - `proofUrl` (optional, string URL format or null)
  - `engravedBy` (optional, trimmed string or null)
  - `engravedDate` (optional, string date format or null)
  - `notes` (optional, trimmed string or null)
- Allow empty string for optional string fields via `.optional().or(z.literal(''))`.
- Export `InscriptionFormData = z.infer<typeof inscriptionFormSchema>`.

**Schema Definition:**
```typescript
export const inscriptionFormSchema = z.object({
  orderId: z.string().uuid('Order is required'),
  inscriptionText: z.string().trim().min(1, 'Inscription text is required'),
  type: z.enum(['front', 'back', 'side', 'plaque', 'additional'], {
    errorMap: () => ({ message: 'Inscription type is required' }),
  }),
  style: z.string().trim().optional().or(z.literal('')),
  color: z.enum(['gold', 'silver', 'white', 'black', 'natural', 'other']).optional().nullable(),
  proofUrl: z.string().url('Invalid URL format').optional().or(z.literal('')).nullable(),
  status: z.enum(['pending', 'proofing', 'approved', 'engraving', 'completed', 'installed']).default('pending'),
  engravedBy: z.string().trim().optional().or(z.literal('')),
  engravedDate: z.string().optional().nullable(),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type InscriptionFormData = z.infer<typeof inscriptionFormSchema>;
```

**Note:** For `proofUrl`, we use `.url()` validation when non-empty, but allow empty string or null. The `.optional().or(z.literal('')).nullable()` pattern handles all cases.

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/inscriptions/utils/inscriptionTransform.ts`  
**Action:** CREATE

**Requirements:**
- Define `UIInscription` interface (camelCase) with all fields in camelCase format.
- Export functions:
  - `transformInscriptionFromDb(inscription)` → camelCase fields (`order_id` → `orderId`, `inscription_text` → `inscriptionText`, `engraved_date` → `engravedDate`, etc.).
  - `transformInscriptionsFromDb(inscriptions)` → array map wrapper.
  - `toInscriptionInsert(form: InscriptionFormData)` → snake_case payload for Supabase insert (omit id/timestamps, normalize empty strings to `null` for optional fields, convert dates to ISO format or null).
  - `toInscriptionUpdate(form: InscriptionFormData)` → partial update payload with same normalization.
- Keep helpers pure; no Supabase imports.

**UIInscription Interface:**
```typescript
export interface UIInscription {
  id: string;
  orderId: string;
  inscriptionText: string;
  type: 'front' | 'back' | 'side' | 'plaque' | 'additional';
  style: string | null;
  color: 'gold' | 'silver' | 'white' | 'black' | 'natural' | 'other' | null;
  proofUrl: string | null;
  status: 'pending' | 'proofing' | 'approved' | 'engraving' | 'completed' | 'installed';
  engravedBy: string | null;
  engravedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**Transform Functions:**
```typescript
const normalizeOptional = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export function transformInscriptionFromDb(inscription: Inscription): UIInscription {
  return {
    id: inscription.id,
    orderId: inscription.order_id,
    inscriptionText: inscription.inscription_text,
    type: inscription.type,
    style: inscription.style || null,
    color: inscription.color || null,
    proofUrl: inscription.proof_url || null,
    status: inscription.status,
    engravedBy: inscription.engraved_by || null,
    engravedDate: inscription.engraved_date || null,
    notes: inscription.notes || null,
    createdAt: inscription.created_at,
    updatedAt: inscription.updated_at,
  };
}

export function transformInscriptionsFromDb(inscriptions: Inscription[]): UIInscription[] {
  return inscriptions.map(transformInscriptionFromDb);
}

export function toInscriptionInsert(form: InscriptionFormData): InscriptionInsert {
  return {
    order_id: form.orderId,
    inscription_text: form.inscriptionText.trim(),
    type: form.type,
    style: normalizeOptional(form.style),
    color: form.color || null,
    proof_url: normalizeOptional(form.proofUrl),
    status: form.status,
    engraved_by: normalizeOptional(form.engravedBy),
    engraved_date: normalizeOptional(form.engravedDate),
    notes: normalizeOptional(form.notes),
  };
}

export function toInscriptionUpdate(form: InscriptionFormData): InscriptionUpdate {
  return {
    order_id: form.orderId,
    inscription_text: form.inscriptionText.trim(),
    type: form.type,
    style: normalizeOptional(form.style),
    color: form.color || null,
    proof_url: normalizeOptional(form.proofUrl),
    status: form.status,
    engraved_by: normalizeOptional(form.engravedBy),
    engraved_date: normalizeOptional(form.engravedDate),
    notes: normalizeOptional(form.notes),
  };
}
```

---

## Task 3: Create CRUD Hooks

**File:** `src/modules/inscriptions/hooks/useInscriptions.ts`  
**Action:** CREATE

**Requirements:**
- Use TanStack Query + Supabase client from `@/shared/lib/supabase`.
- Define query keys: 
  ```typescript
  inscriptionsKeys = {
    all: ['inscriptions'] as const,
    byOrder: (orderId: string) => ['inscriptions', 'order', orderId] as const,
    detail: (id: string) => ['inscriptions', id] as const,
  }
  ```
- Implement hooks:
  - `useInscriptionsList(orderId?: string)` → 
    - If `orderId` provided: fetch inscriptions filtered by `order_id = orderId`, ordered by `created_at DESC`.
    - If not provided: fetch all inscriptions, ordered by `created_at DESC`.
  - `useInscription(id)` → fetch single (enabled when truthy).
  - `useCreateInscription()` → insert via Supabase; on success invalidate `inscriptionsKeys.all` and optionally `inscriptionsKeys.byOrder(orderId)` if orderId is known.
  - `useUpdateInscription()` → update by id; on success invalidate list + set detail cache.
  - `useDeleteInscription()` → delete by id; on success invalidate list.
- Shape Supabase interactions similar to orders/jobs API (throw on error, return typed rows).
- Types: create local `Inscription`/`InscriptionInsert`/`InscriptionUpdate` matching DB shape; export them for component use.

**Database Types:**
```typescript
export interface Inscription {
  id: string;
  order_id: string;
  inscription_text: string;
  type: 'front' | 'back' | 'side' | 'plaque' | 'additional';
  style: string | null;
  color: 'gold' | 'silver' | 'white' | 'black' | 'natural' | 'other' | null;
  proof_url: string | null;
  status: 'pending' | 'proofing' | 'approved' | 'engraving' | 'completed' | 'installed';
  engraved_by: string | null;
  engraved_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InscriptionInsert = Omit<Inscription, 'id' | 'created_at' | 'updated_at'>;
export type InscriptionUpdate = Partial<InscriptionInsert>;
```

**Hook Implementation:**
```typescript
async function fetchInscriptions(orderId?: string) {
  let query = supabase
    .from('inscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (orderId) {
    query = query.eq('order_id', orderId);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as Inscription[];
}

async function fetchInscription(id: string) {
  const { data, error } = await supabase
    .from('inscriptions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Inscription;
}

async function createInscription(inscription: InscriptionInsert) {
  const { data, error } = await supabase
    .from('inscriptions')
    .insert(inscription)
    .select()
    .single();
  
  if (error) throw error;
  return data as Inscription;
}

async function updateInscription(id: string, updates: InscriptionUpdate) {
  const { data, error } = await supabase
    .from('inscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Inscription;
}

async function deleteInscription(id: string) {
  const { error } = await supabase
    .from('inscriptions')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export function useInscriptionsList(orderId?: string) {
  return useQuery({
    queryKey: orderId ? inscriptionsKeys.byOrder(orderId) : inscriptionsKeys.all,
    queryFn: () => fetchInscriptions(orderId),
  });
}

export function useInscription(id: string) {
  return useQuery({
    queryKey: inscriptionsKeys.detail(id),
    queryFn: () => fetchInscription(id),
    enabled: !!id,
  });
}

export function useCreateInscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (inscription: InscriptionInsert) => createInscription(inscription),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.all });
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(data.order_id) });
    },
  });
}

export function useUpdateInscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: InscriptionUpdate }) => 
      updateInscription(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.all });
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(data.order_id) });
      queryClient.setQueryData(inscriptionsKeys.detail(data.id), data);
    },
  });
}

export function useDeleteInscription() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteInscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.all });
      // Note: We can't invalidate byOrder here since we don't have orderId
      // This is acceptable - the all query will refetch and include the updated list
    },
  });
}
```

---

## Task 4: Create CreateInscriptionDrawer Component

**File:** `src/modules/inscriptions/components/CreateInscriptionDrawer.tsx`  
**Action:** CREATE

**Key features:**
- Drawer UI from shared components; React Hook Form with `zodResolver(inscriptionFormSchema)`.
- Order dropdown:
  - Load orders from `useOrdersList()` hook (from Orders module).
  - Display format: "Order ID – Customer Name – Location" (or similar readable format).
  - `orderId` is required.
- Fields organized in sections:
  - **Required Fields:**
    - Order* (Select dropdown - required)
    - Type* (Select - required: front, back, side, plaque, additional)
    - Inscription Text* (Textarea - required, multi-line)
    - Status* (Select - required, default 'pending')
  - **Styling:**
    - Style (Input - optional, e.g., "Times New Roman", "Script")
    - Color (Select - optional: gold, silver, white, black, natural, other)
  - **Proof:**
    - Proof URL (Input - optional, URL format)
  - **Engraving:**
    - Engraved By (Input - optional)
    - Engraved Date (Date picker - optional)
  - **Notes:**
    - Notes (Textarea - optional)
- Submit calls `useCreateInscription`; use `toInscriptionInsert` for payload.
- Toast success/error; close on success; show loading state.
- Props: `open`, `onOpenChange`.

**Order Display Format:**
```typescript
{order.id} - {order.customer_name} - {order.location || 'No location'}
```

---

## Task 5: Create EditInscriptionDrawer Component

**File:** `src/modules/inscriptions/components/EditInscriptionDrawer.tsx`  
**Action:** CREATE

**Key features:**
- Same form + validation as Create drawer, prefilled from `inscription` prop (DB shape).
- Transform DB inscription to form data using transform utilities.
- Pre-fill all fields including dates (convert date strings to form format).
- Submit uses `useUpdateInscription`; payload via `toInscriptionUpdate`.
- Toast success/error; close on success.
- Props: `open`, `onOpenChange`, `inscription: Inscription`.

**Form Pre-fill:**
```typescript
const form = useForm<InscriptionFormData>({
  resolver: zodResolver(inscriptionFormSchema),
  defaultValues: {
    orderId: inscription.order_id,
    inscriptionText: inscription.inscription_text,
    type: inscription.type,
    style: inscription.style || '',
    color: inscription.color || null,
    proofUrl: inscription.proof_url || '',
    status: inscription.status,
    engravedBy: inscription.engraved_by || '',
    engravedDate: inscription.engraved_date || null,
    notes: inscription.notes || '',
  },
});
```

---

## Task 6: Create DeleteInscriptionDialog Component

**File:** `src/modules/inscriptions/components/DeleteInscriptionDialog.tsx`  
**Action:** CREATE

**Key features:**
- AlertDialog UI with confirmation copy including inscription text snippet and type.
- Uses `useDeleteInscription`; loading state on destructive button; toast success/error.
- Props: `open`, `onOpenChange`, `inscription: Inscription`.

**Dialog Content:**
```typescript
<AlertDialogDescription>
  Are you sure you want to delete the {inscription.type} inscription?
  <br />
  <strong>Snippet:</strong> "{inscription.inscription_text.substring(0, 50)}{inscription.inscription_text.length > 50 ? '...' : ''}"
  <br />
  This action cannot be undone.
</AlertDialogDescription>
```

---

## Task 7: Build InscriptionsPage

**File:** `src/modules/inscriptions/pages/InscriptionsPage.tsx`  
**Action:** CREATE

**Requirements:**
- Fetch data with `useInscriptionsList()` (no orderId filter for main page); transform via `transformInscriptionsFromDb`.
- UI sections:
  - Header with title "Inscriptions" + description "Manage inscription items for memorial orders".
  - Actions:
    - Search input (debounced) filtering by `inscriptionText`, `style`, `engravedBy`, and optionally order customer name if available.
    - Status filter dropdown: all / pending / proofing / approved / engraving / completed / installed.
    - Button "New Inscription" opens Create drawer.
  - Table listing inscriptions (similar styling to Orders/Jobs table) with columns:
    - Order (show order ID + customer name if available)
    - Type (badge or text)
    - Status (badge with color coding)
    - Color (if available)
    - Style (if available)
    - Engraved By (if available)
    - Engraved Date (formatted, or "Not engraved" if null)
    - Actions (Edit, Delete)
  - Row actions: Edit → opens Edit drawer with selected inscription; Delete → opens dialog.
- States:
  - Loading skeleton for table.
  - Empty state with CTA to create.
  - Error state with message + retry button (refetch).
- Toast on mutations handled in drawers/dialog.
- Keep module-local state for drawer/dialog open + selected inscription.

**Search Filter Logic:**
```typescript
const filteredInscriptions = useMemo(() => {
  if (!inscriptions) return [];
  
  let filtered = inscriptions;
  
  // Search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.inscriptionText.toLowerCase().includes(query) ||
        (i.style && i.style.toLowerCase().includes(query)) ||
        (i.engravedBy && i.engravedBy.toLowerCase().includes(query))
    );
  }
  
  // Status filter
  if (statusFilter !== 'all') {
    filtered = filtered.filter((i) => i.status === statusFilter);
  }
  
  return filtered;
}, [inscriptions, searchQuery, statusFilter]);
```

**Status Badge Colors:**
```typescript
const statusColors: Record<string, string> = {
  pending: 'bg-gray-500',
  proofing: 'bg-yellow-500',
  approved: 'bg-blue-500',
  engraving: 'bg-purple-500',
  completed: 'bg-green-500',
  installed: 'bg-green-600',
};
```

**Order Display Enhancement:**
- If order data is available (via join or separate query), show customer name.
- For Phase 1, showing order ID is acceptable; can be enhanced later.

---

## Task 8: Add Module Barrel

**File:** `src/modules/inscriptions/index.ts`  
**Action:** CREATE

**Exports:**
- `InscriptionsPage` from pages.
- Components: `CreateInscriptionDrawer`, `EditInscriptionDrawer`, `DeleteInscriptionDialog`.
- Hooks and types if required externally.

---

## Task 9: Update Router

**File:** `src/app/router.tsx`  
**Action:** UPDATE

**Change:** Add route under `/dashboard`:
```tsx
import { InscriptionsPage } from "@/modules/inscriptions";
...
<Route path="inscriptions" element={<InscriptionsPage />} />
```

---

## Task 10: Update Sidebar Navigation

**File:** `src/app/layout/AppSidebar.tsx`  
**Action:** UPDATE

**Change:** Add navigation item:
- Title: "Inscriptions"
- URL: `/dashboard/inscriptions`
- Icon: `Italic` or `Pencil` or `FileText` (lucide-react) - choose most appropriate
- Position: under operational section, near Orders/Memorials/Inscriptions.

**Icon Import:**
```tsx
import { Italic } from 'lucide-react';
// or
import { Pencil } from 'lucide-react';
// or
import { FileText } from 'lucide-react';
```

---

## Task 11: Validation & QA

**Actions:**
- `npm run lint` and `npm run build` (ensure no TS/ESLint errors).
- Manual flows:
  - Create inscription → appears in list; drawer closes; toast shows.
  - Edit inscription → changes reflected; drawer closes; toast shows.
  - Delete inscription → removed from list; dialog closes; toast shows.
  - Search/filter covers inscriptionText/style/engravedBy; empty state renders when no results.
  - Status filter works correctly.
  - Order dropdown loads and displays correctly.
  - Date fields format correctly (display and save).
  - Proof URL validation works (accepts valid URLs, rejects invalid).
  - Navigation link and route render without console errors.

---

## Target File Tree

```
src/modules/inscriptions/
├── components/
│   ├── CreateInscriptionDrawer.tsx
│   ├── EditInscriptionDrawer.tsx
│   └── DeleteInscriptionDialog.tsx
├── hooks/
│   └── useInscriptions.ts
├── pages/
│   └── InscriptionsPage.tsx
├── schemas/
│   └── inscription.schema.ts
├── utils/
│   └── inscriptionTransform.ts
└── index.ts
```

---

## Database Schema Reference

**Table:** `public.inscriptions` (already exists in Supabase)

**Fields:**
- `id` uuid PK
- `order_id` uuid NOT NULL FK → public.orders(id) ON DELETE CASCADE
- `inscription_text` text NOT NULL
- `type` text NOT NULL CHECK (type in ('front','back','side','plaque','additional'))
- `style` text NULL
- `color` text NULL CHECK (color in ('gold','silver','white','black','natural','other'))
- `proof_url` text NULL
- `status` text NOT NULL DEFAULT 'pending' CHECK (status in ('pending','proofing','approved','engraving','completed','installed'))
- `engraved_by` text NULL
- `engraved_date` date NULL
- `notes` text NULL
- `created_at` timestamptz DEFAULT now()
- `updated_at` timestamptz DEFAULT now()

**Note:** Table already exists - no migration needed.

---

## Validation Checklist

- [ ] Routes include `/dashboard/inscriptions` and render without errors.
- [ ] Sidebar shows "Inscriptions" with appropriate icon and active state.
- [ ] Zod schema enforces required fields: orderId, inscriptionText, type, status.
- [ ] Optional fields accept empty strings; payload normalizes to `null`.
- [ ] Date fields (engravedDate) format correctly for display and database.
- [ ] Proof URL validation works (accepts valid URLs when provided).
- [ ] Query keys invalidate on create/update/delete; list refetches.
- [ ] `useInscriptionsList(orderId)` filters correctly when orderId provided.
- [ ] Drawers/dialog close on success; toasts fire for success/error.
- [ ] Loading, empty, and error states render correctly.
- [ ] Search filters inscriptionText/style/engravedBy in-memory on fetched data.
- [ ] Status filter works correctly (pending/proofing/approved/engraving/completed/installed/all).
- [ ] Table displays order info correctly (order ID + customer if available).
- [ ] Type field displays correctly (front/back/side/plaque/additional).
- [ ] Status badges display with correct colors.
- [ ] Engraved date displays formatted or "Not engraved" if null.
- [ ] Order dropdown loads from useOrdersList and displays readable format.
- [ ] All imports use `@/` aliases; no relative cross-module leaks.
- [ ] `npm run lint` and `npm run build` succeed.
- [ ] No TypeScript errors; all types properly exported.
- [ ] Transform functions correctly map dates (date strings ↔ form dates).
- [ ] Transform functions correctly map status and type enums.
- [ ] Transform functions correctly map color enum.
- [ ] No usage of `any` types.
- [ ] No changes to existing modules (Orders, Jobs, Memorials, Customers, Companies, Invoicing, Map).

---

## Success Criteria

✅ Inscriptions module delivers live Supabase CRUD with working drawers/dialog, searchable table with status filtering, route/sidebar integration, and clean build with no console errors. Query invalidation keeps list in sync after create/update/delete. Order dropdown displays readable format. Proof URL validation works. Inscription MUST belong to an Order (order_id required). Multiple inscriptions can exist per order.

---

## Implementation Notes

### Order Requirement
- Every inscription MUST have an `order_id` - this is enforced at the database level (NOT NULL constraint).
- The form should require order selection before allowing submission.
- Multiple inscriptions can belong to the same order (one-to-many relationship).

### Type Field
- Type enum: 'front' | 'back' | 'side' | 'plaque' | 'additional'
- Display with clear labels in Select dropdown.
- Can be shown as badge or text in table.

### Status Workflow
- Status enum: 'pending' | 'proofing' | 'approved' | 'engraving' | 'completed' | 'installed'
- Default: 'pending'
- Display with badge styling with color coding:
  - pending: gray
  - proofing: yellow
  - approved: blue
  - engraving: purple
  - completed: green
  - installed: dark green

### Color Field
- Color enum: 'gold' | 'silver' | 'white' | 'black' | 'natural' | 'other'
- Optional field (can be null).
- Display in table if available.

### Proof URL
- Phase 1: Simple text input for URL string (no file upload).
- URL validation when provided (Zod `.url()`).
- Can be empty or null.
- Future Phase 2: File upload integration.

### Engraving Fields
- `engravedBy`: Optional text field (engraver name).
- `engravedDate`: Optional date field.
- Display "Not engraved" if both are null.

### Query Key Strategy
- `inscriptionsKeys.all` - for all inscriptions list
- `inscriptionsKeys.byOrder(orderId)` - for filtering by order (useful for future Order detail pages)
- `inscriptionsKeys.detail(id)` - for single inscription
- Mutations invalidate both `all` and `byOrder` when orderId is known.

### Order Display
- In table, show order ID + customer name if available.
- For Phase 1, order ID is acceptable; can enhance with customer name lookup later.

---

*Specification created: Inscriptions Module Phase 1 CRUD Integration*  
*Ready for implementation via `/plan` command*

