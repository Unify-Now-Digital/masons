# Quickstart: Remove Manual Lat/Lng from Order UI

## Before You Start

- **Branch:** `feature/audit-remove-order-lat-lng`
- **Spec:** `specs/audit-remove-order-lat-lng-spec.md`
- **Scope:** UI only; no DB changes

## What Changes

1. **CreateOrderDrawer** — Remove "Coordinates (Optional)" section; stop sending lat/lng in create payload
2. **EditOrderDrawer** — Exclude lat/lng from update payload (no inputs to remove)
3. **OrderFormInline** — Remove Coordinates section; remove from defaults
4. **CreateInvoiceDrawer** — Omit lat/lng when creating order from invoice flow

## What Stays the Same

- **orders.latitude / orders.longitude** — DB columns unchanged
- **geocode-order-address** — Edge Function unchanged; continues to populate coords
- **Map module** — Unchanged; reads lat/lng from orders
- **Jobs** — Unchanged; jobs have own lat/lng

## Verification

After implementation:
1. Create order with address → geocode runs → Map shows pin
2. Edit order → save → existing coords not wiped
3. Create invoice + add order → geocode populates coords
