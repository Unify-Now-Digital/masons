# Implementation Plan: Orders ↔ Messages Relationship

**Branch:** `feature/orders-messages-relationship-analysis`  
**Specification:** `specs/orders-messages-relationship-analysis.md`

---

## Overview

This implementation plan focuses on preparing the Orders ↔ Messages relationship for usage by adding missing structural elements and a clean data-access layer, without touching UI or business logic.

**Scope (STRICT):**
- Database: Add `messages.company_id` column (nullable) with foreign key and index
- Data Access Layer: Create query functions to fetch messages by `order_id` and `company_id`
- Type definitions: Update TypeScript types to include `company_id`

**Out of Scope:**
- UI components
- Inbox UI
- Orders UI
- Styling or layout
- Automation logic
- AI or workflow logic
- Auth, RLS, permissions
- Notifications
- Jobs, Payments, Invoices

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Verify companies table exists | Verify | Database | High | None |
| 2 | Create migration: Add company_id to messages | Create | `supabase/migrations/YYYYMMDDHHmmss_add_company_id_to_messages.sql` | High | Task 1 |
| 3 | Update Message type definition | Update | `src/modules/inbox/types/inbox.types.ts` | High | Task 2 |
| 4 | Add fetchMessagesByOrder query function | Create | `src/modules/inbox/api/inbox.api.ts` | High | None |
| 5 | Add fetchMessagesByCompany query function | Create | `src/modules/inbox/api/inbox.api.ts` | High | Task 2 |
| 6 | Add useMessagesByOrder hook | Create | `src/modules/inbox/hooks/useMessages.ts` | High | Task 4 |
| 7 | Add useMessagesByCompany hook | Create | `src/modules/inbox/hooks/useMessages.ts` | High | Task 5 |
| 8 | Validate build and types | Verify | - | High | Tasks 1-7 |

---

## Task 1: Verify Companies Table Exists

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** None

**Action:** Check if `public.companies` table exists in the database

**Verification Steps:**
1. Check Supabase migrations for companies table creation
2. If not found in migrations, query database directly or check schema
3. Document findings

**Decision Point:**
- If companies table exists: Proceed with foreign key constraint
- If companies table does NOT exist: 
  - Option A: Add `company_id` as nullable UUID without foreign key constraint
  - Option B: Create companies table first (out of scope, requires separate decision)

**Expected Outcome:**
- Confirmation of companies table existence
- Decision on foreign key constraint approach

---

## Task 2: Create Migration - Add company_id to Messages

**File:** `supabase/migrations/YYYYMMDDHHmmss_add_company_id_to_messages.sql`  
**Action:** CREATE  
**Priority:** High  
**Dependencies:** Task 1

**Migration Content (if companies table exists):**

```sql
-- Add company_id column to messages table
-- This allows messages to be associated with a company for multi-tenant filtering
alter table public.messages
  add column company_id uuid references public.companies(id) on delete restrict;

-- Create index for query performance on company_id lookups
create index if not exists idx_messages_company_id on public.messages(company_id);

-- Add comment to document the column purpose
comment on column public.messages.company_id is 'References the company that owns this message. Nullable to allow for gradual migration.';
```

**Migration Content (if companies table does NOT exist):**

```sql
-- Add company_id column to messages table (without foreign key constraint)
-- Note: Foreign key constraint will be added when companies table is created
alter table public.messages
  add column company_id uuid;

-- Create index for query performance on company_id lookups
create index if not exists idx_messages_company_id on public.messages(company_id);

-- Add comment to document the column purpose
comment on column public.messages.company_id is 'References the company that owns this message. Nullable. Foreign key constraint to be added when companies table exists.';
```

**Migration Naming:**
- Format: `YYYYMMDDHHmmss_add_company_id_to_messages.sql`
- Example: `20250115120000_add_company_id_to_messages.sql` (use current UTC timestamp)

**Key Points:**
- Column is nullable (no NOT NULL constraint)
- No data backfill required (per constraints)
- Index created for query performance
- Foreign key depends on companies table existence (Task 1 decision)

**Rollback:**
```sql
-- Rollback migration (if needed)
drop index if exists public.idx_messages_company_id;
alter table public.messages drop column if exists company_id;
```

---

## Task 3: Update Message Type Definition

**File:** `src/modules/inbox/types/inbox.types.ts`  
**Action:** UPDATE  
**Priority:** High  
**Dependencies:** Task 2

**Current Interface:**
```typescript
export interface Message {
  id: string;
  order_id: string | null;
  thread_id: string | null;
  type: 'email' | 'phone' | 'note' | 'internal';
  direction: 'inbound' | 'outbound';
  from_name: string;
  from_email: string | null;
  from_phone: string | null;
  subject: string | null;
  content: string;
  is_read: boolean;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}
```

