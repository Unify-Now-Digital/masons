# Orders + Invoices: Customizable Columns (Visibility, Order, Width) + Saved Presets (Supabase, Shared)

## Overview

Add column customization to Orders and Invoices modules, allowing users to:
- Toggle which columns are visible
- Reorder columns via drag-and-drop
- Resize column widths by dragging header dividers
- Save and load presets (shared for all users, stored in Supabase)
- Reset to default column configuration

**Context:**
- Orders module uses `SortableOrdersTable` component (custom table implementation)
- Invoices module uses shadcn/ui `Table` component (custom table implementation)
- No TanStack React Table detected in codebase
- Presets are shared across all users (not user-specific)
- Per-module presets (Orders presets separate from Invoices)

**Goal:**
- Enable column customization in Orders and Invoices tables
- Persist column configurations as shared presets in Supabase
- Provide intuitive UI for managing columns and presets
- Maintain backward compatibility with existing table implementations

---

## Current State Analysis

### Orders Module Table

**Component:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Current Structure:**
- Custom table implementation using shadcn/ui Table components
- Columns are hardcoded in component
- No column visibility, ordering, or width customization
- Table is sortable (hence "SortableOrdersTable")

**Observations:**
- Columns are defined statically in the component
- No state management for column configuration
- No persistence of column preferences

### Invoices Module Table

**Component:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Current Structure:**
- Uses shadcn/ui `Table` component directly
- Columns are hardcoded in JSX
- No column visibility, ordering, or width customization

**Observations:**
- Columns are defined statically in JSX
- No state management for column configuration
- No persistence of column preferences

### Relationship Analysis

**Current Relationship:**
- Orders and Invoices tables are independent implementations
- No shared table framework or column management system
- Each module manages its own table rendering

**Gaps/Issues:**
- No column customization capabilities
- No preset system for column configurations
- No persistence layer for column preferences
- Columns cannot be reordered or resized

### Data Access Patterns

**How Orders Table is Currently Accessed:**
- Columns defined in `SortableOrdersTable.tsx`
- Table rendered in `OrdersPage.tsx`
- No column state management

**How Invoices Table is Currently Accessed:**
- Columns defined inline in `InvoicingPage.tsx`
- Table rendered directly in page component
- No column state management

**How They Are Queried Together (if at all):**
- Currently independent implementations
- No shared column management logic

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**

Create new table: `table_view_presets`

```sql
create table if not exists public.table_view_presets (
  id uuid primary key default gen_random_uuid(),
  module text not null,  -- enum-like: 'orders' | 'invoices'
  name text not null,
  config jsonb not null,  -- stores column visibility/order/widths
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Constraints
  constraint unique_module_name unique (module, name)
);

-- Partial unique index to ensure only one default per module
create unique index idx_table_view_presets_one_default_per_module
  on public.table_view_presets (module)
  where is_default = true;

-- Index for querying presets by module
create index idx_table_view_presets_module on public.table_view_presets (module);

-- Enable RLS
alter table public.table_view_presets enable row level security;

-- RLS Policies (shared presets - all authenticated users can read/write)
create policy "Authenticated users can view presets"
  on public.table_view_presets
  for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can create presets"
  on public.table_view_presets
  for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update presets"
  on public.table_view_presets
  for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can delete presets"
  on public.table_view_presets
  for delete
  using (auth.role() = 'authenticated');

-- Updated_at trigger
create trigger update_table_view_presets_updated_at
  before update on public.table_view_presets
  for each row
  execute function public.update_updated_at_column();
```

**Non-Destructive Constraints:**
- Only additive changes (new table)
- No modifications to existing tables
- Backward compatibility maintained (default columns still work)

### Preset Config Schema (JSONB)

