# Implementation Plan: Orders + Invoices Customizable Columns + Shared Presets

## Feature Overview

Add column customization to Orders and Invoices modules with shared presets stored in Supabase. Users can toggle column visibility, reorder columns via drag-and-drop, resize column widths, and save/load presets that are shared across all users.

**Branch:** `feature/orders-invoices-customizable-columns`  
**Spec File:** `specs/orders-invoices-customizable-columns.md`

---

## Technical Context

### Current State
- Orders module uses `SortableOrdersTable` (custom table with hardcoded columns)
- Invoices module uses shadcn/ui `Table` (custom table with hardcoded columns)
- No TanStack React Table detected
- Columns are statically defined with no customization
- No column state management or persistence

### Key Files
- `src/modules/orders/components/SortableOrdersTable.tsx` - Orders table component
- `src/modules/orders/pages/OrdersPage.tsx` - Orders page
- `src/modules/invoicing/pages/InvoicingPage.tsx` - Invoices page with table
- New shared components for column management

### Constraints
- Additive-only migrations
- Shared presets (not user-specific)
- Per-module presets (Orders separate from Invoices)
- Backward compatible (default columns work without presets)
- No breaking changes to existing table functionality

---

## Implementation Phases

### Phase 1: Database + Data Access

**Goal:** Create database schema and API layer for storing and managing presets.

#### Task 1.1: Create Migration for `table_view_presets`
**File:** `supabase/migrations/YYYYMMDDHHmmss_create_table_view_presets.sql`

**Implementation:**
- Create table with columns: id, module, name, config (jsonb), is_default, timestamps
- Add unique constraint on (module, name)
- Add partial unique index to ensure only one default per module
- Add index on module for querying
- Enable RLS with authenticated user policies
- Add updated_at trigger

**Success Criteria:**
- Migration runs successfully
- Table created with all constraints
- RLS policies allow authenticated users full access
- Partial unique index prevents multiple defaults per module

#### Task 1.2: Create API Functions
**File:** `src/shared/tableViewPresets/api/tableViewPresets.api.ts`

**Functions:**
- `fetchPresetsByModule(module)` - Get all presets for a module
- `createPreset(module, name, config, isDefault)` - Create new preset
- `updatePreset(id, updates)` - Update preset (name, config, isDefault)
- `deletePreset(id)` - Delete preset
- `setDefaultPreset(module, presetId)` - Set default preset (handles unsetting previous default)

**Success Criteria:**
- All functions work correctly
- Error handling for edge cases
- setDefaultPreset ensures only one default per module

#### Task 1.3: Create React Query Hooks
**File:** `src/shared/tableViewPresets/hooks/useTableViewPresets.ts`

**Hooks:**
- `usePresetsByModule(module)` - Fetch presets with caching
- `useCreatePreset()` - Create preset mutation
- `useUpdatePreset()` - Update preset mutation
- `useDeletePreset()` - Delete preset mutation
- `useSetDefaultPreset()` - Set default preset mutation

**Success Criteria:**
- Hooks cache by module
- Mutations invalidate appropriate queries
- Error handling and loading states

---

### Phase 2: Column State Model + Utilities

**Goal:** Define column state structure, default configurations, and utility functions.

#### Task 2.1: Define Types and Zod Schema
**File:** `src/shared/tableViewPresets/types/tableViewPresets.types.ts`

**Types:**
```typescript
interface PresetConfig {
  version: number;
  columns: {
    visibility: Record<string, boolean>;
    order: string[];
    widths: Record<string, number>;
  };
}

interface ColumnState {
  visibility: Record<string, boolean>;
  order: string[];
  widths: Record<string, number>;
}
```

**Zod Schema:**
- Validate preset config structure
- Version checking for future migrations

**Success Criteria:**
- Types match JSONB structure
- Zod schema validates correctly
- Version field allows future schema evolution

#### Task 2.2: Create Default Column Configurations
**File:** `src/shared/tableViewPresets/config/defaultColumns.ts`

**Default Configs:**
- Orders default: Extract from current `SortableOrdersTable` columns
  - Column IDs: `id`, `customer`, `deceasedName`, `type`, `stoneStatus`, `progress`, `depositDate`, `installationDate`, `dueDate`, `value`, `messages`
  - Default order and widths based on current implementation
- Invoices default: Extract from current `InvoicingPage` table
  - Column IDs: `expand`, `invoiceNumber`, `customer`, `amount`, `status`, `dueDate`, `paymentMethod`, `actions`
  - Default order and widths based on current implementation

**Success Criteria:**
- Default configs match current table layouts
- Column IDs are stable and documented
- Default widths are reasonable

#### Task 2.3: Create Utility Functions
**File:** `src/shared/tableViewPresets/utils/columnState.ts`

