# Orders ↔ Messages Relationship Analysis and Standardization

## Overview

**Goal:** Analyse and standardise the relationship between Orders and Messages so messages can be optionally linked to orders, following an order-centric system design.

**Context:**
- This is an existing Next.js project using both App Router (src/app) and Pages Router (pages)
- Supabase is used with a mixed approach (server components, API routes, and client usage)
- A Unified Inbox (Messages) module and an Orders module already exist and have CRUD connected to Supabase
- Orders are the system spine; messages are communication records that can optionally relate to orders

**Scope:**
- Analyse current schema and data access patterns
- Identify gaps and inconsistencies
- Recommend minimal schema adjustments (if any)
- Recommend query/data-access alignment
- Provide safe, incremental implementation steps

**Constraints:**
- Orders are the system spine
- Every message MUST reference company_id
- Messages MAY reference order_id (nullable)
- Orphan messages (no order_id) are allowed
- Do NOT introduce automation, AI, or business logic
- Do NOT add new pages or change UI layout/styling
- Do NOT modify auth, RLS, or permissions
- Use existing tables and modules
- Only additive, non-destructive migrations allowed

---

## Current State Analysis

### Messages Schema

**Table:** `public.messages`

**Current Structure:**
```sql
- id: uuid (primary key)
- order_id: uuid (nullable, references public.orders(id) on delete set null)
- thread_id: uuid (nullable)
- type: text (default 'email', check in ('email', 'phone', 'note', 'internal'))
- direction: text (default 'inbound', check in ('inbound', 'outbound'))
- from_name: text (not null)
- from_email: text (nullable)
- from_phone: text (nullable)
- subject: text (nullable)
- content: text (not null)
- is_read: boolean (default false)
- priority: text (default 'medium', check in ('low', 'medium', 'high'))
- created_at: timestamp with time zone (default now())
- updated_at: timestamp with time zone (default now())
```

**Foreign Keys:**
- `order_id` → `public.orders(id)` (nullable, on delete set null) ✅ EXISTS

**Indexes:**
- `idx_messages_thread_id` on `thread_id` ✅ EXISTS
- `idx_messages_order_id` on `order_id` ✅ EXISTS

**RLS Policies:**
- "Allow all access to messages" (for all operations, using true/with check true)

**Observations:**
- ✅ `order_id` foreign key already exists and is nullable (meets requirement)
- ❌ `company_id` field is MISSING (required per specifications)
- ✅ Index on `order_id` exists for query performance
- ✅ Foreign key constraint properly handles order deletion (set null)

### Orders Schema

**Table:** `public.orders`

**Current Structure:**
```sql
- id: uuid (primary key)
- customer_name: text (not null)
- customer_email: text (nullable)
- customer_phone: text (nullable)
- order_type: text (not null)
- sku: text (nullable)
- material: text (nullable)
- color: text (nullable)
- stone_status: text (default 'NA', check constraint)
- permit_status: text (default 'pending', check constraint)
- proof_status: text (default 'Not_Received', check constraint)
- deposit_date: date (nullable)
- second_payment_date: date (nullable)
- due_date: date (nullable)
- installation_date: date (nullable)
- location: text (nullable)
- value: decimal(10,2) (nullable)
- progress: integer (default 0, check 0-100)
- assigned_to: text (nullable)
- priority: text (default 'medium', check constraint)
- timeline_weeks: integer (default 12)
- notes: text (nullable)
- created_at: timestamp with time zone (default now())
- updated_at: timestamp with time zone (default now())
```

**Foreign Keys:**
- None (standalone table)

**Indexes:**
- None explicitly created in migration

**RLS Policies:**
- "Allow all access to orders" (for all operations, using true/with check true)

**Observations:**
- Orders table has no direct reference to messages table (expected, reverse relationship)
- Orders can be queried independently
- No company_id field found in orders table (may need investigation if required for filtering)

### Relationship Analysis

**Current Relationship:**
- One-way foreign key: `messages.order_id` → `orders.id`
- Relationship is nullable (messages can exist without orders)
- Relationship uses `on delete set null` (messages persist if order is deleted)
- Index exists on `messages.order_id` for efficient queries

**Gaps/Issues:**

1. **Missing `company_id` in Messages:**
   - Specification requires: "Every message MUST reference company_id"
   - Current schema: `company_id` field does NOT exist in messages table
   - Impact: Cannot filter messages by company
   - Resolution needed: Add `company_id` column (nullable or not null depending on business rules)

2. **No Reverse Query Support:**
   - No query functions exist to fetch messages by order_id
   - No aggregation functions to count messages per order
   - Orders pages do not display related message counts or summaries

3. **Type Definition Alignment:**
   - `src/modules/inbox/types/inbox.types.ts` defines `Message` interface with `order_id: string | null` ✅
   - Type definition matches schema (nullable)

### Data Access Patterns

