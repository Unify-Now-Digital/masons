# Implementation Plan: Add Address Autocomplete Dropdown Suggestions to Order Location Field

## Feature Overview

Add Google Places Autocomplete dropdown suggestions to the Order "Location" field to improve address entry UX. When users type in the Location field, they will see address suggestions from Google Places. Selecting a suggestion fills the input with the formatted address. The existing async geocoding-after-save behavior (Edge Function) remains the source of truth for latitude/longitude persistence.

**Branch:** `feature/add-address-autocomplete-dropdown`  
**Spec File:** `specs/add-address-autocomplete-dropdown-suggestions-order-location-google-places.md`

---

## Technical Context

### Current State
- Location field is a plain text `Input` component in:
  - `src/modules/orders/components/CreateOrderDrawer.tsx`
  - `src/modules/orders/components/EditOrderDrawer.tsx`
  - `src/modules/invoicing/components/OrderFormInline.tsx`
- No client-side Google Maps integration (only server-side geocoding via Edge Function)
- Existing geocoding pipeline: `useGeocodeOrderAddress` hook → `geocode-order-address` Edge Function
- Edge Function uses `GOOGLE_MAPS_API_KEY` from Supabase secrets (server-side only)
- Form schema: `location` is required string in `src/modules/orders/schemas/order.schema.ts`
- All forms use React Hook Form with `FormField` wrapper

### Key Files
- `src/modules/orders/components/CreateOrderDrawer.tsx` - Order creation form
- `src/modules/orders/components/EditOrderDrawer.tsx` - Order editing form
- `src/modules/invoicing/components/OrderFormInline.tsx` - Inline order form for invoices
- `src/modules/orders/schemas/order.schema.ts` - Order form validation schema
- `src/modules/orders/hooks/useGeocodeOrderAddress.ts` - Geocoding mutation hook (no changes)
- `supabase/functions/geocode-order-address/index.ts` - Edge Function (no changes)
- `src/shared/components/ui/input.tsx` - Base Input component (fallback)
- `.env.example` - Environment variables template

### Constraints
- **No database changes** - Location field remains text, no schema updates needed
- **No Edge Function changes** - Existing geocoding pipeline unchanged
- **No map logic changes** - Map still reads persisted `latitude`/`longitude` from database
- **Defensive null handling** - If Google script fails, fall back to plain input (no crashes)
- **Browser key security** - Use separate `VITE_GOOGLE_MAPS_BROWSER_KEY` with HTTP referrer restrictions
- **Server-side key remains secure** - `GOOGLE_MAPS_API_KEY` stays in Supabase secrets (never exposed)
- **Geocoding-after-save unchanged** - Autocomplete only improves input UX; coordinates still from Edge Function
- **Works for both order types** - Renovation and New Memorial flows must remain functional

### Architecture Decision: Client-Side Autocomplete with Server-Side Geocoding

**Rationale:**
- Autocomplete improves UX by providing suggestions while typing (client-side)
- Geocoding remains server-side for security (API key in Supabase secrets)
- Two separate keys: browser key for autocomplete (referrer-restricted), server key for geocoding (never exposed)
- Autocomplete populates `location` text field; geocoding-after-save persists coordinates

**Data Flow:**
1. User types in Location field → Google Places Autocomplete shows suggestions
2. User selects suggestion → Location field fills with formatted address
3. User saves order → Existing `useGeocodeOrderAddress` hook triggers
4. Edge Function geocodes address → Updates `latitude`, `longitude`, `geocode_status`
5. Map reads persisted coordinates → Pin appears/updates

---

## Implementation Phases

### Phase 1: Environment Setup & Script Loader

**Goal:** Add environment variable and create a singleton Google Maps script loader utility.

#### Task 1.1: Add Environment Variable
**File:** `.env.example`

**Implementation:**
```bash
# Google Maps Browser Key (for Places Autocomplete - HTTP referrer restricted)
# Create in Google Cloud Console: APIs & Services > Credentials
# Restrict to: http://localhost:8080, http://localhost:5173, and production domain
VITE_GOOGLE_MAPS_BROWSER_KEY=your_browser_key_here
```

**Validation:**
- Variable name matches `VITE_GOOGLE_MAPS_BROWSER_KEY` (Vite prefix required)
- Placeholder value is clear and indicates it's optional
- Comment explains key creation and restriction requirements

**Success Criteria:**
- `.env.example` includes new variable with documentation comment
- Variable follows Vite naming convention (`VITE_*`)

#### Task 1.2: Create Google Maps Script Loader Utility
**File:** `src/shared/lib/googleMapsLoader.ts`

