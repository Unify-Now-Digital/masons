# Link Inscriptions to Orders (Inscriptions ↔ Orders)

## Overview

Allow an Inscription to optionally link to an Order via `inscriptions.order_id`, selectable in the Inscription create/edit UI, and show linked inscriptions in the Order details sidebar.

**Context:**
- Currently, `inscriptions.order_id` is NOT NULL and required, with ON DELETE CASCADE
- Inscriptions module exists with create/edit/delete functionality
- Orders module has OrderDetailsSidebar that displays order information
- Need to make the relationship optional while maintaining data integrity

**Goal:**
- Make `inscriptions.order_id` nullable (optional relationship)
- Allow creating inscriptions without an order link
- Allow linking/unlinking inscriptions to/from orders via UI
- Display linked inscriptions in OrderDetailsSidebar
- Maintain backward compatibility (existing inscriptions with orders remain valid)

---

## Current State Analysis

### Inscriptions Schema

**Table:** `public.inscriptions`

**Current Structure:**
- `id` uuid primary key
- `order_id` uuid NOT NULL references `public.orders(id)` ON DELETE CASCADE
- `inscription_text` text NOT NULL
- `type` text NOT NULL (enum: 'front', 'back', 'side', 'plaque', 'additional')
- `style` text nullable
- `color` text nullable (enum: 'gold', 'silver', 'white', 'black', 'natural', 'other')
- `proof_url` text nullable
- `status` text NOT NULL default 'pending' (enum: 'pending', 'proofing', 'approved', 'engraving', 'completed', 'installed')
- `engraved_by` text nullable
- `engraved_date` date nullable
- `notes` text nullable
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()
- RLS enabled with "Allow all access" policy
- Index: No explicit index on `order_id` (relies on FK index)

**Observations:**
- `order_id` is currently required (NOT NULL)
- Foreign key uses ON DELETE CASCADE (deleting an order deletes inscriptions)
- No explicit index on `order_id` for query performance
- Schema requires `orderId` in form validation (Zod schema)

### Orders Schema

**Table:** `public.orders`

**Current Structure:**
- `id` uuid primary key
- Multiple fields for order details (customer_name, order_type, value, etc.)
- No reverse relationship to inscriptions currently exposed

**Observations:**
- Orders table exists and is well-established
- No changes needed to orders table structure

### Relationship Analysis

**Current Relationship:**
- One-to-many: One Order can have many Inscriptions
- Currently required: Every inscription must have an order
- Foreign key: `inscriptions.order_id -> orders.id` with ON DELETE CASCADE
- Query pattern: `fetchInscriptions(orderId)` filters by `order_id`

**Gaps/Issues:**
- Relationship is required, but use case requires optional linking
- ON DELETE CASCADE deletes inscriptions when order is deleted (should preserve inscriptions)
- No way to create inscriptions without an order
- No way to view inscriptions from OrderDetailsSidebar
- No way to change/unlink an inscription's order

### Data Access Patterns

**How Inscriptions are Currently Accessed:**
- `useInscriptionsList(orderId?)` - Fetches all inscriptions or filters by orderId
- `useInscription(id)` - Fetches single inscription by ID
- `useCreateInscription()` - Creates inscription (requires orderId)
- `useUpdateInscription()` - Updates inscription
- `useDeleteInscription()` - Deletes inscription
- Location: `src/modules/inscriptions/hooks/useInscriptions.ts`

**How Orders are Currently Accessed:**
- `useOrdersList()` - Fetches all orders
- `useOrder(id)` - Fetches single order
- Location: `src/modules/orders/hooks/useOrders.ts`

**How They Are Queried Together (if at all):**
- Currently: Inscriptions are queried by filtering on `order_id`
- No reverse query (orders -> inscriptions) exists
- OrderDetailsSidebar does not display inscriptions

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
1. **Make `order_id` nullable:**
   ```sql
   alter table public.inscriptions
     alter column order_id drop not null;
   ```

2. **Change foreign key constraint:**
   - Drop existing FK constraint
   - Recreate with ON DELETE SET NULL (instead of CASCADE)
   ```sql
   alter table public.inscriptions
     drop constraint if exists inscriptions_order_id_fkey;
   
   alter table public.inscriptions
     add constraint inscriptions_order_id_fkey
       foreign key (order_id)
       references public.orders(id)
       on delete set null;
   ```

3. **Add index for query performance:**
   ```sql
   create index if not exists idx_inscriptions_order_id
     on public.inscriptions(order_id)
     where order_id is not null;
   ```
   (Partial index since we'll query by order_id when it's not null)

4. **Update existing data (if needed):**
   - No data migration required (all existing inscriptions have order_id)

