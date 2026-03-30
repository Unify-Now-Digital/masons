# Data Model: Remove Manual Lat/Lng (No Changes)

## Scope

**No DB migrations.** This task is UI-only.

## Existing Schema (Unchanged)

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| orders | latitude | numeric(10,8) | Keep — Map uses |
| orders | longitude | numeric(10,8) | Keep — Map uses |
| jobs | latitude | decimal(10,8) | Out of scope |
| jobs | longitude | decimal(11,8) | Out of scope |

## Order Type (Unchanged)

- `Order` interface keeps `latitude`, `longitude` — Map and geocode logic read them
- Form schemas: remove from user-editable fields; keep optional in OrderFormData for type compat if needed
