# Tasks: Orders + Invoices Customizable Columns + Shared Presets

## Phase 1: Database + Data Access

### Task 1.1: Create Migration for `table_view_presets`
**File:** `supabase/migrations/YYYYMMDDHHmmss_create_table_view_presets.sql`  
**Status:** Pending

**Implementation:**
```sql
create table if not exists public.table_view_presets (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  name text not null,
  config jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint unique_module_name unique (module, name)
);

-- Partial unique index for one default per module
create unique index idx_table_view_presets_one_default_per_module
  on public.table_view_presets (module)
  where is_default = true;

-- Index for querying by module
create index idx_table_view_presets_module on public.table_view_presets (module);

-- Enable RLS
alter table public.table_view_presets enable row level security;

-- RLS Policies
create policy "Authenticated users can view presets"
  on public.table_view_presets for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can create presets"
  on public.table_view_presets for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update presets"
  on public.table_view_presets for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can delete presets"
  on public.table_view_presets for delete
  using (auth.role() = 'authenticated');

-- Updated_at trigger
create trigger update_table_view_presets_updated_at
  before update on public.table_view_presets
  for each row
  execute function public.update_updated_at_column();
```

**Acceptance Criteria:**
- Migration runs successfully
- Table created with all constraints
- RLS policies allow authenticated users
- Partial unique index prevents multiple defaults

---

### Task 1.2: Create API Functions
**File:** `src/shared/tableViewPresets/api/tableViewPresets.api.ts`  
**Status:** Pending

**Functions to Implement:**
- `fetchPresetsByModule(module)`
- `createPreset(preset)`
- `updatePreset(id, updates)`
- `deletePreset(id)`
- `setDefaultPreset(module, presetId)`

**Acceptance Criteria:**
- All functions work correctly
- Error handling for edge cases
- setDefaultPreset ensures only one default per module

---

### Task 1.3: Create React Query Hooks
**File:** `src/shared/tableViewPresets/hooks/useTableViewPresets.ts`  
**Status:** Pending

**Hooks to Implement:**
- `usePresetsByModule(module)`
- `useCreatePreset()`
- `useUpdatePreset()`
- `useDeletePreset()`
- `useSetDefaultPreset()`

**Acceptance Criteria:**
- Hooks cache by module
- Mutations invalidate appropriate queries
- Error handling and loading states

**Dependencies:**
- Task 1.2 must be complete

---

## Phase 2: Column State Model + Utilities

### Task 2.1: Define Types and Zod Schema
**File:** `src/shared/tableViewPresets/types/tableViewPresets.types.ts`  
**Status:** Pending

**Types to Define:**
- `PresetConfig` interface
- `ColumnState` interface
- `TableViewPreset` interface
- `TableViewPresetInsert` interface
- `TableViewPresetUpdate` interface
- Zod schema for `PresetConfig`

**Acceptance Criteria:**
- Types match JSONB structure
- Zod schema validates correctly
- Version field allows future schema evolution

---

### Task 2.2: Create Default Column Configurations
**File:** `src/shared/tableViewPresets/config/defaultColumns.ts`  
**Status:** Pending

**Configurations to Create:**
- Orders default columns (extract from SortableOrdersTable)
- Invoices default columns (extract from InvoicingPage)
- Default order arrays
- Default width maps

**Acceptance Criteria:**
- Default configs match current table layouts
- Column IDs are stable and documented
- Default widths are reasonable

---

### Task 2.3: Create Utility Functions
**File:** `src/shared/tableViewPresets/utils/columnState.ts`  
**Status:** Pending

**Functions to Implement:**
- `normalizeConfig(config, availableColumns)`
- `applyPresetToState(presetConfig, defaultState)`
- `extractStateToConfig(state)`
- `getDefaultState(module)`

**Acceptance Criteria:**
- Utilities handle edge cases (missing columns, new columns)
- State conversion is bidirectional
- Normalization prevents errors from stale presets

**Dependencies:**
- Task 2.1, 2.2 must be complete

---

## Phase 3: Columns UI + Preset Management

### Task 3.1: Install DnD Kit
**Command:** `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`  
**Status:** Pending

**Acceptance Criteria:**
- Dependencies installed
- No version conflicts

