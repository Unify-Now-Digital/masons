# Implementation Plan: Derive Order Map Pins from Address (Geocode on save → persist lat/lng)

## Feature Overview

Implement automatic geocoding of order addresses to populate latitude and longitude coordinates. The map pins will continue to use `orders.latitude` and `orders.longitude`, but these coordinates will now be automatically derived and updated from the order's address field via server-side geocoding.

**Branch:** `feature/geocode-order-address`  
**Spec File:** `specs/geocode-order-address.md`

---

## Technical Context

### Current State
- Orders table has `location text` field - Free-text address field (used as input for geocoding)
- Orders table has `latitude numeric(10, 8) null` and `longitude numeric(10, 8) null` - Already exist (added in migration `20251223022543_add_latitude_longitude_to_orders.sql`)
- Map module uses `orders.latitude` and `orders.longitude` for rendering pins
- No geocoding metadata fields exist (status, error tracking, timestamp)
- No server-side geocoding infrastructure exists
- Coordinates must be manually entered or remain null
- Address changes do not trigger coordinate updates

### Key Files
- `supabase/migrations/20251223022543_add_latitude_longitude_to_orders.sql` - Existing lat/lng columns
- `supabase/migrations/20250608000001_create_orders_table.sql` - Orders table schema
- `src/modules/orders/api/orders.api.ts` - Order API functions (fetchOrders, fetchOrder, etc.)
- `src/modules/orders/types/orders.types.ts` - Order TypeScript types
- `src/modules/orders/utils/orderTransform.ts` - Order UI transformation and normalization
- `src/modules/orders/components/CreateOrderDrawer.tsx` - Order creation UI
- `src/modules/orders/components/EditOrderDrawer.tsx` - Order editing UI
- `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` - Invoice creation with inline orders
- `src/modules/invoicing/components/OrderFormInline.tsx` - Inline order form for invoices
- `src/modules/orders/schemas/order.schema.ts` - Order form validation schema
- Map module components (if they exist) - Use orders.latitude/longitude for pins

### Constraints
- **Choice A: Geocode AFTER save, async** - Geocoding happens after order save, non-blocking
- **No API key exposure** - Google Maps API key must stay server-side (Supabase Edge Function secrets)
- **Defensive null handling** - Failures must not crash UI; all geocode fields nullable
- **No impact on totals/invoices** - No changes to invoice totals, additional options, or reporting logic
- **Additive-only migrations** - All new columns nullable, no data loss
- **Map rendering unchanged** - Map still uses orders.latitude/longitude; no structural changes
- **Backward compatible** - Existing orders with manual coordinates preserved

### Architecture Decision: Server-Side Geocoding

**Rationale:**
- Address is the source of truth
- `latitude` and `longitude` are persisted derived fields used by Map for performance
- Geocoding is performed server-side via Supabase Edge Function to keep API keys secure
- Async geocoding after save prevents blocking the UI

**Geocoding Flow:**
1. User creates/updates order with `location` (address)
2. Order save succeeds
3. If `location` changed and is non-empty: Trigger async geocode call
4. Edge Function validates and calls Google Geocoding API
5. On success: Update order with `latitude`, `longitude`, `geocode_status='ok'`, `geocoded_at`, `geocode_place_id`
6. On failure: Update order with `geocode_status='failed'`, `geocode_error`
7. UI shows subtle status indicator (Locating / Pinned / Failed)
8. User can manually retry via "Recalculate location" button

---

## Implementation Phases

### Phase 1: Database Migration (Additive)

**Goal:** Add geocode metadata fields to `public.orders` for tracking geocoding status and errors.

#### Task 1.1: Create Migration for Geocode Metadata Fields
**File:** `supabase/migrations/YYYYMMDDHHmmss_add_geocode_metadata_to_orders.sql`

**Implementation:**
```sql
-- Add geocode metadata fields to orders table (all nullable for backward compatibility)
alter table public.orders
  add column if not exists geocode_status text null,
  add column if not exists geocode_error text null,
  add column if not exists geocoded_at timestamptz null,
  add column if not exists geocode_place_id text null;

-- Add column comments for documentation
comment on column public.orders.geocode_status is 'Status of last geocoding attempt: idle (never attempted), ok (success), failed (error occurred)';
comment on column public.orders.geocode_error is 'Error message if geocoding failed, for debugging';
comment on column public.orders.geocoded_at is 'Timestamp of last successful geocoding';
comment on column public.orders.geocode_place_id is 'Optional place ID from geocoding provider (Google Places API, etc.)';
```