**Updated Interface:**
```typescript
export interface Message {
  id: string;
  order_id: string | null;
  company_id: string | null;  // ADD THIS LINE
  thread_id: string | null;
  type: 'email' | 'phone' | 'note' | 'internal';
  direction: 'inbound' | 'outbound';
  from_name: string;
  from_email: string | null;
  from_phone: string | null;
  subject: string | null;
  content: string;
  is_read: boolean;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}
```

**Purpose:** TypeScript type alignment with database schema

**Note:** `MessageInsert` and `MessageUpdate` types will automatically include `company_id` since they're derived from `Message`.

---

## Task 4: Add fetchMessagesByOrder Query Function

**File:** `src/modules/inbox/api/inbox.api.ts`  
**Action:** CREATE (add function)  
**Priority:** High  
**Dependencies:** None

**Function to Add:**

```typescript
/**
 * Fetch all messages associated with a specific order
 * @param orderId - UUID of the order
 * @returns Array of Message objects ordered by creation date (newest first)
 */
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

**Location:** Add after `fetchThreadMessages` function (around line 34)

**Purpose:** Enable querying messages by their associated order

**Error Handling:** Errors are thrown (consistent with existing pattern)

**Return Type:** `Message[]` - Array of messages, empty array if no messages found

---

## Task 5: Add fetchMessagesByCompany Query Function

**File:** `src/modules/inbox/api/inbox.api.ts`  
**Action:** CREATE (add function)  
**Priority:** High  
**Dependencies:** Task 2 (migration must be applied first)

**Function to Add:**

```typescript
/**
 * Fetch all messages associated with a specific company
 * @param companyId - UUID of the company
 * @returns Array of Message objects ordered by creation date (newest first)
 */
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

**Location:** Add after `fetchMessagesByOrder` function

**Purpose:** Enable querying messages by their associated company (multi-tenant filtering)

**Error Handling:** Errors are thrown (consistent with existing pattern)

**Return Type:** `Message[]` - Array of messages, empty array if no messages found

**Note:** This function depends on Task 2 migration being applied. The `company_id` column must exist.

---

## Task 6: Add useMessagesByOrder Hook

**File:** `src/modules/inbox/hooks/useMessages.ts`  
**Action:** CREATE (add hook)  
**Priority:** High  
**Dependencies:** Task 4

**Hook to Add:**

```typescript
/**
 * React Query hook to fetch messages by order ID
 * @param orderId - UUID of the order (hook is disabled if orderId is falsy)
 * @returns React Query result with messages array
 */
export function useMessagesByOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: [...messagesKeys.all, 'byOrder', orderId],
    queryFn: () => fetchMessagesByOrder(orderId!),
    enabled: !!orderId,
  });
}
```

**Location:** Add after `useThreadMessages` function (around line 40)

**Also Update:** Query keys object at top of file:
```typescript
export const messagesKeys = {
  all: ['messages'] as const,
  detail: (id: string) => ['messages', id] as const,
  thread: (threadId: string) => ['messages', 'thread', threadId] as const,
  byOrder: (orderId: string) => ['messages', 'byOrder', orderId] as const,  // ADD THIS LINE
  byCompany: (companyId: string) => ['messages', 'byCompany', companyId] as const,  // ADD THIS LINE (for Task 7)
};
```

**Purpose:** Provide React Query hook for fetching messages by order ID with caching and automatic refetching

**Import Required:** Add `fetchMessagesByOrder` to imports at top of file:
```typescript
import { 
  fetchMessages, 
  fetchMessage, 
  fetchThreadMessages,
  fetchMessagesByOrder,  // ADD THIS
  fetchMessagesByCompany,  // ADD THIS (for Task 7)
  createMessage, 
  updateMessage, 
  markMessageAsRead,
  deleteMessage 
} from '../api/inbox.api';
```

---

## Task 7: Add useMessagesByCompany Hook

**File:** `src/modules/inbox/hooks/useMessages.ts`  
**Action:** CREATE (add hook)  
**Priority:** High  
**Dependencies:** Task 5

**Hook to Add:**

```typescript
/**
 * React Query hook to fetch messages by company ID
 * @param companyId - UUID of the company (hook is disabled if companyId is falsy)
 * @returns React Query result with messages array
 */
export function useMessagesByCompany(companyId: string | null | undefined) {
  return useQuery({
    queryKey: [...messagesKeys.all, 'byCompany', companyId],
    queryFn: () => fetchMessagesByCompany(companyId!),
    enabled: !!companyId,
  });
}
```

**Location:** Add after `useMessagesByOrder` function

**Purpose:** Provide React Query hook for fetching messages by company ID with caching and automatic refetching

**Note:** Query key already added in Task 6. Import already added in Task 6.

---

## Task 8: Validate Build and Types

