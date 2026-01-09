# Task 3 — Derive Order Map Pins from Address (Geocode on save → persist lat/lng)

## Overview

This feature implements automatic geocoding of order addresses to populate latitude and longitude coordinates. The map pins will continue to use `orders.latitude` and `orders.longitude`, but these coordinates will now be automatically derived and updated from the order's address field.

**Context:**
- Address is the source of truth for order locations
- `latitude` and `longitude` are persisted derived fields used by the Map module for performance
- Geocoding is performed server-side via Supabase Edge Function to keep API keys secure
- Existing `orders.location` (text) field serves as the address input for geocoding
- Existing `orders.latitude` and `orders.longitude` (numeric(10,8)) fields already exist in the schema

**Goal:**
- Automatically geocode order addresses when orders are created or updated
- Persist geocoded coordinates to enable accurate map pin placement
- Provide visibility into geocoding status and errors
- Allow manual retry/recalculation if geocoding fails
- Ensure no API keys are exposed to the client

---

## Current State Analysis

### Orders Schema

**Table:** `public.orders`

**Current Structure:**
- `location text` - Free-text address field (used as input for geocoding)
- `latitude numeric(10, 8) null` - Already exists, stores latitude coordinate
- `longitude numeric(10, 8) null` - Already exists, stores longitude coordinate
- Other order fields: customer info, order type, dates, statuses, values, etc.

**Observations:**
- `latitude` and `longitude` fields already exist (added in migration `20251223022543_add_latitude_longitude_to_orders.sql`)
- `location` field exists but coordinates are not automatically derived
- No geocoding metadata fields exist (status, error tracking, timestamp)
- No server-side geocoding infrastructure exists

### Map Module

**Current State:**
- Map module uses `orders.latitude` and `orders.longitude` for rendering pins
- Filtering logic handles orders with missing coordinates
- No geocoding automation currently in place

**Gaps/Issues:**
- Coordinates must be manually entered or remain null
- Address changes do not trigger coordinate updates
- No visibility into geocoding failures or retry mechanisms

### Data Access Patterns

**How Orders are Currently Accessed:**
- Orders are fetched via `fetchOrders()`, `fetchOrder()`, `fetchOrdersByInvoice()`
- These queries include `latitude` and `longitude` fields
- Map queries use `useOrdersForMap()` hook
- No geocoding service or edge function exists

**How Geocoding Will Be Integrated:**
- Geocoding will be triggered after successful order create/update operations
- Async edge function call will not block the UI
- Status updates will be persisted to order record for debugging/retry

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**

Add geocode metadata fields to `public.orders` (all nullable, additive-only):
```sql
ALTER TABLE public.orders
  ADD COLUMN geocode_status text null,
  ADD COLUMN geocode_error text null,
  ADD COLUMN geocoded_at timestamptz null,
  ADD COLUMN geocode_place_id text null;
```

**Column Definitions:**
- `geocode_status`: Status of last geocoding attempt
  - Values: `'idle'` (never attempted), `'ok'` (success), `'failed'` (error occurred)
  - Nullable to allow backward compatibility
- `geocode_error`: Error message if geocoding failed (for debugging)
- `geocoded_at`: Timestamp of last successful geocoding
- `geocode_place_id`: Optional place ID from geocoding provider (Google Places API, etc.)

**Non-Destructive Constraints:**
- All new columns are nullable
- No existing data is affected
- No indexes required (not filtered/searched in hot paths)
- Backward compatibility maintained

### Backend Architecture

**Supabase Edge Function: `geocode-order-address`**

**Location:** `supabase/functions/geocode-order-address/index.ts`

**Input:**
```typescript
{
  orderId: string;
  address: string;
}
```

**Validation:**
- Validate `orderId` is a valid UUID
- Validate `address` is non-empty and reasonable length (e.g., 3-500 characters)

**Geocoding Provider:**
- Use Google Geocoding API or Places API
- API key stored as Supabase Edge Function secret (not exposed to client)
- Handle rate limiting and errors gracefully

**Success Response:**
```typescript
{
  ok: true;
  lat: number;
  lng: number;
  placeId?: string; // Optional, if provider returns it
}
```

