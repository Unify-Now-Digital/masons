# Implementation Plan: Orders Customer Details Popover on Customer Column

**Branch:** `feature/orders-customer-details-popover`  
**Specification:** `specs/orders-customer-details-popover.md`

---

## Overview

This implementation plan adds a clickable customer name in the Orders table that opens a popover card showing customer (Person) details. The popover displays information from the People module (linked via `person_id`) with fallback to snapshot fields, and includes a "Messages (Coming soon)" section.

**Goal:** 
- Make customer name clickable in Orders table
- Open popover card on click showing customer details
- Prefer People data via `person_id`, fallback to snapshot fields
- Include "Messages (Coming soon)" placeholder section
- Lazy-load Person data only when popover opens

**Constraints:**
- No database changes or migrations
- No changes to Orders table structure (additive UI only)
- Reuse existing `useCustomer` hook from Customers module
- Must not break existing Orders table functionality
- Performance: no prefetching, proper lazy loading

---

## Phase 1 — CustomerDetailsPopover Component

### Task 1.1: Create CustomerDetailsPopover Component File

**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Create new component file with basic structure using shadcn/ui Popover and Card components.

**Component Structure:**
```typescript
import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { useCustomer } from '@/modules/customers/hooks/useCustomers';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface CustomerDetailsPopoverProps {
  personId?: string | null;
  fallbackName?: string | null;
  fallbackPhone?: string | null;
  fallbackEmail?: string | null;
  trigger: React.ReactNode;
}

export const CustomerDetailsPopover: React.FC<CustomerDetailsPopoverProps> = ({
  personId,
  fallbackName,
  fallbackPhone,
  fallbackEmail,
  trigger,
}) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  
  // Data fetching - only when popover is open and personId exists
  const { data: person, isLoading, error } = useCustomer(personId || '', {
    enabled: open && !!personId,
  });
  
  // Component implementation...
};
```

**Validation:**
- Component file created
- Imports correct
- Basic structure in place

---

### Task 1.2: Implement Popover State and Trigger

**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Implement popover open/close state management and trigger rendering.

**Changes:**
```typescript
return (
  <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      {trigger}
    </PopoverTrigger>
    <PopoverContent className="w-80" align="start">
      {/* Content will be added in next tasks */}
    </PopoverContent>
  </Popover>
);
```

**Validation:**
- Popover opens/closes on trigger click
- State management works correctly
- Trigger renders correctly

---

### Task 1.3: Implement Data Fetching Logic

**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Implement lazy-loading data fetch using `useCustomer` hook, enabled only when popover is open and personId exists.

**Changes:**
```typescript
// Inside component
const { data: person, isLoading, error } = useCustomer(personId || '', {
  enabled: open && !!personId,
});

// Determine display values with fallbacks
const displayName = person 
  ? `${person.first_name} ${person.last_name}` 
  : (fallbackName || '—');
  
const displayPhone = person?.phone || fallbackPhone || '—';
const displayEmail = person?.email || fallbackEmail || '—';
const displayAddress = person?.address 
  ? `${person.address}${person.city ? `, ${person.city}` : ''}${person.country ? `, ${person.country}` : ''}`
  : '—';

const isLinked = !!personId && !!person && !error;
```

**Validation:**
- Query only runs when popover is open and personId exists
- Fallback values used correctly
- Loading and error states handled

---

### Task 1.4: Implement Header Section

**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Implement header with customer name and Linked/Unlinked badge.

**Changes:**
```typescript
<CardHeader className="pb-3">
  <div className="flex items-center justify-between">
    <CardTitle className="text-base font-semibold">
      {displayName}
    </CardTitle>
    <Badge variant={isLinked ? "default" : "secondary"}>
      {isLinked ? "Linked" : "Unlinked"}
    </Badge>
  </div>
</CardHeader>
```

**Validation:**
- Header displays customer name correctly
- Badge shows "Linked" when person loaded
- Badge shows "Unlinked" when personId null or fetch fails

---

### Task 1.5: Implement Basic Info Section

**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Implement basic info section showing phone, email, and address with fallbacks.

**Changes:**
```typescript
<CardContent className="space-y-2">
  {isLoading ? (
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  ) : (
    <>
      <div className="text-sm">
        <span className="font-medium">Phone:</span> {displayPhone}
      </div>
      <div className="text-sm">
        <span className="font-medium">Email:</span> {displayEmail}
      </div>
      {displayAddress !== '—' && (
        <div className="text-sm">
          <span className="font-medium">Address:</span> {displayAddress}
        </div>
      )}
    </>
  )}
</CardContent>
```

**Validation:**
- Basic info displays correctly
- Loading skeleton shows while fetching
- Fallback values used when person data unavailable
- "—" shown for missing fields

---

### Task 1.6: Implement Actions Section

**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Implement "Open Person" button that navigates to customers page, only shown when personId exists.

**Changes:**
```typescript
{personId && (
  <CardContent className="pt-0">
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        navigate('/dashboard/customers');
        setOpen(false);
      }}
      className="w-full"
    >
      Open Person
    </Button>
  </CardContent>
)}
```

**Validation:**
- Button only shows when personId exists
- Navigation works correctly
- Popover closes on navigation

---

### Task 1.7: Implement Messages Section

**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Implement "Messages (Coming soon)" placeholder section.

**Changes:**
```typescript
<CardContent className="pt-0 border-t">
  <div className="space-y-2">
    <h4 className="text-sm font-semibold">Messages</h4>
    <p className="text-sm text-muted-foreground">
      Coming soon — Inbox messages are not connected to People yet.
    </p>
    {/* Optional: disabled skeleton rows for future layout */}
    <div className="space-y-1 opacity-50">
      <div className="h-3 bg-muted rounded" />
      <div className="h-3 bg-muted rounded w-3/4" />
    </div>
  </div>
</CardContent>
```

