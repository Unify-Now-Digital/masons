# Research: Remove Manual Lat/Lng from Order UI

## Context

- **orders.latitude**, **orders.longitude** — DB columns used by Map module
- **geocode-order-address** Edge Function — populates lat/lng after order save (source of truth)
- Manual inputs in Order drawer — optional fallback; removing them does not break Map
- **jobs.latitude/longitude** — separate; out of scope (no changes)

## Technical Constraints

- Do NOT change Map module
- Do NOT change geocode-order-address Edge Function
- Do NOT drop DB columns
- UI only — remove inputs, stop writing from form payloads

## Key Flows

1. **CreateOrderDrawer**: Form has lat/lng inputs → orderData includes `latitude`, `longitude` → createOrder → geocode runs async
2. **OrderFormInline** (Invoicing): Form has lat/lng → `onUpdate` passes form values to parent → CreateInvoiceDrawer uses when creating order
3. **EditOrderDrawer**: No manual lat/lng inputs; reads `order.latitude/longitude` for geocode status validation only
4. **CreateInvoiceDrawer**: Passes `latitude`, `longitude` from order.data when creating order

## OrderFormSchema

- `order.schema.ts` has `latitude` and `longitude` with zod validation
- Used by CreateOrderDrawer, EditOrderDrawer, OrderFormInline (all use `orderFormSchema`)
- Keep in schema as optional for type compatibility (Order model needs them); remove from rendered form

## Exclusion Strategy

- **CreateOrderDrawer**: Omit `latitude`, `longitude` from orderData (or send null); geocoding will populate
- **EditOrderDrawer**: Exclude `latitude`, `longitude` from update payload so we don't overwrite existing coords
- **OrderFormInline / CreateInvoiceDrawer**: Omit from form and payload; new orders get null, geocoding populates
