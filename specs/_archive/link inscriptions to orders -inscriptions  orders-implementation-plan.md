# Implementation Plan: Link Inscriptions to Orders

## Feature Overview

Allow an Inscription to optionally link to an Order via `inscriptions.order_id`, selectable in the Inscription create/edit UI, and show linked inscriptions in the Order details sidebar.

**Branch:** `feature/link-inscriptions-to-orders`  
**Spec File:** `specs/link inscriptions to orders -inscriptions  orders.md`

---

## Technical Context

### Current State
- `inscriptions.order_id` is NOT NULL and required, with ON DELETE CASCADE
- Inscriptions module exists with create/edit/delete functionality (`CreateInscriptionDrawer`, `EditInscriptionDrawer`)
- Orders module has `OrderDetailsSidebar` that displays order information
- Inscriptions are accessed via `useInscriptionsList(orderId?)` hook
- Inscriptions have Zod schema requiring `orderId` as UUID
- Inscription TypeScript interface has `order_id: string` (required)

### Key Files
- `supabase/migrations/20250608000007_create_inscriptions_table.sql` - Inscriptions table schema
- `src/modules/inscriptions/hooks/useInscriptions.ts` - Inscription hooks and API functions
- `src/modules/inscriptions/types/inscriptions.types.ts` - Inscription TypeScript types (if exists)
- `src/modules/inscriptions/schemas/inscription.schema.ts` - Inscription Zod schema
- `src/modules/inscriptions/utils/inscriptionTransform.ts` - Inscription UI transformation
- `src/modules/inscriptions/components/CreateInscriptionDrawer.tsx` - Inscription creation UI
- `src/modules/inscriptions/components/EditInscriptionDrawer.tsx` - Inscription editing UI
- `src/modules/orders/components/OrderDetailsSidebar.tsx` - Order details view

### Constraints
- **Additive-only migrations** - Only making `order_id` nullable, changing FK behavior, adding index
- **Backward compatible** - Existing inscriptions with orders remain valid
- **Defensive null handling** - Handle null `order_id` throughout codebase
- **No impact on totals** - No changes to invoice/order totals or map logic
- **No N+1 queries** - OrderDetailsSidebar query is acceptable (single order context)
- **ON DELETE SET NULL** - Preserve inscriptions when orders are deleted (better than CASCADE)

### User Requirements
1. Create inscription with order and without order
2. Edit inscription link change + clear
3. Delete order and verify inscriptions remain but order_id becomes null
4. Display linked inscriptions in OrderDetailsSidebar

---

## Implementation Phases

### Phase 1: Database Migration

**Goal:** Make `inscriptions.order_id` nullable, update FK to ON DELETE SET NULL, and add index.

#### Task 1.1: Create Migration to Make `order_id` Nullable and Update FK
**File:** `supabase/migrations/YYYYMMDDHHmmss_make_inscriptions_order_id_nullable.sql`

**Implementation:**
```sql
-- Make order_id nullable
alter table public.inscriptions
  alter column order_id drop not null;

-- Drop existing FK constraint (if it exists)
alter table public.inscriptions
  drop constraint if exists inscriptions_order_id_fkey;

-- Recreate FK constraint with ON DELETE SET NULL
alter table public.inscriptions
  add constraint inscriptions_order_id_fkey
    foreign key (order_id)
    references public.orders(id)
    on delete set null;

-- Add partial index for query performance (only where order_id is not null)
create index if not exists idx_inscriptions_order_id
  on public.inscriptions(order_id)
  where order_id is not null;

-- Add comment for clarity
comment on column public.inscriptions.order_id is 
  'Optional link to an order. Null if inscription is not linked to any order.';
```

**Validation:**
- Migration runs without errors
- Existing inscriptions still load (all have order_id currently)
- Deleting an order sets related inscriptions.order_id to null (test manually)

**Acceptance Criteria:**
- ✅ `inscriptions.order_id` is nullable
- ✅ FK constraint uses ON DELETE SET NULL
- ✅ Partial index exists on `order_id` where not null
- ✅ Existing data remains valid

---

### Phase 2: Types & Schema Updates

**Goal:** Update TypeScript types and Zod schema to accept nullable `order_id`.

#### Task 2.1: Update Inscription TypeScript Interface
**File:** `src/modules/inscriptions/hooks/useInscriptions.ts` (or `src/modules/inscriptions/types/inscriptions.types.ts` if separate)