**Non-Destructive Constraints:**
- Only additive changes (making column nullable, changing FK behavior)
- No table renames or column deletions
- Backward compatible: existing inscriptions with orders remain valid
- New inscriptions can be created without orders

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Fetch inscriptions by order: `select * from inscriptions where order_id = :orderId order by created_at desc`
- Fetch inscriptions without order: `select * from inscriptions where order_id is null`
- Use existing `useInscriptionsList(orderId?)` hook pattern (already supports optional orderId)

**Recommended Display Patterns:**
- OrderDetailsSidebar: Show "Inscriptions" card with list of linked inscriptions
- Inscription forms: Show order selector with "None" option
- Inscription list: Can filter by order or show unlinked inscriptions

---

## Implementation Approach

### Phase 1: Database Migration
- Create migration to make `order_id` nullable
- Update foreign key constraint to ON DELETE SET NULL
- Add index on `order_id` for query performance
- Verify existing data remains valid

### Phase 2: Type & Schema Updates
- Update `Inscription` TypeScript interface: `order_id: string | null`
- Update Zod schema: `orderId: z.string().uuid().optional().nullable()`
- Update transform utilities to handle nullable `order_id`
- Ensure all API functions handle nullable `order_id`

### Phase 3: Data Access Layer
- Add `useInscriptionsByOrderId(orderId)` hook (enabled only when orderId exists)
- Update `fetchInscriptions` to handle null `order_id` queries
- Ensure cache invalidation works for both order-linked and unlinked inscriptions

### Phase 4: UI - Inscription Forms
- Update `CreateInscriptionDrawer`:
  - Add order selector (Select component)
  - Default to "None" option
  - Fetch orders list for dropdown
  - Make `orderId` optional in form
- Update `EditInscriptionDrawer`:
  - Add order selector (prefilled with current order if linked)
  - Allow changing order or clearing link (set to null)
  - Handle "None" selection

### Phase 5: UI - OrderDetailsSidebar
- Add "Inscriptions" card section
- Use `useInscriptionsByOrderId(order?.id)` hook (disabled if no order)
- Display states:
  - Loading: Show loading indicator
  - Empty: "No inscriptions linked to this order"
  - List: Show inscription title/snippet + created date
  - Optional: Add "View" or "Edit" button if navigation pattern exists

### Safety Considerations
- Migration is additive (making column nullable is safe)
- ON DELETE SET NULL preserves inscriptions when orders are deleted (better than CASCADE)
- Existing inscriptions with orders remain valid
- Defensive null handling throughout codebase
- Test with existing data to ensure no regressions

---

## What NOT to Do

- Do not change invoice totals, order totals, or additional options logic
- Do not add bulk linking tools or automation
- Do not change reporting widgets or map logic
- Do not add N+1 queries to main order/invoice tables (sidebar query is acceptable)
- Do not require order selection (must remain optional)
- Do not delete inscriptions when orders are deleted (use SET NULL instead of CASCADE)

---

## Open Questions / Considerations

- **Display format in OrderDetailsSidebar:** What information should be shown for each inscription? (title, snippet, status, date?)
- **Navigation:** Should clicking an inscription in OrderDetailsSidebar open the inscription edit drawer or navigate to inscriptions page?
- **Order selector UI:** Should it show order ID, customer name, or a combination? (Recommend: customer name + order ID snippet)
- **Unlinked inscriptions:** Should there be a way to view/filter inscriptions that have no linked order?
- **Performance:** The partial index on `order_id` should handle queries efficiently, but should we add any additional indexes?

---

## Acceptance Criteria

- ✅ `inscriptions.order_id` exists, nullable, FK enforced with ON DELETE SET NULL, indexed
- ✅ Deleting an Order sets linked inscriptions' `order_id` to null (no inscription deleted)
- ✅ Inscription create/edit can set/change/clear linked order
- ✅ OrderDetailsSidebar shows correct linked inscriptions
- ✅ Build passes; no blank screens; no runtime errors
- ✅ Existing inscriptions with orders remain functional
- ✅ New inscriptions can be created without orders

---

## Technical Notes

### Migration File Naming
- Format: `YYYYMMDDHHmmss_make_inscriptions_order_id_nullable.sql`
- Example: `20260110120000_make_inscriptions_order_id_nullable.sql`

### Index Strategy
- Partial index on `order_id` where `order_id is not null` for efficient lookups
- Full index not needed since we only query by order_id when it's not null

### RLS Policy
- Current policy "Allow all access" should continue to work
- No changes needed to RLS policies (order_id is just another column)

### Cache Invalidation
- When inscription order_id changes, invalidate:
  - `inscriptionsKeys.byOrder(oldOrderId)` (if existed)
  - `inscriptionsKeys.byOrder(newOrderId)` (if exists)
  - `inscriptionsKeys.all`
- When order is deleted, inscriptions' order_id becomes null automatically (FK constraint)

