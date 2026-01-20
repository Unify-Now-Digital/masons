# Add Address Autocomplete Dropdown Suggestions to Order Location Field

## Overview

Add Google Places Autocomplete dropdown suggestions to the Order "Location" field to improve address entry UX. When users type in the Location field, they will see address suggestions from Google Places. Selecting a suggestion fills the input with the formatted address. The existing async geocoding-after-save behavior (Edge Function) remains the source of truth for latitude/longitude persistence.

**Context:**
- Current Location field is a plain text `Input` component in CreateOrderDrawer, EditOrderDrawer, and OrderFormInline (inline invoice orders)
- Existing geocoding pipeline: `useGeocodeOrderAddress` hook calls `geocode-order-address` Edge Function after save
- Edge Function persists `latitude`, `longitude`, `geocode_status`, `geocode_place_id` to `orders` table
- Map module reads persisted `latitude`/`longitude` from database (no change needed)
- Location field works for both Renovation and New Memorial order types

**Goal:**
- Provide autocomplete suggestions while typing in Location field
- Improve address entry accuracy and speed
- Maintain existing geocoding pipeline (no immediate lat/lng from autocomplete)
- Graceful fallback to plain text input if Google script fails to load
- Support all order entry points: Create, Edit, and Inline invoice orders

---

## Current State Analysis

### Location Field Implementation

**Current Structure:**
- `src/modules/orders/components/CreateOrderDrawer.tsx`: Uses `FormField` with `Input` component for `location`
- `src/modules/orders/components/EditOrderDrawer.tsx`: Uses `FormField` with `Input` component for `location`
- `src/modules/invoicing/components/OrderFormInline.tsx`: Uses `FormField` with `Input` component for `location`
- Form schema: `src/modules/orders/schemas/order.schema.ts` - `location` is required string
- Database: `orders.location` is a text field (no validation)

**Observations:**
- Location is a required field in the form schema
- Current implementation is a plain text input with no validation or suggestions
- Geocoding happens asynchronously after save via `useGeocodeOrderAddress` hook
- No client-side Google Maps integration currently (only server-side geocoding)

### Geocoding Pipeline

**Current Flow:**
1. User enters location text → form saves
2. `useGeocodeOrderAddress` mutation triggers after successful save (if location changed)
3. Edge Function `geocode-order-address` calls Google Geocoding API server-side
4. Updates `orders.latitude`, `orders.longitude`, `geocode_status`, `geocoded_at`, `geocode_place_id`
5. Map reads persisted coordinates for pins

**Key Components:**
- `src/modules/orders/hooks/useGeocodeOrderAddress.ts`: React Query mutation hook
- `supabase/functions/geocode-order-address/index.ts`: Edge Function with Google Geocoding API
- Uses `SUPABASE_SERVICE_ROLE_KEY` (no auth required)
- Uses `GOOGLE_MAPS_API_KEY` from Supabase secrets (server-side only)

**Gaps/Issues:**
- No real-time suggestions during typing (user must type full address manually)
- No address format validation before submission
- Typo-prone address entry may lead to geocoding failures

### Environment Variables

**Current:**
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key
- Server-side: `GOOGLE_MAPS_API_KEY` (Supabase secrets) - used by Edge Function

**Missing:**
- `VITE_GOOGLE_MAPS_BROWSER_KEY`: Browser-restricted key for Places Autocomplete (client-side)

---

## Recommended Schema Adjustments

### Database Changes

**No migrations required** - existing `orders` table already supports:
- `location` (text): Location address string
- `latitude`, `longitude` (numeric): Coordinates from geocoding
- `geocode_place_id` (text): Optional place ID from geocoding provider
- `geocode_status`, `geocode_error`, `geocoded_at`: Geocoding metadata

The autocomplete feature will populate `location` with formatted address, and existing geocoding pipeline will handle `latitude`/`longitude` persistence.

### Query/Data-Access Alignment

**No query changes needed** - autocomplete is UI-only enhancement:
- Form still saves `location` as text string
- Existing geocoding hook continues to run after save
- Map continues to read `latitude`/`longitude` from database

---

## Implementation Approach

### Phase 1: Environment Setup & Script Loader

