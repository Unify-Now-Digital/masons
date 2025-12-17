# Orders ↔ Messages UI Awareness Specification

## Overview

**Goal:** Expose the existing Orders ↔ Messages relationship in the UI in a minimal, read-only way, without introducing new business logic, automation, or UI redesign.

**Context:**
- Orders ↔ Messages schema and data access layer are already implemented
- Database schema: `messages.order_id` (nullable), `messages.company_id` (nullable)
- Data access functions exist: `fetchMessagesByOrder()`, `fetchMessagesByCompany()`
- React Query hooks exist: `useMessagesByOrder()`, `useMessagesByCompany()`
- Orders remain the system spine

**Scope:**
- Read-only UI display of message counts and related messages
- Minimal changes to existing UI components
- No database schema changes
- No new business logic or automation
- Use existing query functions and hooks only

**Constraints:**
- Do NOT change database schema
- Do NOT modify migrations
- Do NOT add automation, AI, or message status logic
- Do NOT change layout, styling, or navigation patterns
- Do NOT modify auth, RLS, or permissions
- Orders remain the system spine

---

## Current State Analysis

### Database Schema (Already Implemented)

**Messages Table:**
- `order_id: uuid` (nullable, foreign key to orders.id)
- `company_id: uuid` (nullable)
- Index exists on `order_id` for query performance
- Index exists on `company_id` for query performance

**Orders Table:**
- No direct reference to messages (reverse relationship via messages.order_id)
- No message count columns (will be calculated client-side)

**Relationship:**
- One-way relationship: `messages.order_id` → `orders.id`
- Nullable relationship (messages can exist without orders)
- `on delete set null` behavior (messages persist if order deleted)

### Data Access Layer (Already Implemented)

**Query Functions:**
- `fetchMessagesByOrder(orderId: string)` - Returns Message[] for a given order
- `fetchMessagesByCompany(companyId: string)` - Returns Message[] for a given company

**React Query Hooks:**
- `useMessagesByOrder(orderId)` - Hook with caching and error handling
- `useMessagesByCompany(companyId)` - Hook with caching and error handling

**Location:** `src/modules/inbox/api/inbox.api.ts` and `src/modules/inbox/hooks/useMessages.ts`

### Current UI Components

**Orders List / Table:**

**Location:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Current Structure:**
- Displays orders in a sortable table format
- Columns: id, customer, type, stoneStatus, progress, depositDate, installationDate, dueDate, value
- Uses Badge components for status display
- Supports sorting by column
- Renders order data from `UIOrder` interface

**Observations:**
- Table already uses Badge components for status indicators
- Can add message count as additional column or badge
- No existing message-related UI elements

**Order Detail View:**

**Location:** `src/modules/orders/components/OrderDetailsSidebar.tsx`

**Current Structure:**
- Displays order details in sidebar format
- Shows customer info, dates, status, progress, notes
- Has action buttons: "Edit Order", "Add Note", "Schedule Installation"
- "Add Note" button exists but is not functional (placeholder)
- Receives `order: Order | null` as prop
- Uses `transformOrderForUI()` to convert DB format to UI format

**Observations:**
- Sidebar has sections for different order information
- Could add "Related Messages" section
- "Add Note" button suggests message integration was planned but not implemented
- No existing message display functionality

**Unified Inbox:**

**Location:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Current Structure:**
- Uses demo/hardcoded data (not real database queries)
- Has filtering by tab: all, unread, email, phone
- Has search functionality
- Displays communication list with badges for status and priority
- Shows orderId in demo data: `<Badge variant="outline">Order: {comm.orderId}</Badge>`
- No actual filtering by order_id implemented

**Observations:**
- Already has Filter button/UI element (line 141)
- Demo data includes orderId field
- No actual order_id filtering implemented
- Uses demo Communication type (not real Message type)

---

## UI Objectives (Read-Only)

### 1. Orders List / Table - Message Count Display

**Component:** `SortableOrdersTable.tsx`