**Implementation:**
```typescript
/**
 * Singleton loader for Google Maps JavaScript API with Places library
 * Prevents duplicate script injection and provides safe Promise-based loading
 */

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: typeof google.maps.places;
      };
    };
  }
}

let loadPromise: Promise<typeof google.maps.places> | null = null;
let isLoaded = false;

/**
 * Check if Google Maps script is already loaded
 */
export function isGoogleMapsLoaded(): boolean {
  return isLoaded && typeof window.google !== 'undefined' && 
         typeof window.google.maps !== 'undefined' && 
         typeof window.google.maps.places !== 'undefined';
}

/**
 * Load Google Maps JavaScript API script with Places library
 * Returns a cached Promise if already loading/loaded
 */
export function loadGoogleMapsScript(): Promise<typeof google.maps.places> {
  // Return cached promise if already loading or loaded
  if (loadPromise) {
    return loadPromise;
  }

  if (isGoogleMapsLoaded()) {
    return Promise.resolve(window.google!.maps!.places!);
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;
  
  if (!apiKey) {
    if (import.meta.env.DEV) {
      console.warn(
        'VITE_GOOGLE_MAPS_BROWSER_KEY is missing. Location field will work without autocomplete.'
      );
    }
    return Promise.reject(new Error('Google Maps browser key not configured'));
  }

  // Check if script tag already exists
  const existingScript = document.querySelector(
    `script[src*="maps.googleapis.com/maps/api/js"]`
  );
  
  if (existingScript) {
    // Script exists but may not be loaded yet - wait for it
    loadPromise = new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (isGoogleMapsLoaded()) {
          clearInterval(checkInterval);
          resolve(window.google!.maps!.places!);
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Google Maps script load timeout'));
      }, 10000); // 10 second timeout
    });
    
    return loadPromise;
  }

  // Create and inject script tag
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      // Wait for google.maps.places to be available
      const checkGoogle = setInterval(() => {
        if (isGoogleMapsLoaded()) {
          clearInterval(checkGoogle);
          isLoaded = true;
          resolve(window.google!.maps!.places!);
        }
      }, 50);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkGoogle);
        reject(new Error('Google Maps Places library failed to load'));
      }, 5000);
    };
    
    script.onerror = () => {
      loadPromise = null; // Reset to allow retry
      reject(new Error('Failed to load Google Maps script'));
    };
    
    document.head.appendChild(script);
  });

  return loadPromise;
}
```

**Validation:**
- Singleton pattern prevents duplicate script tags
- Promise caching ensures multiple components can call it safely
- Error handling for missing key, network failures, timeouts
- Checks for existing script tags before injecting
- TypeScript types for `window.google` global

**Success Criteria:**
- Loader does not inject duplicate scripts
- Returns cached Promise if already loading/loaded
- Handles missing key gracefully (rejects with clear error)
- Handles network errors without crashing
- DEV warning logged if key is missing

---

### Phase 2: Reusable Autocomplete Input Component

**Goal:** Create a reusable React component that wraps Google Places Autocomplete with dropdown UI.

#### Task 2.1: Create GooglePlacesAutocompleteInput Component
**File:** `src/shared/components/GooglePlacesAutocompleteInput.tsx`

**Props Interface:**
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

**Implementation Structure:**
1. **State Management:**
   - `predictions`: Array of `google.maps.places.AutocompletePrediction`
   - `isLoading`: Boolean for script/predictions loading
   - `isOpen`: Boolean for dropdown visibility
   - `selectedIndex`: Number for keyboard navigation (optional)

2. **Script Loading (useEffect):**
   ```typescript
   useEffect(() => {
     loadGoogleMapsScript()
       .then(() => {
         // Initialize AutocompleteService
         const service = new google.maps.places.AutocompleteService();
         setAutocompleteService(service);
       })
       .catch(() => {
         // Graceful fallback - component will render plain Input
         setAutocompleteService(null);
       });
   }, []);
   ```