**Validation:**
- Ensure existing rows remain valid (all columns nullable)
- Verify no constraints violated
- Confirm backward compatibility (existing orders have null geocode fields)

**Success Criteria:**
- Migration runs successfully
- All new columns are nullable
- Column comments added for documentation
- Existing orders unaffected (null values)
- No indexes needed (not filtered/searched in hot paths)

**Optional Enhancement (if useful for change detection):**
- Consider adding `geocoded_location text null` to store the address that was geocoded (for comparison)
- This allows detecting if address changed since last geocode without hashing
- However, may not be necessary if we compare location field directly on save

---

### Phase 2: Types & Normalization

**Goal:** Update TypeScript types, Zod schemas, and transform utilities to handle geocode metadata fields.

#### Task 2.1: Update Order TypeScript Interface
**File:** `src/modules/orders/types/orders.types.ts`

**Changes:**
- Add geocode fields to `Order` interface:
  ```typescript
  export interface Order {
    // ... existing fields ...
    geocode_status: 'idle' | 'ok' | 'failed' | null;
    geocode_error: string | null;
    geocoded_at: string | null;
    geocode_place_id: string | null;
  }
  ```

**Success Criteria:**
- TypeScript compilation passes
- All geocode fields are nullable (backward compatible)
- Type union for `geocode_status` matches database values

#### Task 2.2: Update Order Transform Utilities
**File:** `src/modules/orders/utils/orderTransform.ts`

**Changes:**
- Ensure `normalizeOrder` function includes geocode fields:
  ```typescript
  export function normalizeOrder(order: Order): Order {
    return {
      ...order,
      // ... existing normalizations (latitude, longitude, etc.) ...
      geocode_status: order.geocode_status || null,
      geocode_error: order.geocode_error || null,
      geocoded_at: order.geocoded_at || null,
      geocode_place_id: order.geocode_place_id || null,
      // Ensure latitude/longitude are numeric (existing logic should handle this)
      latitude: order.latitude ? Number(order.latitude) : null,
      longitude: order.longitude ? Number(order.longitude) : null,
    };
  }
  ```

**Success Criteria:**
- Geocode fields preserved in transforms
- Latitude/longitude remain numeric (existing normalization maintained)
- Null handling is defensive (null/undefined → null)

#### Task 2.3: Update Order Form Schema (Optional)
**File:** `src/modules/orders/schemas/order.schema.ts`

**Changes:**
- Geocode fields are read-only (set by backend), so no validation needed in form schema
- `location` field already exists in schema (no changes needed)

**Success Criteria:**
- Form schema unchanged (geocode fields not user-editable)
- `location` field validation remains (if any)

---

### Phase 3: Supabase Edge Function: geocode-order-address

**Goal:** Create server-side edge function that geocodes addresses using Google Geocoding API and updates order coordinates.

#### Task 3.1: Create Edge Function Structure
**File:** `supabase/functions/geocode-order-address/index.ts`

**Implementation:**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  orderId: string;
  location: string;
}

interface GeocodeResponse {
  ok: boolean;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { orderId, location }: GeocodeRequest = await req.json();