**Implementation:**
- Update `Inscription` interface: `order_id: string | null` (was `string`)
- Update `InscriptionInsert` type: `order_id: string | null` (was `string`)
- Update `InscriptionUpdate` type: `order_id?: string | null` (optional, nullable)

**Validation:**
- TypeScript compilation passes
- No type errors in existing code

**Acceptance Criteria:**
- ✅ `Inscription.order_id` is `string | null`
- ✅ `InscriptionInsert.order_id` is `string | null`
- ✅ `InscriptionUpdate.order_id` is `string | null | undefined`

#### Task 2.2: Update Zod Schema
**File:** `src/modules/inscriptions/schemas/inscription.schema.ts`

**Implementation:**
- Update `inscriptionFormSchema`:
  ```typescript
  orderId: z.string().uuid('Order ID must be a valid UUID').optional().nullable(),
  ```
  (was: `orderId: z.string().uuid('Order is required')`)

**Validation:**
- Form validation accepts null/undefined for `orderId`
- Form validation still accepts valid UUID strings
- Form validation rejects invalid UUIDs

**Acceptance Criteria:**
- ✅ Schema accepts `null`, `undefined`, or valid UUID string for `orderId`
- ✅ Schema rejects invalid UUIDs

#### Task 2.3: Update Transform Utilities
**File:** `src/modules/inscriptions/utils/inscriptionTransform.ts`

**Implementation:**
- Update `transformInscriptionFromDb`: Handle null `order_id` → `orderId: string | null`
- Update `toInscriptionInsert`: Handle `orderId?: string | null` → `order_id: string | null`
- Update `toInscriptionUpdate`: Handle `orderId?: string | null` → `order_id?: string | null`

**Validation:**
- Transform handles null values correctly
- No runtime errors with null `order_id`

**Acceptance Criteria:**
- ✅ Transform preserves null `order_id` as null `orderId`
- ✅ Transform handles undefined/missing `orderId` as null
- ✅ No crashes with null values

---

### Phase 3: Data Access Layer

**Goal:** Add hook to fetch inscriptions by order ID and ensure proper cache invalidation.

#### Task 3.1: Add `useInscriptionsByOrderId` Hook
**File:** `src/modules/inscriptions/hooks/useInscriptions.ts`

**Implementation:**
- Add new hook:
  ```typescript
  export function useInscriptionsByOrderId(orderId: string | null | undefined) {
    return useQuery({
      queryKey: inscriptionsKeys.byOrder(orderId || ''),
      queryFn: () => fetchInscriptions(orderId || undefined),
      enabled: !!orderId, // Only fetch if orderId exists
    });
  }
  ```

- Update `fetchInscriptions` to handle null/undefined `orderId`:
  ```typescript
  async function fetchInscriptions(orderId?: string | null) {
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
  ```

**Validation:**
- Hook only fetches when `orderId` is truthy
- Hook returns empty array when `orderId` is null/undefined
- No unnecessary queries when `orderId` is null

**Acceptance Criteria:**
- ✅ `useInscriptionsByOrderId` hook exists
- ✅ Hook is disabled when `orderId` is null/undefined
- ✅ Hook fetches inscriptions correctly when `orderId` exists
- ✅ Returns inscriptions ordered by `created_at desc`

#### Task 3.2: Update Cache Invalidation
**File:** `src/modules/inscriptions/hooks/useInscriptions.ts`

**Implementation:**
- Update `useCreateInscription` mutation:
  ```typescript
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: inscriptionsKeys.all });
    if (data.order_id) {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(data.order_id) });
    }
  },
  ```

- Update `useUpdateInscription` mutation:
  ```typescript
  onSuccess: (data, variables) => {
    queryClient.invalidateQueries({ queryKey: inscriptionsKeys.all });
    queryClient.setQueryData(inscriptionsKeys.detail(data.id), data);
    
    // Invalidate old order_id cache if it changed
    const oldOrderId = variables.updates.order_id !== undefined ? 
      // Get old order_id from cache or variables
      (queryClient.getQueryData(inscriptionsKeys.detail(data.id)) as Inscription | undefined)?.order_id
      : undefined;
    
    if (oldOrderId && oldOrderId !== data.order_id) {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(oldOrderId) });
    }
    
    // Invalidate new order_id cache
    if (data.order_id) {
      queryClient.invalidateQueries({ queryKey: inscriptionsKeys.byOrder(data.order_id) });
    }
  },
  ```

