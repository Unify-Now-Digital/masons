# Tasks: Remove Manual Latitude/Longitude from Order UI

## Task Summary

| # | Task | Type | File | Phase |
|---|------|------|------|-------|
| 1.1 | Remove lat/lng inputs from CreateOrderDrawer | Update | CreateOrderDrawer.tsx | 1 |
| 1.2 | Remove lat/lng from CreateOrderDrawer payload | Update | CreateOrderDrawer.tsx | 1 |
| 1.3 | Remove lat/lng from form defaults (CreateOrderDrawer) | Update | CreateOrderDrawer.tsx | 1 |
| 1.4 | Exclude lat/lng from EditOrderDrawer update payload | Update | EditOrderDrawer.tsx | 1 |
| 2.1 | Remove lat/lng inputs from OrderFormInline | Update | OrderFormInline.tsx | 2 |
| 2.2 | Remove lat/lng from OrderFormInline defaults | Update | OrderFormInline.tsx | 2 |
| 2.3 | Omit lat/lng from CreateInvoiceDrawer order payload | Update | CreateInvoiceDrawer.tsx | 2 |
| 3.1 | Update order.schema.ts (optional passthrough) | Update | order.schema.ts | 3 |
| 3.2 | Verify no lint/TS errors | Verify | - | 3 |
| 4.1 | QA checklist | Verify | - | 4 |

---

## Phase 1: CreateOrderDrawer

### Task 1.1: Remove Lat/Lng Input Fields

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Changes:**
- Remove the entire "Coordinates (Optional)" section (FormFields for `latitude`, `longitude`)
- Section is ~lines 516–562 (Coordinates heading + two FormField blocks)

**Acceptance Criteria:** No latitude/longitude inputs visible in Create Order drawer.

---

### Task 1.2: Stop Sending Lat/Lng in Create Payload

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Changes:**
- In `orderData` object (onSubmit), remove:
  ```ts
  latitude: data.latitude ?? null,
  longitude: data.longitude ?? null,
  ```
- Either omit these keys (DB defaults to null) or explicitly set `latitude: null, longitude: null` to avoid any form leakage

**Acceptance Criteria:** createOrder payload does not include latitude/longitude from form. Geocoding will populate after save.

---

### Task 1.3: Remove from Form Defaults

**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Changes:**
- Remove `latitude: null` and `longitude: null` from `defaultValues` in useForm

**Acceptance Criteria:** Form defaults no longer reference lat/lng (schema still has them optional for type compat).

---

### Task 1.4: Exclude Lat/Lng from EditOrderDrawer Update

**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Changes:**
- In destructuring before building `orderData`, add `latitude` and `longitude` to excluded fields:
  ```ts
  const { additional_options, order_people: _orderPeople, person_id: _pid, person_name: _pname, latitude: _lat, longitude: _lng, ...orderDataWithoutOptions } = data;
  ```
- This ensures we never send lat/lng in the update payload (geocoding owns them)

**Acceptance Criteria:** updateOrder never overwrites latitude/longitude. Existing coords preserved.

---

## Phase 2: OrderFormInline + CreateInvoiceDrawer

### Task 2.1: Remove Lat/Lng Inputs from OrderFormInline

**File:** `src/modules/invoicing/components/OrderFormInline.tsx`

**Changes:**
- Remove the "Coordinates" section (FormFields for `latitude`, `longitude`) — similar structure to CreateOrderDrawer
- Locate ~lines 246–290 (Coordinates heading + two FormField blocks)

**Acceptance Criteria:** No latitude/longitude inputs in inline order form (Invoicing).

---

### Task 2.2: Remove from OrderFormInline Defaults

**File:** `src/modules/invoicing/components/OrderFormInline.tsx`

**Changes:**
- Remove `latitude: order.data.latitude ?? null` and `longitude: order.data.longitude ?? null` from `defaultValues`

**Acceptance Criteria:** Form no longer initializes or tracks lat/lng.

---

### Task 2.3: Omit Lat/Lng from CreateInvoiceDrawer Order Payload

**File:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx`

**Changes:**
- When building order data for creation, remove `latitude` and `longitude` from the payload
- Locate ~lines 239–241 where order is built from `order.data`
- Omit or set to null; geocoding will populate after order is created

**Acceptance Criteria:** New orders from CreateInvoiceDrawer do not send lat/lng; geocoding fills them.

---

## Phase 3: Schema + Cleanup

### Task 3.1: Update order.schema.ts

**File:** `src/modules/orders/schemas/order.schema.ts`

**Changes:**
- Keep `latitude` and `longitude` in schema as `.optional().nullable()` (Order type and API still use them)
- No need to remove — they can remain for type compatibility; form just won't render them
- If schema causes issues with required validation, ensure they stay optional

**Acceptance Criteria:** Schema allows null/omit; no validation errors when lat/lng absent from form.

---

### Task 3.2: Verify Build and Lint

**Commands:**
```bash
npm run build
npm run lint
```

**Acceptance Criteria:** Build passes; no TypeScript errors; no new lint issues.

---

## Phase 4: QA

### Task 4.1: Manual QA Checklist

- [ ] **Create order** — No lat/lng inputs; order saves; geocoding runs (check Map for pin)
- [ ] **Edit order** — No lat/lng shown; save does not wipe existing coordinates
- [ ] **Map view** — Orders with coords still show pins
- [ ] **Create invoice + add order** — Order created without lat/lng; geocoding populates
- [ ] **Build passes**

---

## Commit Plan

**Commit 1:** "Remove manual lat/lng from Order drawer and invoicing"

Includes: CreateOrderDrawer, EditOrderDrawer, OrderFormInline, CreateInvoiceDrawer, order.schema (if needed)

---

## Progress Tracking

**Phase 1**
- [X] Task 1.1: Remove lat/lng inputs (CreateOrderDrawer)
- [X] Task 1.2: Remove from create payload
- [X] Task 1.3: Remove from form defaults
- [X] Task 1.4: Exclude from EditOrderDrawer payload

**Phase 2**
- [X] Task 2.1: Remove lat/lng inputs (OrderFormInline)
- [X] Task 2.2: Remove from OrderFormInline defaults
- [X] Task 2.3: Omit from CreateInvoiceDrawer payload

**Phase 3**
- [X] Task 3.1: Schema update (if needed) — schema already optional
- [X] Task 3.2: Build/lint verify — build passes

**Phase 4**
- [ ] Task 4.1: QA
