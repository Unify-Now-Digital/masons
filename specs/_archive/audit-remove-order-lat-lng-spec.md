# Audit: Latitude/Longitude on Orders — Usage and Safe Removal Plan

## Overview

**Goal:** Before removing latitude/longitude fields from Orders and the Order drawer, audit where these fields exist and where they are used (frontend, backend, DB). Propose the safest removal plan.

**Constraints:**
- Do NOT drop DB columns until we confirm nothing else depends on them
- Start by removing/hiding from UI only AFTER audit confirms usage
- No actual schema changes in this task

---

## Discovery Summary

### 1. Database: Where Columns Exist

| Table | Schema | Column | Data Type | Migration |
|-------|--------|--------|-----------|-----------|
| **orders** | public | latitude | numeric(10,8) | `20251223022543_add_latitude_longitude_to_orders.sql` |
| **orders** | public | longitude | numeric(10,8) | `20251223022543_add_latitude_longitude_to_orders.sql` |
| **jobs** | public | latitude | decimal(10,8) | `20250608000003_create_jobs_table.sql` |
| **jobs** | public | longitude | decimal(11,8) | `20250608000003_create_jobs_table.sql` |

**Views:**
- `public.orders_with_options_total` — uses `o.*`, so includes `latitude` and `longitude` from orders

**Geocode metadata (orders only):**
- `geocode_status`, `geocode_error`, `geocoded_at`, `geocode_place_id` — `20260110150000_add_geocode_metadata_to_orders.sql`

**SQL to run (for verification):**
```sql
-- Find columns
select table_schema, table_name, column_name, data_type
from information_schema.columns
where column_name in ('latitude','longitude','lat','lng')
   or column_name ilike '%lat%'
   or column_name ilike '%lng%'
order by table_name, column_name;

-- Check order-related views
select table_schema, table_name
from information_schema.views
where table_name ilike '%order%';
```

---

### 2. Frontend: Where Fields Are Read/Written

| File | Usage | R/W | Notes |
|------|-------|-----|-------|
| **CreateOrderDrawer.tsx** | Manual lat/lng inputs (form fields) | W | "Coordinates (Optional)" section; writes to order on create |
| **CreateOrderDrawer.tsx** | defaultValues, orderData payload | W | `latitude: null`, `longitude: null`; passes to create |
| **EditOrderDrawer.tsx** | Geocode status + manual recalc | R | Reads `order.latitude`, `order.longitude` for validation; no manual inputs |
| **EditOrderDrawer.tsx** | `hasCoords` / `coordsMissing` checks | R | Validates if order has valid coords for geocode UI |
| **order.schema.ts** | Zod validation | R/W | `latitude` .min(-90).max(90), `longitude` .min(-180).max(180) |
| **orders.types.ts** | Order interface | R | `latitude: number \| null`, `longitude: number \| null` |
| **numberParsing.ts** | normalizeOrder | R | `toNumberOrNull(order.latitude)`, `toNumberOrNull(order.longitude)` |
| **OrderDetailsSidebar.tsx** | — | — | **Does NOT display or edit lat/lng** |
| **OrderFormInline.tsx** (Invoicing) | Manual lat/lng inputs | R/W | Inline order form; reads from order, has form fields |
| **CreateInvoiceDrawer.tsx** | Order selection / creation | R | Passes `latitude`, `longitude` when creating order from invoice flow |
| **map/hooks/useOrders.ts** | Fetch orders for map | R | Filters `.not('latitude','is',null).not('longitude','is',null)` |
| **orderMapTransform.ts** | Transform to map markers | R | Uses `order.latitude`, `order.longitude` for pin coordinates |
| **OrderInfoPanel.tsx** (Map) | Display coordinates | R | Shows `Coordinates: {lat}, {lng}` when valid |
| **Jobs CreateJobDrawer.tsx** | Lat/lng form fields | R/W | Copies from first selected order if empty; jobs have own lat/lng |
| **Jobs EditJobDrawer.tsx** | Lat/lng form fields | R/W | Jobs table has its own latitude/longitude |
| **useGeocodeOrderAddress.ts** | Mutation result | R | Returns `latitude`, `longitude`; invalidates map orders |

---

### 3. Backend / Edge Functions / SQL

| Location | Usage | R/W | Notes |
|----------|-------|-----|-------|
| **geocode-order-address** Edge Function | Writes lat/lng on success | W | Google Geocoding API → updates `orders.latitude`, `orders.longitude` |
| **geocode-order-address** | Reads location, returns coords | R/W | Primary source of lat/lng for orders (after address geocode) |

**Supabase views / RPCs:**
- No RPCs or triggers reference latitude/longitude
- `orders_with_options_total` includes them via `o.*`

---

### 4. Map / Jobs / Installations Dependencies

| Module | Depends On | Impact if Removed |
|--------|------------|-------------------|
| **Map** | `orders.latitude`, `orders.longitude` | **BREAKS** — pins use order coords |
| **Map** | `useOrdersForMap()` filters nulls | Orders without coords are excluded |
| **Jobs** | `jobs.latitude`, `jobs.longitude` (own columns) | Jobs have separate lat/lng; not from orders |
| **Jobs CreateJobDrawer** | Copies from `firstSelectedOrder.latitude/longitude` | If order has coords, job gets them; optional |
| **Installations** | — | No direct lat/lng usage found |