**How Messages are Currently Accessed:**

**Location:** `src/modules/inbox/api/inbox.api.ts`

**Query Functions:**
- `fetchMessages()` - Fetches ALL messages, ordered by `created_at DESC`
  - No filtering by `order_id`
  - No filtering by `company_id`
- `fetchMessage(id)` - Fetches single message by ID
- `fetchThreadMessages(threadId)` - Fetches messages by thread_id
- `createMessage(message)` - Creates new message
- `updateMessage(id, updates)` - Updates message
- `markMessageAsRead(id)` - Marks message as read
- `deleteMessage(id)` - Deletes message

**Current Filters/Sorting:**
- Global fetch: Ordered by `created_at DESC` only
- No order_id filtering capability
- No company_id filtering capability

**How Orders are Currently Accessed:**

**Location:** `src/modules/orders/api/orders.api.ts`

**Query Functions:**
- `fetchOrders()` - Fetches all orders
- `fetchOrder(id)` - Fetches single order by ID
- `createOrder(order)` - Creates new order
- `updateOrder(id, updates)` - Updates order
- `deleteOrder(id)` - Deletes order

**Current Filters/Sorting:**
- No message-related queries
- No message count aggregation
- Orders are queried independently of messages

**How They Are Queried Together:**

**Current State:** ❌ NOT QUERIED TOGETHER

- No joins between orders and messages
- No aggregation queries (e.g., message counts per order)
- No filtering of messages by order in the UI
- OrderDetailsSidebar has "Add Note" button (line 531) but it's not functional

**Display Logic:**
- `UnifiedInboxPage.tsx` uses demo data, not real messages from database
- Demo data includes `orderId` field but actual messages table uses `order_id`
- `OrdersPage.tsx` does not display message counts or summaries
- `OrderDetailsSidebar.tsx` has placeholder "Add Note" button but no implementation

---

## Recommended Schema Adjustments

### Database Changes

**Migration Required: Add `company_id` to Messages Table**

**Rationale:**
- Specification requirement: "Every message MUST reference company_id"
- Current schema is missing this field
- Needed for multi-tenant data isolation and filtering

**Recommended Migration:**

```sql
-- Add company_id column to messages table
-- Assuming companies table exists (needs verification)
alter table public.messages
  add column company_id uuid references public.companies(id) on delete restrict;

-- Create index for query performance
create index if not exists idx_messages_company_id on public.messages(company_id);

-- Note: If existing data exists, may need to populate company_id based on business rules
-- If company_id should be NOT NULL, add constraint after data migration
```

**Decision Needed:**
1. Does `companies` table exist? (Not found in migrations examined)
2. Should `company_id` be nullable or NOT NULL?
3. How to populate existing messages with company_id values?

**Non-Destructive Constraints:**
- ✅ Only additive changes (new column, new index)
- ✅ No table renames
- ✅ No column deletions
- ✅ Backward compatibility maintained (nullable column initially)
- ⚠️ If NOT NULL constraint is added later, requires data migration first

### Query/Data-Access Alignment

**Recommended Query Patterns:**

1. **Fetch Messages by Order ID:**
   ```typescript
   // Add to src/modules/inbox/api/inbox.api.ts
   export async function fetchMessagesByOrder(orderId: string) {
     const { data, error } = await supabase
       .from('messages')
       .select('*')
       .eq('order_id', orderId)
       .order('created_at', { ascending: false });
     
     if (error) throw error;
     return data as Message[];
   }
   ```

2. **Fetch Messages by Company ID:**
   ```typescript
   // Add to src/modules/inbox/api/inbox.api.ts
   export async function fetchMessagesByCompany(companyId: string) {
     const { data, error } = await supabase
       .from('messages')
       .select('*')
       .eq('company_id', companyId)
       .order('created_at', { ascending: false });
     
     if (error) throw error;
     return data as Message[];
   }
   ```

3. **Get Message Count per Order:**
   ```sql
   -- Could be done via aggregation in query or view
   select 
     o.id as order_id,
     count(m.id) as message_count
   from orders o
   left join messages m on m.order_id = o.id
   group by o.id;
   ```

**Recommended Display Patterns:**

1. **In Orders Table/List:**
   - Add message count column/badge showing number of messages linked to each order
   - Could show unread message count if order has unread messages

2. **In Order Details Sidebar:**
   - Add section showing related messages
   - List messages with subject, sender, date
   - Allow navigation to message detail
   - "Add Note" button should create a message with order_id pre-filled

3. **In Unified Inbox:**
   - Add filter option: "Filter by Order"
   - Display order_id/order reference in message list
   - Allow linking/unlinking messages to orders (if order_id is null, allow setting it)

4. **Message Detail View:**
   - If message has order_id, show order link/reference
   - Allow changing order_id (linking/unlinking)

---

## Implementation Approach