**Requirement:**
- Display a message count per order
- Count = number of messages linked by order_id
- No interaction required (badge or text only)

**Implementation Approach:**
- Add message count calculation using `useMessagesByOrder()` hook for each order
- Display count as Badge or text in table cell
- Can be added as new column or appended to existing column
- Count should update when messages change (React Query handles this)

**Data Flow:**
1. For each order in table, call `useMessagesByOrder(order.id)`
2. Extract `data?.length` for message count
3. Display count in table cell (e.g., "5 messages" or badge with count)
4. Handle loading/error states gracefully (show "-" or spinner)

**Considerations:**
- Multiple `useMessagesByOrder()` calls may impact performance
- Consider batching or memoization if many orders displayed
- Count of 0 should still be displayed (e.g., "0 messages" or empty badge)

### 2. Order Detail View - Related Messages Display

**Component:** `OrderDetailsSidebar.tsx`

**Requirement:**
- Display related messages for the order (read-only)
- Use `useMessagesByOrder(order_id)` hook
- No message creation, editing, or status changes

**Implementation Approach:**
- Add new section in sidebar: "Related Messages"
- Use `useMessagesByOrder(order.id)` to fetch messages
- Display message list with basic info: subject, sender, date
- Messages should be read-only (no edit/delete actions)
- Optional: Allow navigation to message detail (future work, not in scope)

**Data Flow:**
1. When order is selected, call `useMessagesByOrder(order.id)`
2. Receive Message[] array from hook
3. Display messages in list format (Card or List component)
4. Show: subject (or preview), from_name, created_at
5. Handle empty state (no messages) gracefully

**UI Placement:**
- Add after existing order detail sections
- Before or after action buttons
- Use existing Card component for consistency

**Considerations:**
- Messages should be sorted (hook already returns ordered by created_at DESC)
- Limit display to reasonable number (e.g., show 5-10 most recent)
- Consider "View All" link if many messages (optional, not required)

### 3. Unified Inbox - Order Filtering

**Component:** `UnifiedInboxPage.tsx`

**Requirement:**
- Allow optional filtering by order_id
- Default behavior remains unchanged if no order filter is applied
- No new UI components, reuse existing controls if present

**Implementation Approach:**
- Add order_id filter state
- Add filter UI (reuse existing Filter button or add dropdown/select)
- When order_id filter is set, use `fetchMessagesByOrder()` or filter existing messages
- Clear filter to return to default behavior (all messages)

**Data Flow:**
1. Add `selectedOrderId` state (nullable)
2. If `selectedOrderId` is set, use `useMessagesByOrder(selectedOrderId)`
3. If `selectedOrderId` is null, use existing `useMessagesList()` hook
4. Filter UI allows selecting order (or clearing selection)

**UI Options:**
- Add order selector dropdown/select component
- Reuse existing Filter button to open filter panel
- Display selected order filter as badge/chip
- Allow clearing filter to show all messages

**Considerations:**
- Need order list for selector (can use `useOrdersList()` hook)
- Filter should be optional (default shows all messages)
- Should work with existing tab/search filtering (combine filters)

---

## Implementation Approach

### Phase 1: Orders Table - Message Count

**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Changes:**
1. Import `useMessagesByOrder` hook
2. For each order row, call `useMessagesByOrder(order.id)`
3. Extract message count from hook result
4. Add message count display to table cell (new column or append to existing)

**Example Data Flow:**
```typescript
// In table row component
const { data: messages } = useMessagesByOrder(order.id);
const messageCount = messages?.length || 0;
```

**Display Options:**
- New column: "Messages" with count
- Badge next to order ID
- Text appended to customer column

**Performance Considerations:**
- Multiple hooks may cause many queries
- Consider memoization or query optimization
- React Query caching will help with repeated renders

### Phase 2: Order Details Sidebar - Related Messages

**File:** `src/modules/orders/components/OrderDetailsSidebar.tsx`

**Changes:**
1. Import `useMessagesByOrder` hook and `Message` type
2. Call `useMessagesByOrder(order.id)` when order is provided
3. Add "Related Messages" section in sidebar
4. Display message list (subject, sender, date)
5. Handle empty state (no messages)