**Validation:**
- Messages section displays correctly
- Placeholder text shown
- Optional skeleton rows included

---

## Phase 2 — Orders Table Integration

### Task 2.1: Update UIOrder Interface

**File:** `src/modules/orders/utils/orderTransform.ts`

**Description:**
Add `personId` and fallback fields to UIOrder interface.

**Changes:**
```typescript
export interface UIOrder {
  id: string;
  customer: string;
  deceasedName: string;
  personId?: string | null; // NEW
  fallbackPhone?: string | null; // NEW
  fallbackEmail?: string | null; // NEW
  // ... rest of existing fields
}
```

**Validation:**
- Interface updated correctly
- TypeScript compiles without errors

---

### Task 2.2: Update transformOrderForUI Function

**File:** `src/modules/orders/utils/orderTransform.ts`

**Description:**
Update transform function to include personId and fallback fields in UIOrder.

**Changes:**
```typescript
export function transformOrderForUI(order: Order): UIOrder {
  // Existing customer name resolution...
  const customerName = order.person_name 
    || (order.customers ? `${order.customers.first_name} ${order.customers.last_name}` : null)
    || '—';

  return {
    id: order.id,
    customer: customerName,
    deceasedName: order.customer_name,
    personId: order.person_id, // NEW
    fallbackPhone: order.customer_phone, // NEW
    fallbackEmail: order.customer_email, // NEW
    // ... rest of existing fields
  };
}
```

**Validation:**
- Transform function includes new fields
- Existing functionality preserved
- All tests pass

---

### Task 2.3: Update SortableOrdersTable Customer Column

**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Description:**
Add specific case for 'customer' column to render CustomerDetailsPopover instead of plain text.

**Changes:**
```typescript
// Add import
import { CustomerDetailsPopover } from './CustomerDetailsPopover';

// In the switch statement, add case for 'customer':
case 'customer':
  return (
    <TableCell key={columnKey}>
      {order.customer && order.customer !== '—' ? (
        <CustomerDetailsPopover
          personId={order.personId}
          fallbackName={order.customer}
          fallbackPhone={order.fallbackPhone}
          fallbackEmail={order.fallbackEmail}
          trigger={
            <button className="text-left hover:underline text-sm font-medium">
              {order.customer}
            </button>
          }
        />
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      )}
    </TableCell>
  );
```

**Validation:**
- Customer column renders popover correctly
- Clickable customer name works
- "—" shown when no customer name
- No layout shift in table

---

## Phase 3 — Navigation & Polish

### Task 3.1: Verify Popover Behavior

**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Ensure popover opens on click, closes on outside click/ESC, and has appropriate width.

**Validation:**
- Popover opens on trigger click
- Closes on outside click
- Closes on ESC key
- Width appropriate for table context (w-80 = 320px)
- No layout shift in table rows

---

### Task 3.2: Add Loading States

**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Ensure loading skeleton displays correctly while Person data loads.

**Validation:**
- Loading skeleton shows while fetching
- Smooth transition to content
- No flickering

---

### Task 3.3: Verify Accessibility

**File:** `src/modules/orders/components/CustomerDetailsPopover.tsx`

**Description:**
Ensure keyboard navigation and focus management work correctly.

**Validation:**
- Keyboard focus works correctly
- Click target large enough (button element)
- Screen reader friendly

---

## Phase 4 — Validation

### Task 4.1: Test Orders Page Loading

**Validation:**
- Orders page loads without errors
- Table renders correctly
- No console errors

---

### Task 4.2: Test Popover Opening

**Validation:**
- Clicking customer name opens popover
- Popover content displays correctly
- No crashes or errors

---

### Task 4.3: Test Lazy Loading

**Validation:**
- Person data fetch occurs only on popover open (verify in Network tab)
- No prefetching for all rows
- Caching works (multiple orders with same person_id share data)

---

### Task 4.4: Test Fallback Scenarios

**Validation:**
- Snapshot fallback works when person_id is null
- Snapshot fallback works when person fetch fails
- "Unlinked" badge shown correctly
- All fields display correctly with fallbacks

---

### Task 4.5: Test Navigation

**Validation:**
- "Open Person" button navigates to `/dashboard/customers`
- Button only shows when personId exists
- Popover closes on navigation

---

### Task 4.6: Test Messages Section

**Validation:**
- Messages section displays correctly
- "Coming soon" placeholder text shown
- Optional skeleton rows visible

---

### Task 4.7: Build & Lint Validation

**Validation:**
- Build passes (`npm run build`)
- Lint passes (`npm run lint`)
- No TypeScript errors
- No console warnings

---

## Deliverables

- ✅ `CustomerDetailsPopover` reusable component
- ✅ Orders table updated to use popover for Customer column
- ✅ UIOrder interface updated with personId and fallback fields
- ✅ transformOrderForUI updated to include new fields
- ✅ Lazy-loaded People data with safe fallbacks
- ✅ No schema or migration changes
- ✅ All tests pass
- ✅ Build and lint pass

---

## Success Criteria

- Clicking customer name in Orders table opens popover
- Popover shows customer details (name, phone, email, address)
- Person data loads only when popover opens (lazy loading)
- Fallback to snapshot fields if person_id null or fetch fails
- "Linked" badge shown when person_id exists and loaded
- "Unlinked" badge shown when person_id null or fetch fails
- "Open Person" link navigates to `/dashboard/customers` (when person_id exists)
- "Messages (Coming soon)" section displayed
- No performance issues (no prefetching, proper caching)
- Build + lint pass
- No runtime crashes