### Phase 1: Schema Verification and Preparation

**Step 1.1: Verify Companies Table Existence**
- Check if `companies` table exists in database
- Review company_id usage patterns in other tables
- Determine if company_id should be nullable or NOT NULL

**Step 1.2: Add company_id to Messages Table (if companies table exists)**
- Create migration: `YYYYMMDDHHmmss_add_company_id_to_messages.sql`
- Add nullable `company_id` column
- Create index on `company_id`
- If existing data exists, determine migration strategy for populating company_id

**Step 1.3: Update Type Definitions**
- Update `src/modules/inbox/types/inbox.types.ts` to include `company_id: string | null`

### Phase 2: Query Function Enhancement

**Step 2.1: Add Order-Based Message Queries**
- Add `fetchMessagesByOrder(orderId)` to `src/modules/inbox/api/inbox.api.ts`
- Add `useMessagesByOrder(orderId)` hook to `src/modules/inbox/hooks/useMessages.ts`
- Add query key: `messagesKeys.byOrder(orderId)`

**Step 2.2: Add Company-Based Message Queries (if company_id added)**
- Add `fetchMessagesByCompany(companyId)` to `src/modules/inbox/api/inbox.api.ts`
- Add `useMessagesByCompany(companyId)` hook
- Update `fetchMessages()` to optionally filter by company_id

**Step 2.3: Add Message Count Aggregation**
- Consider adding helper function to get message counts per order
- Could be done client-side or via database view/function

### Phase 3: UI Integration (Display Only, No Layout Changes)

**Step 3.1: Orders Page - Message Count Display**
- Add message count to orders table/list (if space allows)
- Query message counts for displayed orders
- Display as badge or small number

**Step 3.2: Order Details Sidebar - Related Messages**
- Add "Messages" section to `OrderDetailsSidebar.tsx`
- Use `useMessagesByOrder(orderId)` to fetch related messages
- Display message list with basic info (subject, sender, date)
- Allow clicking to view message detail (navigate to inbox)

**Step 3.3: Unified Inbox - Order Filtering**
- Add order_id filter option to inbox page
- Display order_id/reference in message list items
- Allow filtering messages by order_id

**Step 3.4: Message Linking (Optional Enhancement)**
- In message detail/edit, allow setting/changing order_id
- Dropdown to select order (if order_id is null)
- Button to unlink message from order (set order_id to null)

### Safety Considerations

**Data Migration:**
- If adding company_id to existing messages:
  - Determine how to populate company_id for existing records
  - May need business rule: derive from order.company_id, user.company_id, or default
  - Test migration on staging environment first

**Backward Compatibility:**
- Keep order_id nullable (already is)
- Keep company_id nullable initially if NOT NULL constraint is not immediately required
- All new query functions should handle null values gracefully

**Testing Strategy:**
1. Test message creation with and without order_id
2. Test message queries filtered by order_id
3. Test order deletion (should set messages.order_id to null)
4. Test message count aggregations
5. Verify RLS policies still work correctly

**Rollback Strategy:**
- Migration to add company_id can be rolled back by dropping column and index
- Query function additions are additive and can be removed
- UI changes should be feature-flagged or easily removable

---

## What NOT to Do

- ❌ Do NOT introduce automation that automatically links messages to orders
- ❌ Do NOT add AI or business logic for message-order matching
- ❌ Do NOT add new pages or routes
- ❌ Do NOT change UI layout or styling (only add data display)
- ❌ Do NOT modify auth, RLS policies, or permissions
- ❌ Do NOT rename tables or columns
- ❌ Do NOT delete columns or tables
- ❌ Do NOT add triggers or database functions for automatic linking
- ❌ Do NOT refactor unrelated modules
- ❌ Do NOT change the nullable nature of order_id (must remain optional)

---

## Open Questions / Considerations

1. **Companies Table:**
   - Does a `companies` table exist in the database?
   - If not, how should company_id be handled? Should it reference users table?
   - What is the relationship between users and companies in this system?

2. **company_id Constraint:**
   - Should `company_id` be NOT NULL or nullable?
   - If NOT NULL, what is the migration strategy for existing messages?
   - Should company_id be derived from order.company_id when order_id is set?

3. **Data Access Patterns:**
   - Should all message queries automatically filter by company_id (if multi-tenant)?
   - Or should company_id filtering be explicit in query functions?

4. **Message Count Display:**
   - Should message counts be shown in the orders table/list view?
   - Should unread message counts be shown separately?
   - Performance consideration: Should counts be aggregated in database view or calculated client-side?

5. **Order Deletion Behavior:**
   - Current: `on delete set null` - messages persist with null order_id
   - Is this the desired behavior, or should messages be deleted when order is deleted?

6. **Inbox Integration:**
   - Should the Unified Inbox page be updated to use real data instead of demo data?
   - Is this part of this analysis scope, or separate work?