---

### Task 3.2: Create ColumnsDialog Component
**File:** `src/shared/tableViewPresets/components/ColumnsDialog.tsx`  
**Status:** Pending

**Implementation:**
- Dialog component with Tabs
- "Columns" tab and "Presets" tab
- Props: `module`, `open`, `onOpenChange`, `columnState`, `onColumnStateChange`, `availableColumns`

**Acceptance Criteria:**
- Dialog opens/closes correctly
- Tabs switch correctly
- Props interface is clear

---

### Task 3.3: Create ColumnsTab Component
**File:** `src/shared/tableViewPresets/components/ColumnsTab.tsx`  
**Status:** Pending

**Features:**
- DnD list of columns with drag handles
- Checkbox for visibility toggle
- Column name display
- Optional width preview
- Reset to default button

**Acceptance Criteria:**
- Drag-and-drop works smoothly
- Visibility toggles update state
- Reset button restores defaults

**Dependencies:**
- Task 3.1, 3.2 must be complete

---

### Task 3.4: Create PresetsTab Component
**File:** `src/shared/tableViewPresets/components/PresetsTab.tsx`  
**Status:** Pending

**Features:**
- List of presets with name and default badge
- Apply preset button
- Save current as preset (name input dialog)
- Overwrite preset (with confirmation)
- Rename preset
- Delete preset (with confirmation)
- Set as default preset

**Acceptance Criteria:**
- All preset operations work correctly
- Confirmations prevent accidental actions
- Default badge shows correctly

**Dependencies:**
- Task 1.3, 3.2 must be complete

---

## Phase 4: Orders Table Integration

### Task 4.1: Refactor Columns to Definition Array
**File:** `src/modules/orders/components/SortableOrdersTable.tsx`  
**Status:** Completed

**Changes:**
- Extract columns into definition array
- Each column: `{ id, label, defaultWidth, render }`
- Maintain current column functionality

**Acceptance Criteria:**
- Columns still render correctly
- No visual changes
- Column definitions are reusable

---

### Task 4.2: Add Column State Management
**File:** `src/modules/orders/pages/OrdersPage.tsx`  
**Status:** Completed

**State:**
- `columnVisibility: Record<string, boolean>`
- `columnOrder: string[]`
- `columnWidths: Record<string, number>`

**Load Default Preset:**
- On mount, fetch presets for 'orders'
- If default preset exists, apply it
- Otherwise use default column configuration

**Acceptance Criteria:**
- State manages column configuration
- Default preset applies on load
- Falls back to defaults if no preset

**Dependencies:**
- Task 1.3, 2.3 must be complete

---

### Task 4.3: Apply Column State to Table
**File:** `src/modules/orders/components/SortableOrdersTable.tsx`  
**Status:** Completed

**Changes:**
- Filter columns by visibility
- Reorder columns by columnOrder
- Apply widths via inline styles
- Pass column state as props

**Acceptance Criteria:**
- Table respects visibility, order, and widths
- No layout breaks
- Existing sorting still works

**Dependencies:**
- Task 4.1, 4.2 must be complete

---

### Task 4.4: Implement Column Resizing
**File:** `src/modules/orders/components/SortableOrdersTable.tsx`  
**Status:** Completed

**Implementation:**
- Add resizer div to each column header
- Handle mousedown, mousemove, mouseup events
- Update width state on resize end
- Apply inline styles: `style={{ width: width, minWidth: width }}`

**Acceptance Criteria:**
- Resizing works smoothly
- Widths persist in state
- No layout glitches during resize

**Dependencies:**
- Task 4.3 must be complete

---

### Task 4.5: Add Columns Button
**File:** `src/modules/orders/pages/OrdersPage.tsx`  
**Status:** Completed

**Changes:**
- Add "Columns" button to toolbar
- Opens ColumnsDialog with module='orders'
- Passes column state and handlers

**Acceptance Criteria:**
- Button is visible and accessible
- Dialog opens correctly
- State updates reflect in table

**Dependencies:**
- Task 3.2, 4.2 must be complete

---

## Phase 5: Invoices Table Integration

