# Implementation Plan: Refactor Invoice creation to be order-centric with inline Orders (UI-only)

## Overview

This plan refactors the Invoice creation form to support inline Order creation, automatic amount calculation, and Person selection from the People module. All changes are UI-only with no database schema modifications.

**Goal:** Transform Invoice creation from manual amount entry to order-centric flow where Orders are created inline and Invoice amount is calculated automatically.

**Constraints:**
- UI-only changes (no database schema changes)
- No migrations
- No backend API changes
- Existing tables remain unchanged
- Backward compatible with existing Invoices

---

## Phase 1: Update Invoice Form Schema

### Task 1.1: Remove `order_id` and Make `amount` Optional

**File:** `src/modules/invoicing/schemas/invoice.schema.ts`

**Current State:**
```typescript
export const invoiceFormSchema = z.object({
  order_id: z.string().uuid().optional().nullable().or(z.literal('')),
  customer_name: z.string().min(1, 'Customer name is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  // ... other fields
});
```

**Change Required:**
```typescript
export const invoiceFormSchema = z.object({
  // Remove order_id field (no longer needed)
  customer_name: z.string().min(1, 'Person name is required'),
  amount: z.number().min(0, 'Amount must be non-negative').optional(), // Make optional, calculated client-side
  // ... other fields
});
```

**Rationale:**
- `order_id` removed: Orders will be created inline, not selected
- `amount` made optional: Will be calculated from Orders, not user input
- Validation updated: Minimum 0 instead of 0.01 (allows 0 if no Orders)

**Validation:**
- Schema compiles without errors
- TypeScript types update correctly
- Form validation works with calculated amount

---

## Phase 2: Update CreateInvoiceDrawer Component

### Task 2.1: Remove Order Selection and Manual Amount Input

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Current State:**
- Lines 107-138: "Order (Optional)" dropdown field
- Lines 162-181: Manual "Amount ($)" input field

**Change Required:**
- Remove entire "Order Selection" section (lines 107-138)
- Remove manual "Amount ($)" input field (lines 162-181)
- Keep all other fields unchanged

**Validation:**
- Component compiles without errors
- No references to removed fields
- Form still works correctly

### Task 2.2: Add Person Selector

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Location:** Replace "Person Information" section (lines 140-156)

**Change Required:**

1. **Import People module:**
```typescript
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
```

2. **Fetch people data:**
```typescript
const { data: customers } = useCustomersList();
```

3. **Replace free-text input with Select dropdown:**
```typescript
{/* Person Information */}
<div className="space-y-4">
  <h3 className="text-sm font-semibold">Person Information</h3>
  <FormField
    control={form.control}
    name="customer_name"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Person *</FormLabel>
        <Select
          onValueChange={(value) => {
            const customer = customers?.find(c => c.id === value);
            if (customer) {
              field.onChange(`${customer.first_name} ${customer.last_name}`);
            }
          }}
          value={customers?.find(c => `${c.first_name} ${c.last_name}` === field.value)?.id ?? undefined}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select person" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {!customers || customers.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">No people available</div>
            ) : (
              customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.first_name} {customer.last_name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
</div>
```

**Rationale:**
- Replaces free-text with validated Person selection
- Stores full name as snapshot in `customer_name`
- No `person_id` column (UI-only change)

**Validation:**
- Person selector displays correctly
- Selected person name stored in `customer_name`
- Form validation works

### Task 2.3: Add Orders Section with Inline Creation

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Location:** Add after "Person Information" section, before "Invoice Details"

**Change Required:**

1. **Import Order dependencies:**
```typescript
import { useCreateOrder } from '@/modules/orders/hooks/useOrders';
import { orderFormSchema, type OrderFormData } from '@/modules/orders/schemas/order.schema';
import { useMemorialsList } from '@/modules/memorials/hooks/useMemorials';
import { transformMemorialsFromDb } from '@/modules/memorials/utils/memorialTransform';
import type { UIMemorial } from '@/modules/memorials/utils/memorialTransform';
```

2. **Add state for Orders:**
```typescript
const [orders, setOrders] = useState<Array<{ id: string; data: Partial<OrderFormData> }>>([]);
const [selectedProductIds, setSelectedProductIds] = useState<Record<string, string>>({});
const [dimensions, setDimensions] = useState<Record<string, string>>({});
```