**Type:** VERIFY  
**Priority:** High  
**Dependencies:** Tasks 1-7

**Validation Steps:**

1. **TypeScript Compilation:**
   ```bash
   npm run build
   ```
   - Verify no TypeScript errors
   - Verify all imports resolve correctly
   - Verify type definitions match database schema

2. **Linting:**
   ```bash
   npm run lint
   ```
   - Verify no linting errors introduced

3. **Manual Type Checks:**
   - Verify `Message` interface includes `company_id: string | null`
   - Verify `fetchMessagesByOrder` returns `Promise<Message[]>`
   - Verify `fetchMessagesByCompany` returns `Promise<Message[]>`
   - Verify hooks use correct query keys

4. **Database Schema Verification:**
   - Verify migration was applied successfully
   - Verify `company_id` column exists in messages table
   - Verify index `idx_messages_company_id` exists
   - Verify foreign key constraint (if companies table exists)

**Expected Outcome:**
- ✅ Build succeeds without errors
- ✅ No linting errors
- ✅ All types are correctly defined
- ✅ Database schema matches type definitions

---

## File Summary

### Files to Create:
1. `supabase/migrations/YYYYMMDDHHmmss_add_company_id_to_messages.sql`

### Files to Modify:
1. `src/modules/inbox/types/inbox.types.ts` - Add `company_id` to Message interface
2. `src/modules/inbox/api/inbox.api.ts` - Add `fetchMessagesByOrder` and `fetchMessagesByCompany` functions
3. `src/modules/inbox/hooks/useMessages.ts` - Add `useMessagesByOrder` and `useMessagesByCompany` hooks, update query keys

### Files NOT Modified (Confirmation):
- ❌ No UI components touched
- ❌ No inbox UI files modified
- ❌ No orders UI files modified
- ❌ No styling or layout files modified
- ❌ No auth, RLS, or permission files modified
- ❌ No business logic or automation added

---

## Implementation Notes

### Database Considerations

**company_id Nullability:**
- Column is nullable to allow for gradual migration
- No data backfill required per constraints
- Future work can add NOT NULL constraint after data migration

**Foreign Key Constraint:**
- If companies table exists: Use `on delete restrict` to prevent orphaned references
- If companies table doesn't exist: Add column without foreign key, add constraint later

**Index:**
- Index on `company_id` is essential for query performance
- Index supports both exact matches and filtering operations

### Data Access Layer Considerations

**Function Safety:**
- All functions are safe for server-side usage (no client-only APIs)
- Functions use existing Supabase client utilities
- No caching logic added (handled by React Query hooks)
- No subscriptions or real-time logic added

**Error Handling:**
- Consistent with existing pattern: errors are thrown
- Calling code handles errors via try/catch or React Query error states

**Type Safety:**
- All functions use TypeScript types
- Return types explicitly defined
- Type definitions match database schema

### Query Key Structure

Query keys follow hierarchical structure:
- `['messages']` - All messages
- `['messages', id]` - Single message
- `['messages', 'thread', threadId]` - Thread messages
- `['messages', 'byOrder', orderId]` - Messages by order
- `['messages', 'byCompany', companyId]` - Messages by company

This structure enables:
- Targeted cache invalidation
- Efficient query deduplication
- Clear query dependency relationships

---

## Success Criteria

✅ **Database:**
- `company_id` column added to `messages` table (nullable)
- Index `idx_messages_company_id` created
- Foreign key constraint added (if companies table exists)

✅ **Types:**
- `Message` interface includes `company_id: string | null`
- All type definitions compile without errors

✅ **Data Access:**
- `fetchMessagesByOrder(orderId)` function exists and works
- `fetchMessagesByCompany(companyId)` function exists and works
- `useMessagesByOrder(orderId)` hook exists and works
- `useMessagesByCompany(companyId)` hook exists and works

✅ **Validation:**
- Build succeeds
- No linting errors
- Types are correct
- No UI or business logic changes introduced

---

## Rollback Plan

If rollback is needed:

1. **Revert Code Changes:**
   - Remove query functions from `inbox.api.ts`
   - Remove hooks from `useMessages.ts`
   - Remove `company_id` from `Message` interface

2. **Rollback Migration:**
   ```sql
   drop index if exists public.idx_messages_company_id;
   alter table public.messages drop column if exists company_id;
   ```

3. **Verify:**
   - Build still succeeds
   - No broken imports
   - Database schema reverted

---

## Open Questions

1. **Companies Table:**
   - Does `public.companies` table exist?
   - Decision will be made in Task 1

2. **Foreign Key Constraint:**
   - If companies table doesn't exist, when will it be created?
   - Should foreign key constraint be added later?

3. **Data Migration (Future):**
   - How will existing messages get `company_id` populated?
   - What business rules determine company_id assignment?

These questions do not block implementation, but inform the approach taken.