**Functions:**
- `normalizeConfig(config, availableColumns)` - Handle new/removed columns safely
- `applyPresetToState(presetConfig, defaultState)` - Convert preset to state
- `extractStateToConfig(state)` - Convert state to preset config JSON
- `getDefaultState(module)` - Get default state for module

**Success Criteria:**
- Utilities handle edge cases (missing columns, new columns)
- State conversion is bidirectional
- Normalization prevents errors from stale presets

---

### Phase 3: Columns UI (Dialog) + Preset Management

**Goal:** Create reusable ColumnsDialog component with DnD reordering and preset management.

#### Task 3.1: Install DnD Kit
**Command:** `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

**Success Criteria:**
- Dependencies installed
- No version conflicts

#### Task 3.2: Create ColumnsDialog Component
**File:** `src/shared/tableViewPresets/components/ColumnsDialog.tsx`

**Structure:**
- Dialog component with Tabs
- "Columns" tab and "Presets" tab
- Props: `module`, `open`, `onOpenChange`, `columnState`, `onColumnStateChange`, `availableColumns`

**Success Criteria:**
- Dialog opens/closes correctly
- Tabs switch correctly
- Props interface is clear

#### Task 3.3: Create ColumnsTab Component
**File:** `src/shared/tableViewPresets/components/ColumnsTab.tsx`

**Features:**
- DnD list of columns with drag handles
- Checkbox for visibility toggle
- Column name display
- Optional width preview
- Reset to default button

**Success Criteria:**
- Drag-and-drop works smoothly
- Visibility toggles update state
- Reset button restores defaults

#### Task 3.4: Create PresetsTab Component
**File:** `src/shared/tableViewPresets/components/PresetsTab.tsx`

**Features:**
- List of presets with name and default badge
- Apply preset button
- Save current as preset (name input dialog)
- Overwrite preset (with confirmation)
- Rename preset
- Delete preset (with confirmation)
- Set as default preset

**Success Criteria:**
- All preset operations work correctly
- Confirmations prevent accidental actions
- Default badge shows correctly

---

### Phase 4: Orders Table Integration

**Goal:** Integrate column customization into SortableOrdersTable.

#### Task 4.1: Refactor Columns to Definition Array
**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Changes:**
- Extract columns into definition array
- Each column: `{ id, label, defaultWidth, render }`
- Maintain current column functionality

**Success Criteria:**
- Columns still render correctly
- No visual changes
- Column definitions are reusable

#### Task 4.2: Add Column State Management
**File:** `src/modules/orders/pages/OrdersPage.tsx`

**State:**
- `columnVisibility: Record<string, boolean>`
- `columnOrder: string[]`
- `columnWidths: Record<string, number>`

**Load Default Preset:**
- On mount, fetch presets for 'orders'
- If default preset exists, apply it
- Otherwise use default column configuration

**Success Criteria:**
- State manages column configuration
- Default preset applies on load
- Falls back to defaults if no preset

#### Task 4.3: Apply Column State to Table
**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Changes:**
- Filter columns by visibility
- Reorder columns by columnOrder
- Apply widths via inline styles
- Pass column state as props

**Success Criteria:**
- Table respects visibility, order, and widths
- No layout breaks
- Existing sorting still works

#### Task 4.4: Implement Column Resizing
**File:** `src/modules/orders/components/SortableOrdersTable.tsx`

**Implementation:**
- Add resizer div to each column header
- Handle mousedown, mousemove, mouseup events
- Update width state on resize end
- Apply inline styles: `style={{ width: width, minWidth: width }}`

**Success Criteria:**
- Resizing works smoothly
- Widths persist in state
- No layout glitches during resize

#### Task 4.5: Add Columns Button
**File:** `src/modules/orders/pages/OrdersPage.tsx`

**Changes:**
- Add "Columns" button to toolbar
- Opens ColumnsDialog with module='orders'
- Passes column state and handlers

**Success Criteria:**
- Button is visible and accessible
- Dialog opens correctly
- State updates reflect in table

---

### Phase 5: Invoices Table Integration

**Goal:** Integrate column customization into InvoicingPage table.

#### Task 5.1: Refactor Columns to Definition Array
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Changes:**
- Extract columns into definition array
- Each column: `{ id, label, defaultWidth, render }`
- Maintain current column functionality

**Success Criteria:**
- Columns still render correctly
- No visual changes
- Column definitions are reusable

#### Task 5.2: Add Column State Management
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**State:**
- `columnVisibility: Record<string, boolean>`
- `columnOrder: string[]`
- `columnWidths: Record<string, number>`

**Load Default Preset:**
- On mount, fetch presets for 'invoices'
- If default preset exists, apply it
- Otherwise use default column configuration

**Success Criteria:**
- State manages column configuration
- Default preset applies on load
- Falls back to defaults if no preset

#### Task 5.3: Apply Column State to Table
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Changes:**
- Filter columns by visibility
- Reorder columns by columnOrder
- Apply widths via inline styles

**Success Criteria:**
- Table respects visibility, order, and widths
- No layout breaks
- Existing sort/search still works

#### Task 5.4: Implement Column Resizing
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Implementation:**
- Add resizer div to each column header
- Handle mousedown, mousemove, mouseup events
- Update width state on resize end
- Apply inline styles

**Success Criteria:**
- Resizing works smoothly
- Widths persist in state
- No layout glitches

#### Task 5.5: Add Columns Button
**File:** `src/modules/invoicing/pages/InvoicingPage.tsx`

**Changes:**
- Add "Columns" button to toolbar
- Opens ColumnsDialog with module='invoices'
- Passes column state and handlers

**Success Criteria:**
- Button is visible and accessible
- Dialog opens correctly
- State updates reflect in table

---

### Phase 6: Testing & Validation

**Goal:** Verify all functionality works correctly and no regressions.

#### Task 6.1: Test Orders Column Customization
- Toggle columns on/off
- Reorder via DnD
- Resize columns
- Save preset
- Apply preset
- Set default preset
- Reset to defaults

**Success Criteria:**
- All operations work correctly
- State persists during session
- Presets save and load correctly

#### Task 6.2: Test Invoices Column Customization
- Same tests as Orders
- Verify module isolation

**Success Criteria:**
- All operations work correctly
- Invoices presets don't affect Orders

#### Task 6.3: Test Module Isolation
- Create Orders preset
- Create Invoices preset
- Verify they don't interfere

**Success Criteria:**
- Presets are isolated per module
- No cross-module contamination

#### Task 6.4: Test Backward Compatibility
- Load page with no presets
- Verify defaults work
- Load preset with unknown columns
- Verify normalization works

**Success Criteria:**
- Defaults work without presets
- Stale presets don't break table
- Normalization handles edge cases

#### Task 6.5: Build & Lint Validation
**Commands:**
```bash
npm run build
npm run lint
```

**Success Criteria:**
- Build passes without errors
- Lint passes without errors
- No TypeScript errors

---

## Progress Tracking

- [ ] Phase 1: Database + Data Access
  - [ ] Task 1.1: Create Migration
  - [ ] Task 1.2: Create API Functions
  - [ ] Task 1.3: Create React Query Hooks
- [ ] Phase 2: Column State Model + Utilities
  - [ ] Task 2.1: Define Types and Zod Schema
  - [ ] Task 2.2: Create Default Configurations
  - [ ] Task 2.3: Create Utility Functions
- [ ] Phase 3: Columns UI + Preset Management
  - [ ] Task 3.1: Install DnD Kit
  - [ ] Task 3.2: Create ColumnsDialog
  - [ ] Task 3.3: Create ColumnsTab
  - [ ] Task 3.4: Create PresetsTab
- [ ] Phase 4: Orders Table Integration
  - [ ] Task 4.1: Refactor Columns to Definition Array
  - [ ] Task 4.2: Add Column State Management
  - [ ] Task 4.3: Apply Column State to Table
  - [ ] Task 4.4: Implement Column Resizing
  - [ ] Task 4.5: Add Columns Button
- [ ] Phase 5: Invoices Table Integration
  - [ ] Task 5.1: Refactor Columns to Definition Array
  - [ ] Task 5.2: Add Column State Management
  - [ ] Task 5.3: Apply Column State to Table
  - [ ] Task 5.4: Implement Column Resizing
  - [ ] Task 5.5: Add Columns Button
- [ ] Phase 6: Testing & Validation
  - [ ] Task 6.1: Test Orders
  - [ ] Task 6.2: Test Invoices
  - [ ] Task 6.3: Test Module Isolation
  - [ ] Task 6.4: Test Backward Compatibility
  - [ ] Task 6.5: Build & Lint

---

## Deliverables

1. **Database Migration:** `table_view_presets` table with RLS
2. **API Layer:** Presets API functions and React Query hooks
3. **Column State Utilities:** Types, defaults, and helper functions
4. **UI Components:** ColumnsDialog, ColumnsTab, PresetsTab
5. **Table Integration:** Orders and Invoices tables with column customization
6. **Documentation:** Column IDs and default configurations

---

## Risk Mitigation

### Risk: Breaking Existing Tables
**Mitigation:** Refactor columns gradually, maintain backward compatibility, test thoroughly

### Risk: DnD Library Conflicts
**Mitigation:** Check for existing DnD libraries, use @dnd-kit (modern, lightweight)

### Risk: Preset Config Versioning
**Mitigation:** Include version field, normalize function handles version differences

### Risk: Column ID Mismatches
**Mitigation:** Document column IDs, use constants, validate in utilities

---

## Notes

- Column IDs must be stable and match between table rendering and preset config
- Default preset auto-applies on page load if exists
- Reset to default restores default configuration (doesn't delete presets)
- Presets are shared (all authenticated users see same presets)
- Module isolation ensures Orders and Invoices presets don't interfere