3. **Add Orders section UI:**
```typescript
{/* Orders */}
<div className="space-y-4">
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-semibold">Orders</h3>
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        const newId = `temp-${Date.now()}`;
        setOrders([...orders, { id: newId, data: {} }]);
      }}
    >
      Add Order
    </Button>
  </div>
  
  {orders.length === 0 && (
    <div className="text-sm text-muted-foreground p-4 border rounded">
      No orders added. Click "Add Order" to create an order for this invoice.
    </div>
  )}
  
  {orders.map((order, index) => (
    <OrderFormInline
      key={order.id}
      order={order}
      index={index}
      onUpdate={(data) => {
        setOrders(orders.map(o => o.id === order.id ? { ...o, data } : o));
      }}
      onRemove={() => {
        setOrders(orders.filter(o => o.id !== order.id));
        const newSelectedProductIds = { ...selectedProductIds };
        delete newSelectedProductIds[order.id];
        setSelectedProductIds(newSelectedProductIds);
        const newDimensions = { ...dimensions };
        delete newDimensions[order.id];
        setDimensions(newDimensions);
      }}
      selectedProductId={selectedProductIds[order.id] || ''}
      onProductSelect={(productId) => {
        setSelectedProductIds({ ...selectedProductIds, [order.id]: productId });
      }}
      dimensions={dimensions[order.id] || ''}
      onDimensionsChange={(value) => {
        setDimensions({ ...dimensions, [order.id]: value });
      }}
    />
  ))}
</div>
```

**Note:** `OrderFormInline` component will be created in Phase 3.

**Validation:**
- Orders section renders correctly
- Add/remove Orders works
- State management works correctly

### Task 2.4: Add Calculated Amount Display

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Location:** Replace "Invoice Details" section (lines 158-211)

**Change Required:**

1. **Calculate amount from Orders:**
```typescript
const calculatedAmount = useMemo(() => {
  return orders.reduce((sum, order) => {
    const orderValue = order.data.value ?? 0;
    return sum + orderValue;
  }, 0);
}, [orders]);
```

2. **Update form with calculated amount:**
```typescript
useEffect(() => {
  form.setValue('amount', calculatedAmount);
}, [calculatedAmount, form]);
```

3. **Display read-only amount:**
```typescript
{/* Invoice Details */}
<div className="space-y-4">
  <h3 className="text-sm font-semibold">Invoice Details</h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormItem>
      <FormLabel>Amount ($) *</FormLabel>
      <FormControl>
        <Input
          type="number"
          step="0.01"
          value={calculatedAmount.toFixed(2)}
          readOnly
          className="bg-muted"
        />
      </FormControl>
      <p className="text-xs text-muted-foreground">
        Calculated from orders
      </p>
    </FormItem>
    {/* Status field remains unchanged */}
  </div>
</div>
```

**Rationale:**
- Amount calculated live from Orders
- Displayed as read-only
- Automatically updates when Orders change

**Validation:**
- Amount calculates correctly
- Updates live when Orders change
- Stored in form state

### Task 2.5: Update Form Submission Flow

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Location:** Update `onSubmit` function (lines 63-92)

**Change Required:**

```typescript
const onSubmit = async (data: InvoiceFormData) => {
  // Validate at least one Order exists
  if (orders.length === 0) {
    toast({
      title: 'Error',
      description: 'At least one order is required.',
      variant: 'destructive',
    });
    return;
  }

  // Validate all Orders
  const orderValidationErrors: string[] = [];
  orders.forEach((order, index) => {
    try {
      orderFormSchema.parse(order.data);
    } catch (error) {
      orderValidationErrors.push(`Order ${index + 1}: ${error instanceof Error ? error.message : 'Invalid'}`);
    }
  });

  if (orderValidationErrors.length > 0) {
    toast({
      title: 'Validation Error',
      description: orderValidationErrors.join('\n'),
      variant: 'destructive',
    });
    return;
  }

  // Calculate final amount
  const finalAmount = orders.reduce((sum, order) => sum + (order.data.value ?? 0), 0);

  // Create Invoice first
  const invoiceData = {
    ...data,
    amount: finalAmount,
    order_id: null, // No longer used
    payment_method: data.payment_method ?? null,
    payment_date: data.payment_date ?? null,
    notes: data.notes ?? null,
    issue_date: data.issue_date || new Date().toISOString().split('T')[0],
  };

  createInvoice(invoiceData, {
    onSuccess: async (createdInvoice) => {
      // Create all Orders with invoice_id
      const orderPromises = orders.map(async (order) => {
        const notesValue = buildNotes(dimensions[order.id] || '', order.data.notes || '');
        
        const orderData = {
          customer_name: order.data.customer_name?.trim() || '',
          location: order.data.location?.trim() || '',
          sku: order.data.sku?.trim() || '',
          order_type: order.data.order_type!,
          material: order.data.material || null,
          color: order.data.color || null,
          value: order.data.value ?? null,
          notes: notesValue,
          latitude: order.data.latitude ?? null,
          longitude: order.data.longitude ?? null,
          customer_email: null,
          customer_phone: null,
          stone_status: 'NA' as const,
          permit_status: 'pending' as const,
          proof_status: 'Not_Received' as const,
          deposit_date: null,
          second_payment_date: null,
          due_date: null,
          installation_date: null,
          progress: 0,
          assigned_to: null,
          priority: 'medium' as const,
          timeline_weeks: 12,
          invoice_id: createdInvoice.id,
        };

        return createOrder(orderData);
      });

      try {
        await Promise.all(orderPromises);
        toast({
          title: 'Invoice created',
          description: `Invoice and ${orders.length} order(s) created successfully.`,
        });
        form.reset();
        setOrders([]);
        setSelectedProductIds({});
        setDimensions({});
        onOpenChange(false);
      } catch (error) {
        const description = error instanceof Error ? error.message : 'Failed to create some orders.';
        toast({
          title: 'Partial Success',
          description: 'Invoice created, but some orders failed to create.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: unknown) => {
      const description = error instanceof Error ? error.message : 'Failed to create invoice.';
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    },
  });
};
```