3. **Debounced Prediction Fetching:**
   - Use `useDebounce` hook or `lodash.debounce` (~250ms delay)
   - Call `autocompleteService.getPlacePredictions()` on input change
   - Store results in `predictions` state
   - Handle errors gracefully (show empty list, don't crash)

4. **Dropdown UI:**
   - Position absolute below input
   - Use shadcn styling (similar to `SelectContent` dropdown)
   - Show loading state while fetching
   - Render `prediction.description` for each item
   - Highlight on hover
   - Close on outside click (use `onClickOutside` hook or similar)

5. **Selection Handling:**
   - On click: `onChange(prediction.description)`, `onSelect({ address, placeId })`
   - Close dropdown and clear predictions

6. **Fallback Rendering:**
   - If `autocompleteService` is null → render standard `<Input />`
   - Maintain same props/API so form integration is seamless

**Dependencies:**
- `@/shared/lib/googleMapsLoader` - Script loader
- `@/shared/components/ui/input` - Fallback Input component
- `@/shared/components/ui/card` or similar - Dropdown styling (optional)
- `use-debounce` package or custom debounce hook
- `use-on-click-outside` hook or similar

**Validation:**
- Component renders without crashing if Google script fails
- Dropdown shows predictions correctly
- Selection updates form value
- Keyboard navigation works (optional, nice-to-have)
- Dropdown closes on blur/outside click

**Success Criteria:**
- Typing shows address suggestions in dropdown
- Clicking suggestion fills input value
- Works even if Maps script loads late (async handling)
- Falls back to plain Input if API unavailable
- No crashes on errors (missing key, network failure, etc.)

---

### Phase 3: Orders UI Integration

**Goal:** Replace Location `Input` fields with `GooglePlacesAutocompleteInput` in all order entry points.

#### Task 3.1: Update CreateOrderDrawer
**File:** `src/modules/orders/components/CreateOrderDrawer.tsx`

**Changes:**
1. Import `GooglePlacesAutocompleteInput`:
   ```typescript
   import { GooglePlacesAutocompleteInput } from '@/shared/components/GooglePlacesAutocompleteInput';
   ```

2. Replace Location FormField `Input` with autocomplete:
   ```typescript
   <FormField
     control={form.control}
     name="location"
     render={({ field }) => (
       <FormItem>
         <FormLabel>Location *</FormLabel>
         <FormControl>
           <GooglePlacesAutocompleteInput
             value={field.value || ''}
             onChange={(value) => field.onChange(value)}
             onSelect={(result) => {
               // Optional: store placeId in local state if needed
               // field.onChange(result.address) is already called by onChange
             }}
             placeholder="Enter installation address"
             disabled={isPending}
           />
         </FormControl>
         <FormMessage />
       </FormItem>
     )}
   />
   ```

3. Keep existing geocode-after-save logic unchanged:
   - `geocodeMutation.mutate()` call after successful order creation
   - Status display and feedback unchanged

**Validation:**
- Autocomplete works in create flow
- Form validation still works (location required)
- Geocoding still triggers after save
- Renovation vs New Memorial flows unchanged

**Success Criteria:**
- Autocomplete dropdown appears when typing Location
- Selecting suggestion fills Location field
- Order creation still works with autocomplete-selected address
- Geocoding runs after save (existing behavior)

#### Task 3.2: Update EditOrderDrawer
**File:** `src/modules/orders/components/EditOrderDrawer.tsx`

**Changes:**
1. Import `GooglePlacesAutocompleteInput` (same as Task 3.1)

2. Replace Location FormField `Input` with autocomplete:
   - Use same pattern as CreateOrderDrawer
   - Pre-fill value from existing order `location`

3. Keep existing geocode logic unchanged:
   - Geocode triggers on location change (comparison with initial value)
   - "Recalculate location" button still works
   - Status display remains functional

**Validation:**
- Autocomplete works in edit flow
- Pre-filled location value displays correctly
- Location change detection still works
- Manual recalculate button still functions

**Success Criteria:**
- Autocomplete works when editing Location
- Changing location via dropdown triggers geocode on save
- Manual "Recalculate location" button still works
- Geocode status display remains accurate

#### Task 3.3: Update OrderFormInline
**File:** `src/modules/invoicing/components/OrderFormInline.tsx`

**Changes:**
1. Import `GooglePlacesAutocompleteInput` (same as Task 3.1)

2. Replace Location FormField `Input` with autocomplete:
   - Use same pattern as CreateOrderDrawer
   - Ensure `onChange` triggers parent `onUpdate` correctly

3. Verify inline form behavior:
   - Autocomplete does not interfere with form array management
   - Multiple inline orders can use autocomplete independently
   - Parent `CreateInvoiceDrawer` handles geocoding for inline orders

**Validation:**
- Autocomplete works in inline form context
- Multiple inline orders work correctly
- Form updates trigger parent callbacks
- Geocoding still runs for inline orders (handled by parent)

**Success Criteria:**
- Autocomplete works in inline invoice order form
- Selecting suggestion updates form value correctly
- Multiple inline orders can use autocomplete
- Invoice creation still works with autocomplete

---

### Phase 4: Validation & QA

**Goal:** Verify implementation works correctly in all scenarios and handles failures gracefully.

#### Task 4.1: Manual Testing Checklist

**CreateOrderDrawer Tests:**
- [ ] Type in Location field → autocomplete dropdown appears
- [ ] Select suggestion → Location field fills with formatted address
- [ ] Save order → geocode runs after save → map pin appears
- [ ] Test with invalid/missing browser key → falls back to plain input, no crashes
- [ ] Test manual typing (no autocomplete) → still works normally

**EditOrderDrawer Tests:**
- [ ] Edit existing order Location → autocomplete works
- [ ] Change location via dropdown → save → geocode updates → map pin moves
- [ ] Test manual "Recalculate location" button still works
- [ ] Test pre-filled location value displays correctly

**OrderFormInline Tests:**
- [ ] Add inline order → type Location → autocomplete works
- [ ] Select suggestion → save invoice → geocode runs for inline orders
- [ ] Multiple inline orders can use autocomplete independently

**Edge Case Tests:**
- [ ] Missing `VITE_GOOGLE_MAPS_BROWSER_KEY` → plain input fallback, no crash
- [ ] Invalid key / API disabled → no crash, graceful fallback
- [ ] Network error loading Google script → fallback to plain input
- [ ] Renovation vs New Memorial → autocomplete works for both
- [ ] Invalid address selected → geocode fails gracefully (existing behavior)

#### Task 4.2: Build & Type Checks

**Commands:**
```bash
# TypeScript compilation
npx tsc --noEmit

# Production build
npm run build

# Linting (if applicable)
npm run lint
```

**Validation:**
- TypeScript compilation passes (no type errors)
- Production build succeeds
- No runtime errors when key is missing
- No blank pages or UI crashes

**Success Criteria:**
- All build checks pass
- No TypeScript errors
- No runtime crashes on missing/invalid key
- Production build succeeds

---

## Progress Tracking

- [ ] **Phase 1: Environment Setup & Script Loader**
  - [ ] Task 1.1: Add environment variable to `.env.example`
  - [ ] Task 1.2: Create `googleMapsLoader.ts` utility

- [ ] **Phase 2: Reusable Autocomplete Input Component**
  - [ ] Task 2.1: Create `GooglePlacesAutocompleteInput.tsx` component

- [ ] **Phase 3: Orders UI Integration**
  - [ ] Task 3.1: Update `CreateOrderDrawer.tsx`
  - [ ] Task 3.2: Update `EditOrderDrawer.tsx`
  - [ ] Task 3.3: Update `OrderFormInline.tsx`

- [ ] **Phase 4: Validation & QA**
  - [ ] Task 4.1: Complete manual testing checklist
  - [ ] Task 4.2: Build & type checks pass

---

## Risk Mitigation

**Risk:** Google Maps script fails to load (network, CORS, ad blocker)  
**Mitigation:** Graceful fallback to plain `Input` component; no crashes; DEV warning logged

**Risk:** Browser key is missing or invalid  
**Mitigation:** Component detects missing key and falls back to plain input; DEV warning guides user

**Risk:** Autocomplete interferes with form validation  
**Mitigation:** Component maintains same `value`/`onChange` API as `Input`; works seamlessly with React Hook Form

**Risk:** Multiple autocomplete instances cause duplicate script loads  
**Mitigation:** Singleton loader utility caches Promise; checks for existing script tags

**Risk:** Breaking changes to existing geocoding pipeline  
**Mitigation:** No changes to `useGeocodeOrderAddress` hook or Edge Function; autocomplete only affects input UX

---

## Dependencies & Prerequisites

**External Dependencies:**
- Google Maps JavaScript API must be enabled in Google Cloud project
- Browser API key must be created with Places API enabled
- Key must be HTTP referrer restricted (localhost + production domain)

**Code Dependencies:**
- React Hook Form (already in use)
- shadcn/ui components (already in use)
- `use-debounce` package or custom debounce hook (may need installation)

**Environment Setup:**
- `.env` file must include `VITE_GOOGLE_MAPS_BROWSER_KEY` for autocomplete to work
- Key is optional; app works without it (falls back to plain input)

---

## Success Criteria Summary

✅ **Functional:**
- Typing in Location shows Google Places autocomplete dropdown (with valid key)
- Clicking suggestion fills Location field
- Works in CreateOrderDrawer, EditOrderDrawer, and OrderFormInline
- Existing geocode-after-save still runs

✅ **Non-Functional:**
- Graceful fallback if key/script fails (plain input, no crashes)
- No blank pages or UI errors
- Build passes (TypeScript, production build)

✅ **Security:**
- Browser key is referrer-restricted
- Server-side geocoding key remains secure (never exposed)

✅ **Documentation:**
- `.env.example` includes new variable
- Manual QA checklist provided