**Tasks:**
1. Add `VITE_GOOGLE_MAPS_BROWSER_KEY` to `.env.example` with placeholder value
2. Create Google Maps script loader utility:
   - `src/shared/lib/google-maps-loader.ts`
   - Singleton pattern: load script once, cache loaded state
   - Load Maps JavaScript API with `libraries=places` parameter
   - Return Promise that resolves when `google.maps.places` is available
   - Handle loading errors gracefully (return rejected promise)

**Script Loader Interface:**
```typescript
export function loadGoogleMapsScript(): Promise<typeof google.maps.places>
export function isGoogleMapsLoaded(): boolean
```

**Safety:**
- Check for existing script tag before adding new one
- Handle timeout/network errors
- Allow retries on failure

### Phase 2: Autocomplete Input Component

**Create reusable component:**
- `src/shared/components/GooglePlacesAutocompleteInput.tsx`

**Props:**
```typescript
interface GooglePlacesAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (result: { address: string; placeId?: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}
```

**Functionality:**
1. **Script Loading:**
   - Use `loadGoogleMapsScript()` on mount
   - Show loading state while script loads (optional spinner/placeholder)
   - If script fails or `VITE_GOOGLE_MAPS_BROWSER_KEY` missing: render plain `Input` and log dev warning

2. **Autocomplete Service:**
   - Initialize `google.maps.places.AutocompleteService` once script loads
   - Call `getPlacePredictions()` on user input (debounced ~250ms)
   - Store predictions in local state

3. **Dropdown UI:**
   - Render dropdown list below input (position: absolute, z-index above form)
   - Use shadcn styling (match existing `Input` and `Select` components)
   - Display prediction `description` (formatted address)
   - Show loading state while fetching predictions
   - Close dropdown on blur/outside click (use `onClickOutside` hook or similar)

4. **Selection Handling:**
   - On click: call `onChange(prediction.description)` and `onSelect({ address, placeId })`
   - Close dropdown after selection
   - **Keyboard UX (nice-to-have):**
     - Up/Down arrows to navigate suggestions
     - Enter to select highlighted suggestion
     - Escape to close dropdown

5. **Fallback Behavior:**
   - If Google script not loaded: render standard `Input` component
   - Log console warning in development: `"Google Maps browser key missing; Location field will work without autocomplete"`

**Dependencies:**
- `@/shared/lib/google-maps-loader` (script loader)
- `@/shared/components/ui/input` (fallback)
- `@/shared/hooks/use-toast` (optional error toasts)
- Debounce utility (use `lodash.debounce` or custom hook)

### Phase 3: Integration in Order Forms

**1. CreateOrderDrawer:**
- Replace `location` FormField `Input` with `GooglePlacesAutocompleteInput`
- Handle `onSelect` to store `placeId` in form state (optional, for future use)
- Keep existing geocode-after-save logic unchanged

**2. EditOrderDrawer:**
- Replace `location` FormField `Input` with `GooglePlacesAutocompleteInput`
- Handle `onSelect` to store `placeId` (optional)
- Keep existing geocode-on-location-change logic unchanged

**3. OrderFormInline:**
- Replace `location` FormField `Input` with `GooglePlacesAutocompleteInput`
- Handle `onSelect` (optional `placeId` storage)
- Ensure inline form updates trigger parent `onUpdate` correctly
- Keep existing inline form behavior (no separate geocode trigger needed; handled by parent CreateInvoiceDrawer)

**Integration Notes:**
- All forms use React Hook Form with `FormField` wrapper
- Autocomplete component must be wrapped in `FormControl` for form validation
- `value` and `onChange` must integrate with `form.setValue` and `form.watch`
- Do not call geocoding immediately on autocomplete selection; wait for form save

### Phase 4: Testing & Validation

**Manual QA Checklist:**
1. **CreateOrderDrawer:**
   - Type in Location → see autocomplete dropdown
   - Select suggestion → Location field fills with formatted address
   - Save order → geocode runs after save → map pin appears
   - Test with invalid/missing browser key → falls back to plain input, no crashes

2. **EditOrderDrawer:**
   - Edit existing order Location → autocomplete works
   - Change location → save → geocode updates → map pin moves
   - Test manual "Recalculate location" button still works