**Helper function:**
```typescript
const buildNotes = (dimensions: string, notes: string): string | null => {
  const parts: string[] = [];
  
  if (dimensions?.trim()) {
    parts.push(`Dimensions: ${dimensions.trim()}`);
  }
  
  if (notes?.trim()) {
    parts.push(notes.trim());
  }
  
  return parts.length > 0 ? parts.join('\n\n') : null;
};
```

**Rationale:**
- Invoice created first to get `invoice_id`
- Orders created with `invoice_id` set
- Error handling: If Invoice fails, don't create Orders
- Error handling: If Order fails, show error but keep Invoice

**Validation:**
- Form submission works correctly
- Invoice and Orders created successfully
- Error handling works

---

## Phase 3: Create OrderFormInline Component

### Task 3.1: Create Inline Order Form Component

**File:** `src/modules/invoicing/components/OrderFormInline.tsx` (new file)

**Purpose:** Reusable component for inline Order creation within Invoice form

**Implementation:**

```typescript
import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { orderFormSchema, type OrderFormData } from '@/modules/orders/schemas/order.schema';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { useMemorialsList } from '@/modules/memorials/hooks/useMemorials';
import { transformMemorialsFromDb } from '@/modules/memorials/utils/memorialTransform';
import type { UIMemorial } from '@/modules/memorials/utils/memorialTransform';
import { X } from 'lucide-react';

interface OrderFormInlineProps {
  order: { id: string; data: Partial<OrderFormData> };
  index: number;
  onUpdate: (data: Partial<OrderFormData>) => void;
  onRemove: () => void;
  selectedProductId: string;
  onProductSelect: (productId: string) => void;
  dimensions: string;
  onDimensionsChange: (value: string) => void;
}

export const OrderFormInline: React.FC<OrderFormInlineProps> = ({
  order,
  index,
  onUpdate,
  onRemove,
  selectedProductId,
  onProductSelect,
  dimensions,
  onDimensionsChange,
}) => {
  const { data: memorialsData } = useMemorialsList();
  
  const products = useMemo(() => {
    if (!memorialsData) return [];
    return transformMemorialsFromDb(memorialsData);
  }, [memorialsData]);

  const getProductDisplayName = (product: UIMemorial): string => {
    return product.name || product.memorialType || `Product ${product.id.substring(0, 8)}`;
  };

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customer_name: order.data.customer_name || '',
      order_type: order.data.order_type,
      sku: order.data.sku || '',
      location: order.data.location || '',
      latitude: order.data.latitude ?? null,
      longitude: order.data.longitude ?? null,
      material: order.data.material || '',
      color: order.data.color || '',
      value: order.data.value ?? null,
      notes: order.data.notes || '',
      // ... other required fields with defaults
    },
  });

  // Update parent when form changes
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      onUpdate(value as Partial<OrderFormData>);
    });
    return () => subscription.unsubscribe();
  }, [form, onUpdate]);

  // Handle product selection
  const handleProductSelect = (productId: string) => {
    onProductSelect(productId);
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue('material', product.material || '');
      form.setValue('color', product.color || '');
      form.setValue('value', product.price ?? null);
      onDimensionsChange(product.dimensions || '');
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Order {index + 1}</h4>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Form {...form}>
        {/* Order Type */}
        <FormField
          control={form.control}
          name="order_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order Type *</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ?? undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select order type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="New Memorial">New Memorial</SelectItem>
                  <SelectItem value="Renovation">Renovation</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Deceased & Location */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="customer_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deceased Name *</FormLabel>
                <FormControl>
                  <Input placeholder="John Smith" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location *</FormLabel>
                <FormControl>
                  <Input placeholder="Oak Hill Cemetery" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grave Number *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Plot 123" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Coordinates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="latitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Latitude</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.00000001"
                    placeholder="e.g., 51.5074"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="longitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Longitude</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.00000001"
                    placeholder="e.g., -0.1278"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Product Selection */}
        <div>
          <Select
            value={selectedProductId}
            onValueChange={handleProductSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a product (optional)" />
            </SelectTrigger>
            <SelectContent>
              {products.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No products available</div>
              ) : (
                products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {getProductDisplayName(product)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Product Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="material"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stone Type</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Black Granite" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stone Color</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Jet Black" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem>
            <FormLabel>Dimensions</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g., 24x18x4"
                value={dimensions}
                onChange={(e) => onDimensionsChange(e.target.value)}
              />
            </FormControl>
          </FormItem>
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes..."
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </div>
  );
};
```