**Structure:**
```json
{
  "version": 1,
  "columns": {
    "visibility": {
      "id": true,
      "customer": true,
      "deceasedName": false,
      "orderType": true,
      "status": true,
      "dueDate": true,
      "value": true
    },
    "order": [
      "id",
      "customer",
      "orderType",
      "status",
      "dueDate",
      "value"
    ],
    "widths": {
      "id": 120,
      "customer": 180,
      "orderType": 150,
      "status": 100,
      "dueDate": 120,
      "value": 100
    }
  }
}
```

**Column IDs:**
- Must match column identifiers used in table components
- Orders: `id`, `customer`, `deceasedName`, `orderType`, `stoneStatus`, `permitStatus`, `proofStatus`, `dueDate`, `value`, etc.
- Invoices: `id`, `invoiceNumber`, `customer`, `amount`, `status`, `dueDate`, `issueDate`, etc.

---

## Implementation Approach

### Phase 1: Database & API Layer

1. **Create migration:**
   - Create `table_view_presets` table
   - Add indexes and constraints
   - Enable RLS with authenticated user policies

2. **Create API functions:**
   - `fetchPresetsByModule(module)` - Get all presets for a module
   - `createPreset(module, name, config, isDefault)` - Create new preset
   - `updatePreset(id, updates)` - Update preset (name, config, isDefault)
   - `deletePreset(id)` - Delete preset
   - `setDefaultPreset(module, presetId)` - Set default preset (ensures only one default)

3. **Create React Query hooks:**
   - `usePresetsByModule(module)` - Fetch presets for module
   - `useCreatePreset()` - Create preset mutation
   - `useUpdatePreset()` - Update preset mutation
   - `useDeletePreset()` - Delete preset mutation
   - `useSetDefaultPreset()` - Set default preset mutation

**File Locations:**
- `src/shared/tableViewPresets/api/tableViewPresets.api.ts`
- `src/shared/tableViewPresets/hooks/useTableViewPresets.ts`
- `src/shared/tableViewPresets/types/tableViewPresets.types.ts`

### Phase 2: Column State Management

1. **Create column state utilities:**
   - Column state type definitions
   - Default column configurations per module
   - State management hooks for column visibility, order, widths

2. **Column state structure:**
   ```typescript
   interface ColumnState {
     visibility: Record<string, boolean>;
     order: string[];
     widths: Record<string, number>;
   }
   ```

3. **Default configurations:**
   - Define default columns, order, and widths for Orders
   - Define default columns, order, and widths for Invoices
   - Export as constants for reset functionality

**File Locations:**
- `src/shared/tableViewPresets/utils/columnState.ts`
- `src/shared/tableViewPresets/config/defaultColumns.ts`

### Phase 3: Columns Panel UI

1. **Create ColumnsPanel component:**
   - Dialog/Drawer component with tabs
   - "Columns" tab: DnD list with visibility toggles
   - "Presets" tab: Preset management UI

