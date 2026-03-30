# Research: Orders + Invoices Customizable Columns

## Problem Statement

Orders and Invoices modules currently have hardcoded table columns with no customization capabilities. Users cannot:
- Hide columns they don't need
- Reorder columns to match their workflow
- Resize columns for better visibility
- Save column configurations for reuse

## Current State Analysis

### Orders Module

**Component:** `SortableOrdersTable.tsx`

**Current Columns (from code analysis):**
- `id` - Order ID
- `customer` - Customer name (with popover)
- `deceasedName` - Deceased name
- `type` - Order type
- `stoneStatus` - Stone status
- `progress` - Progress percentage
- `depositDate` - Deposit date
- `installationDate` - Installation date
- `dueDate` - Due date
- `value` - Order value
- `messages` - Message count badge

**Current Implementation:**
- Columns hardcoded in component
- `columnOrder` state exists but is static
- No visibility or width management
- Table is sortable (separate from column customization)

### Invoices Module

**Component:** `InvoicingPage.tsx` (inline table)

**Current Columns (from code analysis):**
- `expand` - Expand/collapse button
- `invoiceNumber` - Invoice number
- `customer` - Customer name (with popover)
- `amount` - Invoice amount
- `status` - Invoice status
- `dueDate` - Due date
- `paymentMethod` - Payment method
- `actions` - Action buttons

**Current Implementation:**
- Columns hardcoded in JSX
- No column state management
- No customization capabilities

## Technical Decisions

### Table Implementation
- **Decision:** Custom tables (not TanStack React Table)
- **Implication:** Need to implement column state management manually
- **Approach:** State-driven column rendering with visibility/order/widths

### Drag-and-Drop Library
- **Decision:** Use `@dnd-kit` (modern, lightweight, accessible)
- **Rationale:** No existing DnD library detected, @dnd-kit is industry standard
- **Packages:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### Preset Storage
- **Decision:** Shared presets in Supabase (not user-specific)
- **Rationale:** Team collaboration, simpler implementation
- **Storage:** JSONB column in `table_view_presets` table

### Column Width Units
- **Decision:** Pixels (px) stored as numbers
- **Rationale:** Precise control, easy to apply via inline styles
- **Application:** `style={{ width: width, minWidth: width }}`

### Default Preset Enforcement
- **Decision:** Partial unique index on (module) where is_default = true
- **Rationale:** Database-level constraint ensures only one default per module
- **Application Code:** Handle unsetting previous default when setting new one

## Column ID Strategy

### Stable Identifiers
Column IDs must be:
- Stable (don't change when column labels change)
- Descriptive (match column purpose)
- Consistent (same ID used in table rendering and preset config)

### Orders Column IDs
- `id` - Order ID
- `customer` - Customer name
- `deceasedName` - Deceased name
- `type` - Order type
- `stoneStatus` - Stone status
- `progress` - Progress
- `depositDate` - Deposit date
- `installationDate` - Installation date
- `dueDate` - Due date
- `value` - Value
- `messages` - Messages

### Invoices Column IDs
- `expand` - Expand button
- `invoiceNumber` - Invoice number
- `customer` - Customer name
- `amount` - Amount
- `status` - Status
- `dueDate` - Due date
- `paymentMethod` - Payment method
- `actions` - Actions

## Preset Config Versioning

### Version 1 Schema
```json
{
  "version": 1,
  "columns": {
    "visibility": { "<colId>": true/false },
    "order": ["<colId>", ...],
    "widths": { "<colId>": <number> }
  }
}
```

### Future Considerations
- Version field allows schema evolution
- Normalize function handles version differences
- Default to version 1 for new presets

## Implementation Approach

### Column State Management
- State lives in page component (OrdersPage, InvoicingPage)
- State structure: `{ visibility, order, widths }`
- State updates trigger table re-render
- State can be extracted to preset config

### Column Resizing
- Resizer handle in column header (right edge)
- Mouse events: mousedown → mousemove → mouseup
- Update width state on mouseup (debounce during drag)
- Apply widths via inline styles on header and cells

### Drag-and-Drop Reordering
- Use @dnd-kit SortableContext
- Drag handle on each column item
- Visual feedback during drag
- Update order state on drop

### Preset Management
- Fetch presets on page load
- Apply default preset if exists
- Save current state as preset
- Apply preset updates table state immediately

## Edge Cases

### New Columns Added
- Normalize function adds new columns to preset with defaults
- New columns appear in preset config
- Visibility defaults to true for new columns

### Columns Removed
- Normalize function removes deleted columns from preset
- Preset config stays valid
- No errors from missing columns

### Stale Presets
- Normalize function handles missing columns
- Preset applies safely even if columns changed
- User can update preset to match current columns

### No Default Preset
- Page uses default column configuration
- User can still create and apply presets
- Reset button always works

## Performance Considerations

### State Updates
- Column state updates trigger table re-render
- Use React.useMemo for computed visible/ordered columns
- Debounce width updates during resize

### Preset Loading
- Fetch presets once on page load
- Cache presets by module in React Query
- Invalidate cache on preset mutations

### DnD Performance
- @dnd-kit is performant for small lists (< 20 items)
- Column lists are small (10-15 columns)
- No performance concerns expected

## Dependencies

### New Dependencies
- `@dnd-kit/core` - Core DnD functionality
- `@dnd-kit/sortable` - Sortable list support
- `@dnd-kit/utilities` - Helper utilities

### Existing Dependencies
- React Query (already in use)
- Supabase client (already in use)
- shadcn/ui components (already in use)

## Success Criteria

- Users can customize columns in Orders and Invoices
- Presets persist and apply correctly
- Module isolation works (Orders ≠ Invoices)
- Backward compatibility maintained
- No regressions in existing functionality