3. **OrderFormInline (CreateInvoiceDrawer):**
   - Add inline order → type Location → autocomplete works
   - Select suggestion → save invoice → geocode runs for inline orders
   - Multiple inline orders can use autocomplete independently

4. **Edge Cases:**
   - Missing `VITE_GOOGLE_MAPS_BROWSER_KEY` → plain input works
   - Network error loading Google script → graceful fallback
   - Renovation vs New Memorial → autocomplete works for both
   - Invalid address selected → geocode fails gracefully (existing behavior)

**Build Validation:**
- TypeScript compilation passes
- No runtime errors when key is missing
- No blank pages or UI crashes

### Safety Considerations

**Script Loading:**
- Singleton loader prevents duplicate script tags
- Error handling prevents crashes if Google CDN is blocked
- Fallback to plain input ensures Location field remains functional

**API Key Security:**
- Browser key must be HTTP referrer restricted in Google Cloud Console
- Add localhost (http://localhost:8080, http://localhost:5173) and production domain
- Browser key is safe to expose in client code (referrer restriction protects it)
- Server-side geocoding key remains in Supabase secrets (never exposed)

**Data Flow:**
- Autocomplete only populates `location` text field
- Geocoding pipeline remains unchanged (server-side, secure)
- No lat/lng stored directly from autocomplete selection (still from Edge Function)

---

## What NOT to Do

**Out of Scope:**
- Saving `latitude`/`longitude` directly from Places selection (keep geocoding-after-save as source of truth)
- Country/region restrictions (autocomplete is global, no `componentRestrictions`)
- Bulk backfill of existing orders (separate task if needed)
- Real-time map preview while typing (map still uses persisted coordinates)

**Do Not Change:**
- Geocoding Edge Function logic
- Map rendering logic (still reads `latitude`/`longitude` from database)
- Form validation (location remains required string)
- Invoice totals/additional options/reporting (no impact on these modules)
- RLS policies or database schema

**Avoid:**
- Exposing server-side `GOOGLE_MAPS_API_KEY` to client
- Calling Geocoding API from client (keep server-side only)
- Breaking Renovation vs New Memorial flows (autocomplete applies to both)

---

## Open Questions / Considerations

**Decisions Made:**
- ✅ Use separate browser key for autocomplete (different from server-side key)
- ✅ Keep geocoding-after-save pipeline unchanged (autocomplete only improves input UX)
- ✅ Graceful fallback if script fails (no breaking changes)
- ✅ No country restriction (global suggestions)

**Potential Future Enhancements (Not in v1):**
- Store `place_id` from autocomplete selection for faster re-geocoding (if unchanged)
- Use Places Details API to get structured address components (street, city, postal code)
- Country/region filtering if needed for specific markets
- Keyboard navigation (up/down/enter) in dropdown (nice-to-have)

**Dependencies:**
- Google Maps JavaScript API must be enabled in Google Cloud project
- Browser key must be created and restricted (referrer-based) in Google Cloud Console
- `.env` must include `VITE_GOOGLE_MAPS_BROWSER_KEY` for autocomplete to work

**Testing Considerations:**
- Test in different browsers (Chrome, Firefox, Safari, Edge)
- Test on slower networks (script loading delay)
- Test with ad blockers (may block Google Maps script)
- Verify referrer restrictions work correctly (localhost vs production)

---

## Acceptance Criteria

✅ **Functional Requirements:**
- Typing in Location field shows Google Places autocomplete dropdown (with valid browser key)
- Clicking a suggestion fills Location field with formatted address
- Works in CreateOrderDrawer, EditOrderDrawer, and OrderFormInline
- Existing geocode-after-save still runs and persists coordinates to database
- Map pins continue to use persisted `latitude`/`longitude` (no change)

✅ **Non-Functional Requirements:**
- If browser key/script fails to load, Location field works as plain input (no crashes)
- No blank pages or UI errors when key is missing
- Build passes (TypeScript, linting)
- No breaking changes to Renovation/New Memorial flows

✅ **Security:**
- Browser key is referrer-restricted in Google Cloud Console
- Server-side geocoding key remains in Supabase secrets (never exposed)

✅ **Documentation:**
- `.env.example` includes `VITE_GOOGLE_MAPS_BROWSER_KEY` placeholder
- Manual QA checklist provided for Create/Edit/Inline flows