---

### 5. Geocoding Flow

1. User enters **location** (address) in Order drawer
2. Order is created/updated with `location` only (lat/lng may be null)
3. After save: **geocode-order-address** Edge Function is called with `{ orderId, location }`
4. Edge Function calls Google Geocoding API
5. On success: updates `orders.latitude`, `orders.longitude`, `geocode_status`, etc.
6. Map reads `orders.latitude/longitude` for pins

**Manual lat/lng inputs** in CreateOrderDrawer allow:
- Override when geocoding fails
- Pre-fill before geocoding runs
- Legacy / manual coordinate entry

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Map pins disappear | High | Do NOT drop `orders.latitude/longitude` until Map uses another source |
| Geocoding stops working | High | Keep Edge Function; it writes lat/lng |
| Jobs lose order coords | Medium | Jobs have own columns; CreateJob copies from order if present |
| Invoicing order flow | Low | OrderFormInline has lat/lng; can remove if not critical |
| Manual coordinate entry lost | Low | Geocoding is primary path; manual is fallback |

**Conclusion:** `orders.latitude` and `orders.longitude` are **required by the Map module**. They are populated by the geocode-order-address Edge Function. The manual inputs in the Order drawer are optional fallbacks. Safe to remove manual inputs from Order drawer; unsafe to drop DB columns without migrating Map to another data source.

---

## Removal Plan (Phased)

### Phase 1: Remove from Order Drawer UI Only

**Scope:** CreateOrderDrawer, EditOrderDrawer

**Actions:**
1. Remove "Coordinates (Optional)" section (latitude/longitude FormFields) from **CreateOrderDrawer**
2. Remove any latent lat/lng form handling from **EditOrderDrawer** (it has no manual inputs; only validation for geocode status)
3. Stop writing `latitude`, `longitude` from form payload in CreateOrderDrawer — send `null` or omit (geocoding will populate)
4. Update **order.schema.ts** — make `latitude`, `longitude` optional and exclude from form (or keep for type compat but not rendered)
5. Keep geocoding flow unchanged — it will continue to populate lat/lng after save

**Result:** Manual coordinate entry removed; geocoding remains source of truth. Map continues to work.

---

### Phase 2: Clean Up Types, Views, Invoicing (Optional)

**Scope:** Types, OrderFormInline, CreateInvoiceDrawer, numberParsing

**Actions:**
1. Keep `latitude`, `longitude` in Order type (Map and geocoding need them)
2. Remove lat/lng form fields from **OrderFormInline** (Invoicing) if present
3. Ensure CreateInvoiceDrawer does not require lat/lng when creating orders
4. No changes to views (they inherit from `o.*`)

**Result:** No manual lat/lng entry anywhere in Orders flows.

---

### Phase 3: DB Migration (Only When Safe)

**Do NOT execute until:**
- Map has been migrated to use another source (e.g. Jobs, dedicated addresses table), OR
- Decision is made to keep `orders.latitude/longitude` permanently for Map

**If dropping is ever approved:**
```sql
-- Example (DO NOT RUN without migration plan)
-- alter table public.orders drop column latitude;
-- alter table public.orders drop column longitude;
```

**Note:** Jobs table has its own `latitude`/`longitude`; no change needed for Jobs.

---

## Non-Goals

- No actual schema changes in this task
- No refactors outside what's needed to identify usage
- No migration of Map to Jobs/Addresses (future work)

---

## Acceptance Criteria

- [x] Which table/columns store coordinates: **orders.latitude, orders.longitude; jobs.latitude, jobs.longitude**
- [x] All code paths that read/write them: **See tables above**
- [x] Whether Map/Jobs depend on them: **Map depends on orders; Jobs have own columns, optionally copy from orders**
- [x] Safe phased plan: **Phase 1 UI only; Phase 2 optional cleanup; Phase 3 DB only when Map migrated**

---

## Files Reference (Quick Index)

| Path | Relevance |
|------|-----------|
| `supabase/migrations/20251223022543_add_latitude_longitude_to_orders.sql` | Adds orders lat/lng |
| `supabase/migrations/20260110150000_add_geocode_metadata_to_orders.sql` | Geocode metadata |
| `supabase/functions/geocode-order-address/index.ts` | Writes lat/lng |
| `src/modules/orders/components/CreateOrderDrawer.tsx` | Manual lat/lng inputs |
| `src/modules/orders/components/EditOrderDrawer.tsx` | Geocode UI, validation |
| `src/modules/orders/schemas/order.schema.ts` | Zod lat/lng |
| `src/modules/orders/types/orders.types.ts` | Order interface |
| `src/modules/orders/utils/numberParsing.ts` | normalizeOrder |
| `src/modules/orders/hooks/useGeocodeOrderAddress.ts` | Geocode mutation |
| `src/modules/map/hooks/useOrders.ts` | Filters by lat/lng |
| `src/modules/map/utils/orderMapTransform.ts` | Order → marker |
| `src/modules/map/components/OrderInfoPanel.tsx` | Displays coords |
| `src/modules/invoicing/components/OrderFormInline.tsx` | Lat/lng form |
| `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | Order creation |
| `src/modules/jobs/components/CreateJobDrawer.tsx` | Copies from order |
| `src/modules/jobs/components/EditJobDrawer.tsx` | Jobs lat/lng |