**Rationale:**
- Reuses Order form fields from `CreateOrderDrawer`
- Supports inline editing
- Integrates with parent component state
- Validates using `orderFormSchema`

**Validation:**
- Component renders correctly
- Form validation works
- Updates parent state correctly

---

## Phase 4: Verification and Testing

### Task 4.1: TypeScript Compilation

**Verification Steps:**
1. Run `npm run build` to check TypeScript compilation
2. Verify no type errors
3. Verify all imports resolve correctly

**Expected Result:**
- Build succeeds without errors
- No TypeScript errors

### Task 4.2: Form Validation

**Verification Steps:**
1. Test Invoice creation with 0 Orders (should fail)
2. Test Invoice creation with 1 Order
3. Test Invoice creation with multiple Orders
4. Test Person selection
5. Test amount calculation

**Expected Result:**
- Validation works correctly
- Error messages are clear
- Amount calculates correctly

### Task 4.3: Integration Testing

**Verification Steps:**
1. Create Invoice with multiple Orders
2. Verify Invoice is created with correct amount
3. Verify all Orders are created with `invoice_id`
4. Verify Person name is stored correctly
5. Test error handling (Invoice fails, Order fails)

**Expected Result:**
- Invoice and Orders created successfully
- All data stored correctly
- Error handling works

---

## Verification Checklist

After completing all phases, verify:

- [ ] Invoice form schema updated (removed `order_id`, `amount` optional)
- [ ] Order selection dropdown removed
- [ ] Manual amount input removed
- [ ] Person selector added (from People module)
- [ ] Orders section added with inline creation
- [ ] Amount calculated live from Orders
- [ ] OrderFormInline component created
- [ ] Form submission creates Invoice first, then Orders
- [ ] Orders linked to Invoice via `invoice_id`
- [ ] Error handling works correctly
- [ ] TypeScript compilation succeeds
- [ ] No runtime errors
- [ ] Existing Invoices remain unchanged

---

## File Changes Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| `src/modules/invoicing/schemas/invoice.schema.ts` | Remove `order_id`, make `amount` optional | ~5 lines modified |
| `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | Major refactor: add Orders section, Person selector, amount calculation | ~300 lines modified |
| `src/modules/invoicing/components/OrderFormInline.tsx` | New component for inline Order creation | ~350 lines (new file) |

**Total Estimated Changes:** ~655 lines across 3 files (1 new file, 2 modified)

---

## Success Criteria

- ✅ Invoice creation form supports inline Order creation
- ✅ Multiple Orders can be added to single Invoice
- ✅ Invoice amount updates live from Orders
- ✅ Amount is calculated as sum of Orders' `value` fields
- ✅ Person is selected from People module dropdown
- ✅ Person name is stored as snapshot in `customer_name`
- ✅ Invoice and Orders are created successfully in one flow
- ✅ Orders are linked to Invoice via `invoice_id`
- ✅ Existing Invoices remain unchanged
- ✅ No database schema changes
- ✅ No runtime or TypeScript errors
- ✅ Form validation works correctly
- ✅ Error handling is graceful

---

## Implementation Notes

1. **State Management:**
   - Use React state for Orders array
   - Use React Hook Form for Invoice form
   - Use separate form state for each Order in OrderFormInline

2. **Amount Calculation:**
   - Use `useMemo` for efficient calculation
   - Update form value with `useEffect`
   - Display as read-only input

3. **Person Selection:**
   - Fetch people using `useCustomersList()`
   - Store full name as snapshot
   - No `person_id` column (UI-only)

4. **Order Creation:**
   - Create Invoice first to get `invoice_id`
   - Create Orders with `invoice_id` set
   - Handle errors appropriately

5. **Validation:**
   - Validate at least one Order exists
   - Validate each Order using `orderFormSchema`
   - Show clear error messages

---

## Conclusion

This implementation plan provides a step-by-step guide to refactor Invoice creation to be order-centric with inline Orders. All changes are UI-only, maintaining backward compatibility with existing Invoices and requiring no database schema changes.