2. **DnD Implementation:**
   - Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` if not present
   - Implement drag-and-drop for column reordering
   - Visual feedback during drag

3. **Column visibility controls:**
   - Checkbox for each column
   - Search/filter input (optional)
   - Column name display

4. **Preset management:**
   - List of presets with name and default badge
   - Apply preset button
   - Save current as preset (with name input)
   - Overwrite preset (with confirmation)
   - Rename preset
   - Delete preset (with confirmation)
   - Set as default preset

**File Locations:**
- `src/shared/tableViewPresets/components/ColumnsPanel.tsx`
- `src/shared/tableViewPresets/components/ColumnsTab.tsx`
- `src/shared/tableViewPresets/components/PresetsTab.tsx`

### Phase 4: Table Integration (Orders)

1. **Update SortableOrdersTable:**
   - Add column state management
   - Apply column visibility
   - Apply column order
   - Apply column widths (via inline styles)
   - Add resizer handles to column headers

2. **Column resizing:**
   - Add resizer div to each column header
   - Handle mouse drag events
   - Update width state on resize end
   - Persist widths in state

3. **Load default preset:**
   - On component mount, fetch presets for 'orders'
   - If default preset exists, apply it
   - Otherwise use default column configuration

4. **Add "Columns" button:**
   - Add button to OrdersPage toolbar
   - Opens ColumnsPanel with module='orders'

**File Locations:**
- `src/modules/orders/components/SortableOrdersTable.tsx` (modified)
- `src/modules/orders/pages/OrdersPage.tsx` (modified)

### Phase 5: Table Integration (Invoices)

1. **Update InvoicingPage table:**
   - Add column state management
   - Apply column visibility
   - Apply column order
   - Apply column widths (via inline styles)
   - Add resizer handles to column headers

2. **Column resizing:**
   - Add resizer div to each column header
   - Handle mouse drag events
   - Update width state on resize end
   - Persist widths in state

3. **Load default preset:**
   - On component mount, fetch presets for 'invoices'
   - If default preset exists, apply it
   - Otherwise use default column configuration

4. **Add "Columns" button:**
   - Add button to InvoicingPage toolbar
   - Opens ColumnsPanel with module='invoices'

**File Locations:**
- `src/modules/invoicing/pages/InvoicingPage.tsx` (modified)

### Phase 6: Testing & Validation

1. **Test column visibility:**
   - Toggle columns on/off
   - Verify table updates correctly
   - Verify state persists during session

2. **Test column reordering:**
   - Drag and drop columns
   - Verify order updates correctly
   - Verify state persists during session

3. **Test column resizing:**
   - Drag column dividers
   - Verify widths update correctly
   - Verify state persists during session

4. **Test presets:**
   - Save current state as preset
   - Apply preset
   - Set default preset
   - Verify default applies on page load
   - Delete preset
   - Reset to default columns

5. **Test module isolation:**
   - Verify Orders presets don't affect Invoices
   - Verify Invoices presets don't affect Orders

---

## What NOT to Do

- **Do NOT create user-specific presets** (shared presets only)
- **Do NOT create a reusable table framework** (implement per-module for now)
- **Do NOT modify existing table data structures** (only add column state management)
- **Do NOT break existing table functionality** (sorting, filtering, etc.)
- **Do NOT add column customization to other modules** (Orders and Invoices only)

---

## Open Questions / Considerations

1. **DnD Library:**
   - Check if `@dnd-kit` is already installed
   - If not, install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
   - Alternative: Use existing DnD library if one is already in use

2. **Column Width Units:**
   - Use pixels (px) for column widths
   - Store as numbers in JSONB
   - Apply via inline styles: `style={{ width: width, minWidth: width }}`

3. **Default Preset Enforcement:**
   - Use partial unique index to ensure only one default per module
   - Handle race conditions in application code when setting default

4. **Column ID Naming:**
   - Use consistent column IDs across modules
   - Match IDs to column keys/identifiers in table components
   - Document column IDs in default column configurations

5. **Reset to Default:**
   - Reset button restores default column configuration
   - Does not delete presets
   - Immediately applies default state to table

---

## Acceptance Criteria

### Orders Module:
- ✅ "Columns" button exists in toolbar
- ✅ User can show/hide columns via checkboxes
- ✅ User can drag-and-drop to reorder columns
- ✅ User can resize columns by dragging header divider
- ✅ User can save current state as preset (with name)
- ✅ User can apply saved preset
- ✅ User can set a default preset; it applies on page load
- ✅ User can reset to default columns
- ✅ User can rename, delete, and overwrite presets

### Invoices Module:
- ✅ Same behaviors as Orders module
- ✅ Presets are isolated per module ('invoices' vs 'orders')

### General:
- ✅ Presets are shared (not user-specific)
- ✅ No runtime errors
- ✅ Build + lint pass
- ✅ Additive-only migrations
- ✅ Backward compatible (default columns work without presets)

---

## Success Metrics

- Users can customize columns in Orders and Invoices tables
- Column preferences persist across sessions via shared presets
- Default presets apply automatically on page load
- Column customization improves user workflow efficiency
- No regressions in existing table functionality

