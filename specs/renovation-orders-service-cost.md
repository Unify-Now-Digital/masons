# Renovation Orders use Service + Cost instead of Product

## Overview

**Context:**
- Orders have two types: "New Memorial" and "Renovation"
- New Memorial orders currently use product selection (from memorials catalog) with product-driven base value
- Renovation orders should NOT require product selection - they are service-based rather than product-based
- Current total calculation: Order Total = Base Value + Permit Cost + Additional Options Total

**Goal:**
- Enable Renovation orders to use manual service description and service cost instead of product selection
- Keep New Memorial orders unchanged (product-driven)
- Maintain consistent total calculation logic across both order types
- Ensure backward compatibility with existing orders

---

## Current State Analysis

### Orders Schema

**Table:** `public.orders`

**Current Structure:**
- `order_type`: string (values: "New Memorial", "Renovation")
- `value`: numeric, nullable (base value from product or manual entry)
- `material`: text, nullable (from product)
- `color`: text, nullable (from product)
- `permit_cost`: numeric(10,2), not null default 0
- `additional_options_total`: numeric (from `orders_with_options_total` view)

**Observations:**
- `order_type` distinguishes between New Memorial and Renovation
- `value` field currently stores base value (product price for New Memorial, manual entry for Renovation)
- Product selection fields (material, color) are populated from memorials for New Memorial orders
- No specific fields exist for Renovation service description/cost
- Base value calculation uses `order.value ?? 0` regardless of order type

### UI Patterns

**CreateOrderDrawer / EditOrderDrawer:**
- Currently shows product selector for all orders
- Product selection populates: material, color, value (from product.price)
- No conditional rendering based on `order_type`
- All orders use the same form structure

**OrderDetailsSidebar:**
- Displays product info (material, color) regardless of order type
- Shows base value from `order.value`
- No differentiation between New Memorial and Renovation display

### Calculation Utilities

**Current Implementation (`orderCalculations.ts`):**
- `getOrderBaseValue(order)`: Returns `order.value ?? 0` (no type differentiation)
- `getOrderTotal(order)`: Sums base value + permit cost + additional options
- All calculations are order-type agnostic

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- Add `renovation_service_description text null` to `public.orders`
- Add `renovation_service_cost numeric(10,2) not null default 0` to `public.orders`
- Add column comments for clarity

**Non-Destructive Constraints:**
- Both new columns are nullable or have safe defaults (0 for cost)
- No existing data affected (all existing orders remain valid)
- No table renames or column deletions
- Backward compatibility maintained

### Type System Updates

**Order TypeScript Interface:**
- Add `renovation_service_description?: string | null`
- Add `renovation_service_cost?: number | null`
- Keep existing `order_type`, `value`, `material`, `color` fields unchanged

**Form Schema Updates:**
- Add `renovation_service_description` and `renovation_service_cost` to `OrderFormData`
- Keep validation: cost must be >= 0, description optional
- Use existing `toMoneyNumber` utility for cost parsing

### Calculation Logic Updates

**Base Value Calculation:**
- Update `getOrderBaseValue(order)`:
  - If `order.order_type === 'Renovation'`: return `order.renovation_service_cost ?? 0`
  - Else: return `order.value ?? 0` (existing logic for New Memorial)
- Keep `getOrderTotal()` unchanged (already uses `getOrderBaseValue`)

---

## Implementation Approach

### Phase 1: Database Migration
- Create migration file: `YYYYMMDDHHmmss_add_renovation_fields_to_orders.sql`
- Add `renovation_service_description` (text, null)
- Add `renovation_service_cost` (numeric(10,2), not null, default 0)
- Add column comments
- Verify migration runs successfully

### Phase 2: Type Updates
- Update `Order` TypeScript interface
- Update `OrderFormData` Zod schema
- Ensure backward compatibility (optional fields)

### Phase 3: Calculation Utility Updates
- Update `getOrderBaseValue()` to check order_type
- Add defensive null handling
- Verify `getOrderTotal()` continues to work correctly
- Test with both order types

### Phase 4: UI Updates - CreateOrderDrawer
- Add conditional rendering based on `order_type`:
  - When "Renovation": Hide product selector, show service fields
  - When "New Memorial": Show product selector, hide service fields
- Add "Service / Service Type" text input
- Add "Service Cost (GBP)" number input
- Use `toMoneyNumber` for cost parsing (blank => 0)
- Update form submission to save service fields for Renovation orders

### Phase 5: UI Updates - EditOrderDrawer
- Same conditional rendering as CreateOrderDrawer
- Pre-populate service fields for existing Renovation orders
- Ensure product selection hidden for Renovation orders

### Phase 6: UI Updates - OrderDetailsSidebar
- Conditional display based on order_type:
  - Renovation: Show service description + service cost
  - New Memorial: Show product info (material, color) as current
- Use `getOrderBaseValue()` for base value display (handles type automatically)

### Phase 7: Testing & Validation
- Test creating New Memorial order (product selection works)
- Test creating Renovation order (service fields work, no product selection)
- Test editing both order types
- Verify totals calculate correctly for both types
- Verify invoice totals include renovation orders correctly
- Run TypeScript and lint checks

### Safety Considerations
- Migration is additive only (no data loss risk)
- Existing orders continue to work (backward compatible)
- Default value of 0 for renovation_service_cost ensures no null constraint violations
- Calculation logic defensive against null/undefined

---

## What NOT to Do

- Do not remove or modify existing `order.value` field
- Do not change product selection logic for New Memorial orders
- Do not create separate order tables or types
- Do not modify invoice total calculation (it already uses shared utilities)
- Do not add product validation for Renovation orders
- Do not persist derived totals to database
- Out of scope: Inscriptions relationship, Photos URL, Map geocoding

---

## Open Questions / Considerations

- Should Renovation orders still show material/color fields (currently they're hidden)? → **Decision: Hide product-related fields for Renovation**
- Should service description have character limit? → **Decision: Free text, no limit initially**
- Should service cost be required or optional? → **Decision: Optional (defaults to 0 if blank)**
- How to handle existing Renovation orders without service fields? → **Decision: Default to 0 cost, empty description (backward compatible)**

---