**Error Response:**
```typescript
{
  ok: false;
  error: string; // Human-readable error message
}
```

**Edge Function Behavior:**
- On success: Update order record with `latitude`, `longitude`, `geocode_status='ok'`, `geocoded_at=now()`, and optionally `geocode_place_id`
- On failure: Update order record with `geocode_status='failed'`, `geocode_error=<error_message>`
- Use Supabase service role key for database updates (bypasses RLS)

---

## Implementation Approach

### Phase 1: Database Migration

**Steps:**
1. Create additive migration file: `supabase/migrations/YYYYMMDDHHmmss_add_geocode_metadata_to_orders.sql`
2. Add four nullable columns: `geocode_status`, `geocode_error`, `geocoded_at`, `geocode_place_id`
3. Add column comments for documentation
4. Apply migration and verify backward compatibility

**Deliverables:**
- Migration file path
- SQL content summary
- Confirmation that existing orders remain unaffected

### Phase 2: Type Updates

**Steps:**
1. Update `Order` TypeScript interface in `src/modules/orders/types/orders.types.ts`:
   - Add `geocode_status: 'idle' | 'ok' | 'failed' | null`
   - Add `geocode_error: string | null`
   - Add `geocoded_at: string | null`
   - Add `geocode_place_id: string | null`
2. Update Zod schema if needed (likely no validation required for these read-only fields)
3. Update transform utilities to preserve geocode fields
4. Ensure TypeScript compilation passes

**Deliverables:**
- List of files changed
- Confirmation that types compile correctly

### Phase 3: Supabase Edge Function

**Steps:**
1. Create `supabase/functions/geocode-order-address/index.ts`
2. Implement input validation (orderId, address)
3. Implement Google Geocoding API integration:
   - Read API key from Supabase secrets (`GOOGLE_MAPS_API_KEY`)
   - Call Google Geocoding API or Places API
   - Parse response and extract lat/lng (and optional place_id)
4. Implement database update logic:
   - On success: Update order with coordinates and success metadata
   - On failure: Update order with error metadata
5. Return JSON response with status and data/error
6. Add error handling for network failures, invalid API key, rate limits, etc.

**Configuration:**
- Add `GOOGLE_MAPS_API_KEY` to Supabase Edge Function secrets
- Ensure CORS headers are configured for client calls (if needed)

**Deliverables:**
- Edge function file path
- API integration details (which Google API endpoint used)
- Error handling approach documented

### Phase 4: Orders UI Integration (Create/Edit + Inline Invoice Order)

**Components to Update:**
- `CreateOrderDrawer.tsx`
- `EditOrderDrawer.tsx`
- `OrderFormInline.tsx` (for inline invoice orders)

**Steps:**
1. Create React Query mutation hook: `useGeocodeOrderAddress(orderId, address)`
   - Calls Supabase Edge Function
   - Handles loading/error states
   - Returns `{ ok, lat, lng, placeId?, error? }`
2. Detect address changes:
   - Compare current `location` value to initial/previous value
   - Trigger geocode only if address actually changed
3. On successful order save:
   - If address exists and changed: Trigger geocode mutation (debounced/queued)
   - Show subtle status indicator: "Locating..." → "Pinned" or "Couldn't locate address"
4. Add manual "Recalculate location" button/action:
   - Visible when `geocode_status === 'failed'` or when user explicitly requests
   - Triggers geocode mutation with current address
5. Handle errors gracefully:
   - Display error message but don't block order save
   - Allow user to retry manually
   - Don't crash on geocoding failures

**UX Requirements:**
- Geocoding is non-blocking (async after save)
- Status feedback is subtle (badge or icon, not intrusive)
- Manual retry option is easily accessible
- Failures are visible but don't prevent order operations

**Deliverables:**
- List of files changed
- UX mockup/description of status indicators
- Manual test steps for address change detection and geocoding

### Phase 5: Map Module Verification

**Steps:**
1. Verify Map module still uses `orders.latitude` and `orders.longitude` correctly
2. Ensure filtering handles orders with missing coordinates gracefully
3. Optional: Add visual indicator for orders with "failed" geocode status
4. Ensure no N+1 queries introduced by geocoding metadata