**UI Structure:**
- New Card component section
- Title: "Related Messages" or "Messages"
- List of messages (Card or ListItem components)
- Each message shows: subject, from_name, created_at (formatted)
- Optional: limit to 5-10 most recent messages

**Example Structure:**
```tsx
{order && (
  <Card>
    <CardHeader>
      <CardTitle>Related Messages</CardTitle>
    </CardHeader>
    <CardContent>
      {messages?.map(message => (
        <div key={message.id}>
          {message.subject} - {message.from_name} - {formatDate(message.created_at)}
        </div>
      ))}
    </CardContent>
  </Card>
)}
```

### Phase 3: Unified Inbox - Order Filtering

**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Changes:**
1. Add `selectedOrderId` state (string | null)
2. Import `useMessagesByOrder` and `useOrdersList` hooks
3. Add order selector UI (Select or Dropdown component)
4. Conditionally use `useMessagesByOrder()` or `useMessagesList()` based on filter
5. Display selected order filter as badge/chip
6. Allow clearing filter

**UI Options:**
- Order selector dropdown near Filter button
- Display selected order as removable badge
- Combine with existing tab/search filters

**Data Flow:**
```typescript
const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
const { data: allMessages } = useMessagesList();
const { data: orderMessages } = useMessagesByOrder(selectedOrderId);

const messages = selectedOrderId ? orderMessages : allMessages;
```

---

## Recommended Implementation Steps

### Step 1: Add Message Count to Orders Table

**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Actions:**
1. Import `useMessagesByOrder` from `@/modules/inbox/hooks/useMessages`
2. Create helper component or hook to get message count for order
3. Add message count column or append to existing column
4. Display count as Badge or text
5. Handle loading/error states

**Considerations:**
- Multiple `useMessagesByOrder()` calls (one per order) may be inefficient
- Consider batch fetching or memoization
- React Query will cache results, reducing duplicate requests

### Step 2: Add Related Messages to Order Details Sidebar

**File:** `src/modules/orders/components/OrderDetailsSidebar.tsx`

**Actions:**
1. Import `useMessagesByOrder` and `Message` type
2. Call `useMessagesByOrder(order.id)` hook
3. Add "Related Messages" Card section after order details
4. Map messages to display list
5. Format dates using existing date utilities
6. Handle empty state

**Placement:**
- After order detail cards
- Before action buttons section
- Or after action buttons (user preference)

### Step 3: Add Order Filter to Unified Inbox

**File:** `src/modules/inbox/pages/UnifiedInboxPage.tsx`

**Actions:**
1. Import `useMessagesByOrder`, `useMessagesList`, and `useOrdersList`
2. Add `selectedOrderId` state
3. Add order selector UI (Select component)
4. Conditionally render messages based on filter
5. Add filter badge/chip for selected order
6. Allow clearing filter

**UI Integration:**
- Add order selector near existing Filter button
- Or integrate into existing filter panel if one exists
- Display selected order as removable badge

---

## What NOT to Do

- ❌ Do NOT change database schema or migrations
- ❌ Do NOT add message creation or editing functionality
- ❌ Do NOT add message status changes (read/unread)
- ❌ Do NOT introduce automation or triggers
- ❌ Do NOT add new UI components or layouts (reuse existing)
- ❌ Do NOT change styling or navigation patterns
- ❌ Do NOT modify auth, RLS, or permissions
- ❌ Do NOT add real-time subscriptions
- ❌ Do NOT add notifications
- ❌ Do NOT touch Jobs, Payments, or Invoices modules
- ❌ Do NOT add business logic or workflow automation
- ❌ Do NOT make "Add Note" button functional (out of scope)

---

## Files to Modify

### Orders Module

1. **`src/modules/orders/components/SortableOrdersTable.tsx`**
   - Add message count display per order
   - Import `useMessagesByOrder` hook
   - Add message count column or badge