**Validation:**
- Cache invalidates correctly when inscription order_id changes
- Cache invalidates correctly when order is deleted (order_id becomes null)

**Acceptance Criteria:**
- ✅ Cache invalidates when inscription order_id changes
- ✅ Cache invalidates for both old and new order_id
- ✅ Cache handles null order_id correctly

---

### Phase 4: UI - Inscription Forms

**Goal:** Add order selector to create/edit inscription forms.

#### Task 4.1: Update `CreateInscriptionDrawer`
**File:** `src/modules/inscriptions/components/CreateInscriptionDrawer.tsx`

**Implementation:**
- Add `useOrdersList()` hook to fetch orders
- Add "Linked Order (optional)" field to form:
  ```tsx
  <FormField
    control={form.control}
    name="orderId"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Linked Order (optional)</FormLabel>
        <Select
          value={field.value || 'none'}
          onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select an order (optional)" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {ordersData?.map((order) => (
              <SelectItem key={order.id} value={order.id}>
                {order.customer_name || `Order ${order.id.substring(0, 8)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
  ```

- Update form default values: `orderId: null` (was: `orderId: ''`)
- Update form reset: `orderId: null`

**Validation:**
- Form accepts "None" selection (sets `orderId` to null)
- Form accepts order selection (sets `orderId` to order.id)
- Form submission works with null `orderId`
- Form submission works with valid `orderId`

**Acceptance Criteria:**
- ✅ Order selector appears in create form
- ✅ "None" option is available and sets `orderId` to null
- ✅ Order list is populated with orders
- ✅ Form submission works with null or valid `orderId`

#### Task 4.2: Update `EditInscriptionDrawer`
**File:** `src/modules/inscriptions/components/EditInscriptionDrawer.tsx`

**Implementation:**
- Add `useOrdersList()` hook to fetch orders
- Add same "Linked Order (optional)" field as in create form
- Update form default values to use inscription's current `order_id`:
  ```typescript
  orderId: inscription.order_id || null,
  ```

- Ensure form reset uses inscription's current `order_id`

**Validation:**
- Form pre-fills with current order if inscription has one
- Form shows "None" if inscription has no order
- Changing order updates correctly
- Clearing order (selecting "None") sets `orderId` to null
- Form submission works correctly

**Acceptance Criteria:**
- ✅ Order selector appears in edit form
- ✅ Form pre-fills with current order if exists
- ✅ Form shows "None" if no order linked
- ✅ Changing order works correctly
- ✅ Clearing order (None) sets `orderId` to null
- ✅ Form submission works correctly

---

### Phase 5: UI - OrderDetailsSidebar

**Goal:** Display linked inscriptions in OrderDetailsSidebar.

#### Task 5.1: Add Inscriptions Card to `OrderDetailsSidebar`
**File:** `src/modules/orders/components/OrderDetailsSidebar.tsx`

**Implementation:**
- Import `useInscriptionsByOrderId` hook
- Add inscriptions query:
  ```typescript
  const { data: inscriptions, isLoading: isInscriptionsLoading } = useInscriptionsByOrderId(order?.id);
  ```

- Add "Inscriptions" card section after existing cards:
  ```tsx
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">Inscriptions</CardTitle>
    </CardHeader>
    <CardContent>
      {isInscriptionsLoading ? (
        <div className="text-sm text-muted-foreground">Loading inscriptions...</div>
      ) : !inscriptions || inscriptions.length === 0 ? (
        <div className="text-sm text-muted-foreground">No inscriptions linked to this order.</div>
      ) : (
        <div className="space-y-2">
          {inscriptions.map((inscription) => (
            <div key={inscription.id} className="flex items-center justify-between p-2 border rounded">
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {inscription.inscription_text.substring(0, 50)}
                  {inscription.inscription_text.length > 50 && '...'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {inscription.type} • {format(new Date(inscription.created_at), 'MMM d, yyyy')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
  ```

**Validation:**
- Card appears when order is selected
- Card shows loading state while fetching
- Card shows empty state when no inscriptions
- Card shows list of inscriptions when they exist
- Inscriptions display correctly with text snippet and date

**Acceptance Criteria:**
- ✅ "Inscriptions" card appears in OrderDetailsSidebar
- ✅ Card shows loading state
- ✅ Card shows empty state when no inscriptions
- ✅ Card shows inscription list when inscriptions exist
- ✅ Each inscription shows text snippet, type, and created date

---

### Phase 6: QA & Validation

**Goal:** Verify all acceptance criteria are met.

#### Task 6.1: Functional Testing
**Test Cases:**
1. **Create inscription with order:**
   - Open create inscription drawer
   - Select an order from dropdown
   - Fill in inscription details
   - Submit form
   - Verify inscription is created with `order_id` set

2. **Create inscription without order:**
   - Open create inscription drawer
   - Leave order selector as "None"
   - Fill in inscription details
   - Submit form
   - Verify inscription is created with `order_id` as null

3. **Edit inscription link change:**
   - Open edit inscription drawer for inscription with order
   - Change order to different order
   - Submit form
   - Verify inscription `order_id` is updated
   - Verify OrderDetailsSidebar shows inscription under new order

4. **Edit inscription clear link:**
   - Open edit inscription drawer for inscription with order
   - Select "None" for order
   - Submit form
   - Verify inscription `order_id` is set to null
   - Verify OrderDetailsSidebar no longer shows inscription for old order

5. **Delete order preserves inscriptions:**
   - Create order with linked inscription
   - Delete the order
   - Verify inscription still exists but `order_id` is null
   - Verify inscription can be edited and linked to new order

6. **OrderDetailsSidebar displays inscriptions:**
   - Open order with linked inscriptions
   - Verify OrderDetailsSidebar shows "Inscriptions" card
   - Verify inscriptions are displayed correctly
   - Verify empty state when no inscriptions

#### Task 6.2: Build & Lint Checks
**Commands:**
- `npx tsc --noEmit` - Verify TypeScript compilation passes
- `npm run lint` - Verify linting passes
- `npm run build` - Verify production build succeeds

**Acceptance Criteria:**
- ✅ TypeScript compilation passes
- ✅ Linting passes
- ✅ Production build succeeds
- ✅ No runtime errors

#### Task 6.3: Verify No Impact on Totals/Invoices/Map
**Validation:**
- Invoice totals remain unchanged (no code changes to invoice logic)
- Order totals remain unchanged (no code changes to order calculation)
- Map functionality remains unchanged (no code changes to map logic)

**Acceptance Criteria:**
- ✅ Invoice totals unaffected
- ✅ Order totals unaffected
- ✅ Map functionality unaffected

---

## Progress Tracking

- [ ] Phase 1: Database Migration
  - [ ] Task 1.1: Create migration to make `order_id` nullable and update FK
- [ ] Phase 2: Types & Schema Updates
  - [ ] Task 2.1: Update Inscription TypeScript interface
  - [ ] Task 2.2: Update Zod schema
  - [ ] Task 2.3: Update transform utilities
- [ ] Phase 3: Data Access Layer
  - [ ] Task 3.1: Add `useInscriptionsByOrderId` hook
  - [ ] Task 3.2: Update cache invalidation
- [ ] Phase 4: UI - Inscription Forms
  - [ ] Task 4.1: Update `CreateInscriptionDrawer`
  - [ ] Task 4.2: Update `EditInscriptionDrawer`
- [ ] Phase 5: UI - OrderDetailsSidebar
  - [ ] Task 5.1: Add Inscriptions card to `OrderDetailsSidebar`
- [ ] Phase 6: QA & Validation
  - [ ] Task 6.1: Functional testing
  - [ ] Task 6.2: Build & lint checks
  - [ ] Task 6.3: Verify no impact on totals/invoices/map

---

## Acceptance Criteria Summary

- ✅ `inscriptions.order_id` exists, nullable, FK enforced with ON DELETE SET NULL, indexed
- ✅ Deleting an Order sets linked inscriptions' `order_id` to null (no inscription deleted)
- ✅ Inscription create/edit can set/change/clear linked order
- ✅ OrderDetailsSidebar shows correct linked inscriptions
- ✅ Build passes; no blank screens; no runtime errors
- ✅ Existing inscriptions with orders remain functional
- ✅ New inscriptions can be created without orders
- ✅ No impact on invoice totals, order totals, or map logic

---

## Notes

- Migration file naming: `YYYYMMDDHHmmss_make_inscriptions_order_id_nullable.sql`
- Partial index on `order_id` where not null for efficient lookups
- RLS policy remains unchanged (order_id is just another nullable column)
- Cache invalidation handles null order_id correctly
- Form validation accepts null/undefined/valid UUID for orderId