**Deliverables:**
- Confirmation that map rendering works correctly
- Any improvements made to missing-coordinate handling

### Phase 6: QA & Validation

**Functional Tests:**
1. Create order with address → verify geocoding triggers and coordinates are saved
2. Edit order address → verify geocoding retriggers and coordinates update
3. Create order with invalid address → verify error status is saved and visible
4. Manual "Recalculate location" → verify it works after failure
5. Inline invoice order creation → verify geocoding works for inline orders
6. Edge cases:
   - Empty/null address → no geocoding attempt
   - Address unchanged on edit → no geocoding retrigger
   - Network failure during geocoding → error status saved

**Performance Checks:**
- Geocoding doesn't block order save (async)
- No UI lag when geocoding in background
- Edge function responds within reasonable time (< 5 seconds)

**Build Checks:**
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

**Deliverables:**
- Checklist with PASS/FAIL for each test
- Any fixes made (files changed + reason)
- Note any pre-existing unrelated issues

---

## Safety Considerations

**Data Integrity:**
- All migrations are additive-only (no data loss)
- Existing orders with manual coordinates are preserved
- Geocoding failures do not overwrite existing valid coordinates (unless explicitly recalculating)

**Error Handling:**
- Network failures are caught and logged
- Invalid API key is handled gracefully
- Rate limiting from Google API is handled (return error, allow retry)
- Invalid addresses don't crash the application

**Rollback Strategy:**
- Geocode metadata columns can be dropped if needed (no dependencies)
- Edge function can be disabled without breaking orders
- Client code gracefully handles missing geocode fields

**Testing:**
- Test with valid addresses
- Test with invalid addresses
- Test with missing API key (development scenario)
- Test with network failures
- Test with rate-limited API responses

---

## What NOT to Do

**Non-goals:**
- No real-time geocoding while typing address (only on save + manual recalc)
- No bulk backfill UI for existing orders (can be a separate task/script)
- No automatic retry logic on failures (user must manually retry)
- No geocoding for Renovation orders if they don't have addresses (out of scope)
- No changes to invoice totals, additional options, or reporting logic
- No changes to Map module rendering logic (only data source updates)
- No client-side geocoding (must be server-side for API key security)
- No third-party geocoding providers beyond Google (keep it simple for v1)

**Constraints:**
- Do not expose Google Maps API key to client
- Do not block order save/update operations waiting for geocoding
- Do not modify existing `orders.location`, `orders.latitude`, or `orders.longitude` column definitions (only add metadata)

---

## Open Questions / Considerations

**To Resolve:**
1. Which Google API endpoint to use:
   - Geocoding API (simpler, forward geocoding only)
   - Places API (more features, place_id support, but more complex)
   - Recommendation: Start with Geocoding API for simplicity

2. Rate limiting strategy:
   - Google Geocoding API allows 50 requests/second per user
   - Consider debouncing/throttling if multiple orders are saved rapidly
   - Recommendation: Queue geocoding requests if multiple orders are saved simultaneously

3. Geocode retry policy:
   - Should failed geocodes automatically retry on next edit?
   - Recommendation: Only retry on manual "Recalculate" action (user control)

4. Address normalization:
   - Should the edge function normalize/standardize addresses before geocoding?
   - Recommendation: Pass address as-is for v1; normalization can be added later if needed

5. Place ID usage:
   - Should we store `geocode_place_id` for future reverse geocoding or place details?
   - Recommendation: Store if available but don't build features around it yet

**Dependencies:**
- Google Maps API key must be obtained and added to Supabase Edge Function secrets
- Supabase Edge Functions must be deployed and accessible
- Network connectivity required for geocoding API calls

**Follow-up Enhancements (Future):**
- Bulk backfill tool for existing orders
- Automatic retry with exponential backoff
- Address validation/normalization before geocoding
- Reverse geocoding (coordinates → address) for verification
- Multiple geocoding provider support (fallback options)
- Geocoding analytics/reporting dashboard