    // Validate input
    if (!orderId || typeof orderId !== 'string') {
      return new Response(
        JSON.stringify({ ok: false, error: 'orderId is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'orderId must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!location || typeof location !== 'string' || location.trim().length < 3 || location.trim().length > 500) {
      return new Response(
        JSON.stringify({ ok: false, error: 'location must be a non-empty string between 3 and 500 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Google Maps API key from secrets
    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleApiKey) {
      console.error('GOOGLE_MAPS_API_KEY not found in environment');
      // Update order with error status
      await supabase
        .from('orders')
        .update({
          geocode_status: 'failed',
          geocode_error: 'Geocoding service not configured (API key missing)',
        })
        .eq('id', orderId);
      
      return new Response(
        JSON.stringify({ ok: false, error: 'Geocoding service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Google Geocoding API
    const encodedAddress = encodeURIComponent(location.trim());
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${googleApiKey}`;

    let geocodeResponse: Response;
    try {
      geocodeResponse = await fetch(geocodeUrl);
    } catch (error) {
      console.error('Geocoding API request failed:', error);
      await supabase
        .from('orders')
        .update({
          geocode_status: 'failed',
          geocode_error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        .eq('id', orderId);
      
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to reach geocoding service' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geocodeData = await geocodeResponse.json();

    // Handle Google API errors
    if (geocodeData.status !== 'OK') {
      let errorMessage = `Geocoding failed: ${geocodeData.status}`;
      if (geocodeData.error_message) {
        errorMessage += ` - ${geocodeData.error_message}`;
      }

      await supabase
        .from('orders')
        .update({
          geocode_status: 'failed',
          geocode_error: errorMessage,
        })
        .eq('id', orderId);

      return new Response(
        JSON.stringify({ ok: false, error: errorMessage }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract coordinates from response
    if (!geocodeData.results || geocodeData.results.length === 0) {
      await supabase
        .from('orders')
        .update({
          geocode_status: 'failed',
          geocode_error: 'No results found for address',
        })
        .eq('id', orderId);

      return new Response(
        JSON.stringify({ ok: false, error: 'No results found for address' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firstResult = geocodeData.results[0];
    const locationData = firstResult.geometry?.location;
    
    if (!locationData || typeof locationData.lat !== 'number' || typeof locationData.lng !== 'number') {
      await supabase
        .from('orders')
        .update({
          geocode_status: 'failed',
          geocode_error: 'Invalid coordinates in geocoding response',
        })
        .eq('id', orderId);

      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid coordinates in geocoding response' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const latitude = locationData.lat;
    const longitude = locationData.lng;
    const placeId = firstResult.place_id || null;

    // Update order with coordinates and success metadata
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        latitude: latitude,
        longitude: longitude,
        geocode_status: 'ok',
        geocoded_at: new Date().toISOString(),
        geocode_place_id: placeId,
        geocode_error: null, // Clear any previous error
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Failed to update order:', updateError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to update order with coordinates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return success response
    const response: GeocodeResponse = {
      ok: true,
      latitude: latitude,
      longitude: longitude,
      placeId: placeId || undefined,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in geocode-order-address:', error);
    return new Response(
      JSON.stringify({ ok: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

**Edge Function Configuration:**
- Add `GOOGLE_MAPS_API_KEY` to Supabase Edge Function secrets:
  ```bash
  supabase secrets set GOOGLE_MAPS_API_KEY=your_api_key_here
  ```
- CORS headers configured for client calls
- Uses service role key for database updates (bypasses RLS)

**Rate Limiting / Debounce Protection (Optional but Recommended):**
- Add simple deduplication: Check if same order+location was geocoded recently (e.g., within last 30 seconds)
- If yes, skip geocoding and return cached result
- This prevents redundant API calls if user rapidly saves/edits same address

**Success Criteria:**
- Edge function validates input (orderId UUID, location length)
- Calls Google Geocoding API with proper error handling
- Updates order record with coordinates on success
- Updates order record with error metadata on failure
- Returns JSON response with status and data/error
- Handles network failures, invalid API key, rate limits gracefully
- No API key exposed to client

---

### Phase 4: Orders UI Integration (Async After Save)

**Goal:** Integrate geocoding into order create/edit workflows with address change detection and status indicators.

#### Task 4.1: Create React Query Hook for Geocoding
**File:** `src/modules/orders/hooks/useGeocodeOrderAddress.ts` (new file)

**Implementation:**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GeocodeRequest {
  orderId: string;
  location: string;
}

interface GeocodeResponse {
  ok: boolean;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  error?: string;
}

export function useGeocodeOrderAddress() {
  const queryClient = useQueryClient();

  return useMutation<GeocodeResponse, Error, GeocodeRequest>({
    mutationFn: async ({ orderId, location }: GeocodeRequest) => {
      const { data, error } = await supabase.functions.invoke('geocode-order-address', {
        body: { orderId, location },
      });

      if (error) {
        throw new Error(error.message || 'Failed to geocode address');
      }

      return data as GeocodeResponse;
    },
    onSuccess: (data, variables) => {
      // Invalidate order queries to refresh geocode status
      queryClient.invalidateQueries({ queryKey: ['orders', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['ordersByInvoice'] });
      queryClient.invalidateQueries({ queryKey: ['ordersForMap'] });
    },
  });
}
```

**Success Criteria:**
- Hook calls edge function correctly
- Handles loading/error states
- Invalidates relevant queries on success
- Returns typed response

#### Task 4.2: Update CreateOrderDrawer
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Changes:**
1. Track initial `location` value on mount:
   ```typescript
   const initialLocationRef = useRef<string | null>(null);
   useEffect(() => {
     initialLocationRef.current = form.watch('location');
   }, []);
   ```

2. After successful order creation:
   ```typescript
   const geocodeMutation = useGeocodeOrderAddress();
   
   const onSubmit = async (data: OrderFormData) => {
     // ... existing order creation logic ...
     const orderId = createdOrder.id;
     
     // Trigger geocoding if location exists and is non-empty
     if (data.location && data.location.trim().length > 0) {
       geocodeMutation.mutate({
         orderId,
         location: data.location.trim(),
       });
     }
   };
   ```

3. Add status indicator near location field:
   ```typescript
   {geocodeMutation.isPending && (
     <span className="text-sm text-muted-foreground">Locating...</span>
   )}
   {geocodeMutation.isSuccess && geocodeMutation.data?.ok && (
     <span className="text-sm text-green-600">✓ Pinned</span>
   )}
   {geocodeMutation.isError && (
     <span className="text-sm text-red-600">Couldn't locate address</span>
   )}
   ```

**Success Criteria:**
- Geocoding triggers after successful order save
- Only geocodes if location is non-empty
- Shows status indicator (Locating / Pinned / Failed)
- Errors don't block order creation
- No crashes on geocoding failures

#### Task 4.3: Update EditOrderDrawer
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Changes:**
1. Track initial `location` value when order loads:
   ```typescript
   const initialLocationRef = useRef<string | null>(null);
   useEffect(() => {
     if (order?.location) {
       initialLocationRef.current = order.location;
     }
   }, [order?.location]);
   ```

2. After successful order update:
   ```typescript
   const geocodeMutation = useGeocodeOrderAddress();
   
   const onSubmit = async (data: OrderFormData) => {
     // ... existing order update logic ...
     
     // Check if location changed
     const locationChanged = data.location?.trim() !== initialLocationRef.current?.trim();
     
     // Trigger geocoding if location exists, is non-empty, and changed
     if (data.location && data.location.trim().length > 0 && locationChanged) {
       geocodeMutation.mutate({
         orderId: order.id,
         location: data.location.trim(),
       });
     }
   };
   ```

3. Add status indicator showing current geocode status:
   ```typescript
   {order?.geocode_status === 'ok' && (
     <span className="text-sm text-green-600">✓ Pinned</span>
   )}
   {order?.geocode_status === 'failed' && (
     <div className="flex items-center gap-2">
       <span className="text-sm text-red-600">Couldn't locate address</span>
       <Button
         variant="outline"
         size="sm"
         onClick={() => {
           if (order?.location) {
             geocodeMutation.mutate({
               orderId: order.id,
               location: order.location.trim(),
             });
           }
         }}
       >
         Recalculate location
       </Button>
     </div>
   )}
   {geocodeMutation.isPending && (
     <span className="text-sm text-muted-foreground">Locating...</span>
   )}
   ```

4. Add manual "Recalculate location" button:
   - Visible when `geocode_status === 'failed'` or coordinates missing
   - Triggers geocode mutation with current address

**Success Criteria:**
- Geocoding triggers only if location changed
- Status indicator shows current geocode status
- Manual retry button works
- Errors don't block order update
- No crashes on geocoding failures

#### Task 4.4: Update OrderFormInline (Inline Invoice Orders)
**File:** `src/modules/invoicing/components/OrderFormInline.tsx`

**Changes:**
- Similar to CreateOrderDrawer:
  1. Track initial location value
  2. After order creation/update, trigger geocode if location exists and changed
  3. Show subtle status indicator
  4. Handle errors gracefully

**Success Criteria:**
- Geocoding works for inline orders
- Status indicators don't clutter inline form
- Errors don't block invoice creation

#### Task 4.5: Update OrderDetailsSidebar (Optional Enhancement)
**File:** `src/modules/orders/components/OrderDetailsSidebar.tsx`

**Changes:**
- Add geocode status display in order details:
  - Show "Location: [address]"
  - Show status badge: "Pinned" (green) / "Failed" (red) / "Not located" (gray)
  - Show "Recalculate location" button if failed or missing
  - Show geocoded_at timestamp if available

**Success Criteria:**
- Status visible in order details
- Manual retry accessible from sidebar
- Defensive null handling

---

### Phase 5: Map Module Verification

**Goal:** Ensure map rendering works correctly with geocoded coordinates and handles missing coordinates gracefully.

#### Task 5.1: Verify Map Module Uses Correct Fields
**Files:** Map module components (if they exist)

**Verification:**
- Confirm map uses `orders.latitude` and `orders.longitude` (no changes needed)
- Confirm filtering/querying includes geocode fields (if needed for UI)

**Success Criteria:**
- Map pins render correctly using latitude/longitude
- No structural changes to map rendering logic

#### Task 5.2: Ensure Missing Coordinates Handled Safely
**Files:** Map module components

**Verification:**
- Orders with `latitude === null` or `longitude === null` are filtered out or shown as "No location"
- No crashes when coordinates are missing
- Optional: Visual indicator for orders with "failed" geocode status

**Success Criteria:**
- Missing coordinates don't crash map
- Orders without coordinates are handled gracefully
- No N+1 queries introduced

#### Task 5.3: Verify Pins Update After Geocode
**Manual Test:**
1. Create order with address
2. Wait for geocoding to complete
3. Verify map pin appears at correct location
4. Edit order address
5. Wait for geocoding to complete
6. Verify map pin moves to new location

**Success Criteria:**
- Map pins update after geocoding completes
- React Query invalidation triggers map refresh

---

### Phase 6: QA & Validation

**Goal:** Comprehensive testing and validation of the geocoding feature.

#### Task 6.1: Functional Tests

**Test 6.1.1: Create Order with Valid Address**
- **Steps:**
  1. Open CreateOrderDrawer
  2. Fill in order details
  3. Enter valid address (e.g., "123 Main St, London, UK")
  4. Save order
- **Expected:**
  - Order saves successfully
  - "Locating..." indicator appears
  - Geocoding completes
  - Status changes to "✓ Pinned"
  - `latitude` and `longitude` populated in database
  - `geocode_status = 'ok'` and `geocoded_at` timestamp set
  - Map pin appears at correct location
- **Acceptance:** PASS / FAIL

**Test 6.1.2: Edit Order Address**
- **Steps:**
  1. Open EditOrderDrawer for existing order
  2. Change location field to different valid address
  3. Save order
- **Expected:**
  - Order updates successfully
  - Geocoding triggers (only if location changed)
  - Coordinates update in database
  - Map pin moves to new location
- **Acceptance:** PASS / FAIL

**Test 6.1.3: Create Order with Invalid Address**
- **Steps:**
  1. Open CreateOrderDrawer
  2. Enter invalid address (e.g., "asdfghjkl")
  3. Save order
- **Expected:**
  - Order saves successfully
  - Geocoding attempts and fails
  - Status shows "Couldn't locate address"
  - `geocode_status = 'failed'` and `geocode_error` populated
  - No coordinates saved (or coordinates remain null)
  - No crash
- **Acceptance:** PASS / FAIL

**Test 6.1.4: Manual Recalculate Location**
- **Steps:**
  1. Open EditOrderDrawer for order with `geocode_status = 'failed'`
  2. Click "Recalculate location" button
- **Expected:**
  - Geocoding retriggers with current address
  - Status updates appropriately
  - Coordinates update if geocoding succeeds
- **Acceptance:** PASS / FAIL

**Test 6.1.5: Inline Invoice Order Creation with Address**
- **Steps:**
  1. Open CreateInvoiceDrawer
  2. Add inline order with valid address
  3. Create invoice
- **Expected:**
  - Invoice and order created successfully
  - Geocoding triggers for inline order
  - Coordinates populated correctly
- **Acceptance:** PASS / FAIL

**Test 6.1.6: Edge Cases**
- **Empty/null address:**
  - Create order without location field
  - Expected: No geocoding attempt, no error
- **Address unchanged on edit:**
  - Edit order without changing location
  - Expected: No geocoding retrigger
- **Network failure during geocoding:**
  - Simulate network error (disable internet, invalid API key)
  - Expected: Error status saved, no crash
- **Acceptance:** PASS / FAIL for each case

**Test 6.1.7: Renovation vs New Memorial Orders**
- **Steps:**
  1. Create Renovation order with address
  2. Create New Memorial order with address
- **Expected:**
  - Both order types support geocoding (location field is on order, not product-dependent)
  - Geocoding works for both types
- **Acceptance:** PASS / FAIL

#### Task 6.2: Performance Checks

**Test 6.2.1: Geocoding Doesn't Block Order Save**
- **Steps:**
  1. Create order with address
  2. Observe UI during save and geocoding
- **Expected:**
  - Order save completes immediately
  - Geocoding happens in background (async)
  - No UI lag or blocking
- **Acceptance:** PASS / FAIL

**Test 6.2.2: Edge Function Response Time**
- **Steps:**
  1. Monitor edge function logs during geocoding
  2. Measure response time
- **Expected:**
  - Response time < 5 seconds for valid addresses
  - Timeout handling for slow responses
- **Acceptance:** PASS / FAIL

**Test 6.2.3: No N+1 Queries**
- **Steps:**
  1. Monitor network requests when loading orders list
  2. Verify no per-order geocoding requests on list load
- **Expected:**
  - Geocoding only happens on create/update, not on fetch
  - Orders list query remains performant
- **Acceptance:** PASS / FAIL

#### Task 6.3: Build Checks

**Test 6.3.1: TypeScript Compilation**
- **Command:** `npx tsc --noEmit`
- **Expected:** No type errors
- **Acceptance:** PASS / FAIL

**Test 6.3.2: Lint Check**
- **Command:** `npm run lint`
- **Expected:** No lint errors (ignore pre-existing)
- **Acceptance:** PASS / FAIL

**Test 6.3.3: Production Build**
- **Command:** `npm run build`
- **Expected:** Build succeeds
- **Acceptance:** PASS / FAIL

#### Task 6.4: Security Verification

**Test 6.4.1: API Key Not Exposed**
- **Steps:**
  1. Inspect client-side code (bundle)
  2. Check network requests from browser DevTools
- **Expected:**
  - Google Maps API key not visible in client code
  - Edge function called with only orderId and location
  - API key only in Supabase Edge Function secrets
- **Acceptance:** PASS / FAIL

#### Deliverables

**QA Checklist:**
- [ ] Test 6.1.1: Create Order with Valid Address - PASS / FAIL
- [ ] Test 6.1.2: Edit Order Address - PASS / FAIL
- [ ] Test 6.1.3: Create Order with Invalid Address - PASS / FAIL
- [ ] Test 6.1.4: Manual Recalculate Location - PASS / FAIL
- [ ] Test 6.1.5: Inline Invoice Order Creation - PASS / FAIL
- [ ] Test 6.1.6: Edge Cases (empty/null, unchanged, network failure) - PASS / FAIL
- [ ] Test 6.1.7: Renovation vs New Memorial Orders - PASS / FAIL
- [ ] Test 6.2.1: Geocoding Doesn't Block Order Save - PASS / FAIL
- [ ] Test 6.2.2: Edge Function Response Time - PASS / FAIL
- [ ] Test 6.2.3: No N+1 Queries - PASS / FAIL
- [ ] Test 6.3.1: TypeScript Compilation - PASS / FAIL
- [ ] Test 6.3.2: Lint Check - PASS / FAIL
- [ ] Test 6.3.3: Production Build - PASS / FAIL
- [ ] Test 6.4.1: API Key Not Exposed - PASS / FAIL

**Fixes Made (if any):**
- List any issues found and files changed + reason

**Pre-existing Issues (if any):**
- Note any unrelated lint/type errors that existed before this feature

---

## Safety Considerations

### Data Integrity
- All migrations are additive-only (no data loss)
- Existing orders with manual coordinates are preserved
- Geocoding failures do not overwrite existing valid coordinates (unless explicitly recalculating)
- All new columns are nullable for backward compatibility

### Error Handling
- Network failures are caught and logged
- Invalid API key is handled gracefully (error status saved)
- Rate limiting from Google API is handled (error status saved, user can retry)
- Invalid addresses don't crash the application (error status saved)
- Defensive null handling everywhere (null/undefined → null)

### Rollback Strategy
- Geocode metadata columns can be dropped if needed (no dependencies on other tables)
- Edge function can be disabled without breaking orders (geocoding just won't run)
- Client code gracefully handles missing geocode fields (all nullable)
- Existing coordinates remain unchanged if geocoding is disabled

### Testing Strategy
- Test with valid addresses (various formats)
- Test with invalid addresses (gibberish, non-existent)
- Test with missing API key (development scenario)
- Test with network failures (simulate offline)
- Test with rate-limited API responses (if possible)
- Test with empty/null addresses (no geocoding attempt)
- Test address change detection (only geocode if changed)

---

## What NOT to Do

### Non-goals
- ❌ No real-time geocoding while typing address (only on save + manual recalc)
- ❌ No bulk backfill UI for existing orders (can be a separate task/script)
- ❌ No automatic retry logic on failures (user must manually retry)
- ❌ No geocoding for orders without addresses (out of scope)
- ❌ No changes to invoice totals, additional options, or reporting logic
- ❌ No changes to Map module rendering logic (only data source updates)
- ❌ No client-side geocoding (must be server-side for API key security)
- ❌ No third-party geocoding providers beyond Google (keep it simple for v1)
- ❌ No address normalization/validation before geocoding (pass as-is for v1)
- ❌ No reverse geocoding (coordinates → address) for verification
- ❌ No geocoding analytics/reporting dashboard

### Constraints
- ❌ Do not expose Google Maps API key to client
- ❌ Do not block order save/update operations waiting for geocoding
- ❌ Do not modify existing `orders.location`, `orders.latitude`, or `orders.longitude` column definitions (only add metadata)
- ❌ Do not introduce N+1 queries (geocoding only on create/update, not on fetch)
- ❌ Do not crash UI on geocoding failures (always handle errors gracefully)

---

## Dependencies

### External Services
- **Google Geocoding API** (or Places API)
  - Requires API key
  - Rate limits: 50 requests/second per user (should be sufficient)
  - Billing: Pay-per-use (may have free tier)

### Supabase Configuration
- **Edge Functions** must be deployed and accessible
- **GOOGLE_MAPS_API_KEY** secret must be set in Supabase
- **Service role key** must be available for edge function (for bypassing RLS)

### Network Requirements
- Network connectivity required for geocoding API calls
- Edge function must be able to reach Google API

---

## Open Questions / Considerations

### Resolved Decisions
1. **Google API Endpoint:** Use Geocoding API (simpler, forward geocoding only)
2. **Geocode Timing:** After save, async (Choice A)
3. **Retry Policy:** Manual retry only (user control)
4. **Address Normalization:** Pass address as-is for v1
5. **Place ID Usage:** Store if available but don't build features around it yet

### Future Enhancements (Post-v1)
- Bulk backfill tool for existing orders
- Automatic retry with exponential backoff
- Address validation/normalization before geocoding
- Reverse geocoding (coordinates → address) for verification
- Multiple geocoding provider support (fallback options)
- Geocoding analytics/reporting dashboard
- Real-time geocoding while typing (debounced)
- Address autocomplete/suggestions

---

## Progress Tracking

- [ ] Phase 1: Database Migration - Not Started
- [ ] Phase 2: Types & Normalization - Not Started
- [ ] Phase 3: Supabase Edge Function - Not Started
- [ ] Phase 4: Orders UI Integration - Not Started
- [ ] Phase 5: Map Module Verification - Not Started
- [ ] Phase 6: QA & Validation - Not Started