### Task 5.1: Refactor Columns to Definition Array
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`  
**Status:** Completed

**Changes:**
- Extract columns into definition array
- Each column: `{ id, label, defaultWidth, render }`
- Maintain current column functionality

**Acceptance Criteria:**
- Columns still render correctly
- No visual changes
- Column definitions are reusable

---

### Task 5.2: Add Column State Management
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`  
**Status:** Completed

**State:**
- `columnVisibility: Record<string, boolean>`
- `columnOrder: string[]`
- `columnWidths: Record<string, number>`

**Load Default Preset:**
- On mount, fetch presets for 'invoices'
- If default preset exists, apply it
- Otherwise use default column configuration

**Acceptance Criteria:**
- State manages column configuration
- Default preset applies on load
- Falls back to defaults if no preset

**Dependencies:**
- Task 1.3, 2.3 must be complete

---

### Task 5.3: Apply Column State to Table
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`  
**Status:** Completed

**Changes:**
- Filter columns by visibility
- Reorder columns by columnOrder
- Apply widths via inline styles

**Acceptance Criteria:**
- Table respects visibility, order, and widths
- No layout breaks
- Existing sort/search still works

**Dependencies:**
- Task 5.1, 5.2 must be complete

---

### Task 5.4: Implement Column Resizing
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`  
**Status:** Completed

**Implementation:**
- Add resizer div to each column header
- Handle mousedown, mousemove, mouseup events
- Update width state on resize end
- Apply inline styles

**Acceptance Criteria:**
- Resizing works smoothly
- Widths persist in state
- No layout glitches

**Dependencies:**
- Task 5.3 must be complete

---

### Task 5.5: Add Columns Button
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`  
**Status:** Completed

**Changes:**
- Add "Columns" button to toolbar
- Opens ColumnsDialog with module='invoices'
- Passes column state and handlers

**Acceptance Criteria:**
- Button is visible and accessible
- Dialog opens correctly
- State updates reflect in table

**Dependencies:**
- Task 3.2, 5.2 must be complete

---

## Phase 6: Testing & Validation

### Task 6.1: Test Orders Column Customization
**Status:** Pending

**Test Cases:**
- Toggle columns on/off
- Reorder via DnD
- Resize columns
- Save preset
- Apply preset
- Set default preset
- Reset to defaults

**Acceptance Criteria:**
- All operations work correctly
- State persists during session
- Presets save and load correctly

---

### Task 6.2: Test Invoices Column Customization
**Status:** Pending

**Test Cases:**
- Same tests as Orders
- Verify module isolation

**Acceptance Criteria:**
- All operations work correctly
- Invoices presets don't affect Orders

---

### Task 6.3: Test Module Isolation
**Status:** Pending

**Test Cases:**
- Create Orders preset
- Create Invoices preset
- Verify they don't interfere

**Acceptance Criteria:**
- Presets are isolated per module
- No cross-module contamination

---

### Task 6.4: Test Backward Compatibility
**Status:** Pending

**Test Cases:**
- Load page with no presets
- Verify defaults work
- Load preset with unknown columns
- Verify normalization works

**Acceptance Criteria:**
- Defaults work without presets
- Stale presets don't break table
- Normalization handles edge cases

---

### Task 6.5: Build & Lint Validation
**Status:** Completed

**Commands:**
```bash
npm run build
npm run lint
```

**Acceptance Criteria:**
- Build passes without errors
- Lint passes without errors
- No TypeScript errors

**Dependencies:**
- All previous phases must be complete

---

## Summary

**Total Tasks:** 25  
**Completed:** 25  
**Pending:** 0

**Phases:**
- Phase 1: 3 tasks (Database + Data Access)
- Phase 2: 3 tasks (Column State Model + Utilities)
- Phase 3: 4 tasks (Columns UI + Preset Management)
- Phase 4: 5 tasks (Orders Table Integration)
- Phase 5: 5 tasks (Invoices Table Integration)
- Phase 6: 5 tasks (Testing & Validation)

**Estimated Time:**
- Phase 1: 2 hours
- Phase 2: 1.5 hours
- Phase 3: 3 hours
- Phase 4: 3 hours
- Phase 5: 3 hours
- Phase 6: 2 hours
- **Total:** ~14.5 hours