2. **`src/modules/orders/components/OrderDetailsSidebar.tsx`**
   - Add related messages section
   - Import `useMessagesByOrder` hook and `Message` type
   - Display message list (read-only)

### Inbox Module

3. **`src/modules/inbox/pages/UnifiedInboxPage.tsx`**
   - Add order filtering capability
   - Import `useMessagesByOrder`, `useMessagesList`, `useOrdersList`
   - Add order selector UI
   - Conditionally filter messages by order_id

### Files NOT Modified

- ❌ No database migration files
- ❌ No schema files
- ❌ No API query function files (already implemented)
- ❌ No hook files (already implemented)
- ❌ No type definition files (already implemented)
- ❌ No styling or layout files
- ❌ No auth or permission files

---

## Data Flow Summary

### Message Count in Orders Table

```
OrdersPage → SortableOrdersTable
  ↓
For each order: useMessagesByOrder(order.id)
  ↓
Extract messages.length
  ↓
Display count as Badge/text
```

### Related Messages in Order Details

```
OrderDetailsSidebar (receives order)
  ↓
useMessagesByOrder(order.id)
  ↓
Display Message[] in list format
  ↓
Show: subject, from_name, created_at
```

### Order Filter in Unified Inbox

```
UnifiedInboxPage
  ↓
selectedOrderId state (nullable)
  ↓
If selectedOrderId: useMessagesByOrder(selectedOrderId)
Else: useMessagesList()
  ↓
Display filtered messages
```

---

## Success Criteria

✅ **Orders Table:**
- Message count displayed per order (badge or text)
- Count reflects actual number of messages linked by order_id
- Count updates when messages change (via React Query)

✅ **Order Details Sidebar:**
- Related messages section displays
- Shows messages linked to order via order_id
- Messages displayed in read-only format
- Empty state handled gracefully

✅ **Unified Inbox:**
- Order filter option available
- Filtering by order_id works correctly
- Default behavior (all messages) preserved when no filter
- Filter can be cleared

✅ **Validation:**
- No database schema changes
- No migration files modified
- No business logic added
- No UI layout/styling changes (beyond adding data)
- Build succeeds
- Types are correct

---

## Open Questions / Considerations

1. **Performance:**
   - Multiple `useMessagesByOrder()` calls in table (one per order)
   - React Query caching will help, but may still cause many queries
   - Consider: Should we batch fetch messages for all orders at once?
   - Or accept multiple queries as acceptable for MVP?

2. **Message Count Display:**
   - Should count be a new column or appended to existing?
   - Should count of 0 be displayed or hidden?
   - Should count be clickable to filter inbox by order (future work)?

3. **Related Messages Limit:**
   - Should we limit number of messages displayed in sidebar?
   - If many messages, show "View All" link (future work)?
   - Or show all messages (may cause performance issues)?

4. **Order Filter UI:**
   - Best UI pattern for order selector?
   - Dropdown, searchable select, or text input?
   - Where to place filter UI (near Filter button, in filter panel)?

5. **Unified Inbox Current State:**
   - Currently uses demo data, not real database queries
   - Should we migrate to real queries as part of this work?
   - Or keep demo data and just add order filtering to demo data?

These questions should be answered during implementation planning, but do not block specification.

---

## Confirmation Checklist

✅ **No Schema Changes:**
- No database migrations
- No table alterations
- No column additions/deletions
- Schema already supports relationship (order_id exists)

✅ **No Business Logic:**
- No automation
- No triggers
- No workflow logic
- Read-only display only

✅ **No UI Redesign:**
- Reuse existing components
- No layout changes
- No styling changes (beyond adding data)
- Minimal, incremental changes

✅ **Existing Data Access Used:**
- Use `fetchMessagesByOrder()` function (already exists)
- Use `useMessagesByOrder()` hook (already exists)
- No new query functions needed

✅ **Read-Only:**
- Message counts (display only)
- Related messages list (display only)
- No message creation/editing
- No status changes

This specification focuses on minimal UI awareness of existing relationship, with no schema or business logic changes required.

