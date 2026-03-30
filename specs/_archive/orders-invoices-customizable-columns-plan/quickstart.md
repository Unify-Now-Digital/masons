# Quick Start: Orders + Invoices Customizable Columns

## Overview

This feature adds column customization to Orders and Invoices tables, allowing users to:
- Toggle column visibility
- Reorder columns via drag-and-drop
- Resize column widths
- Save and load shared presets

## Key Concepts

### Column State
Each table maintains three pieces of state:
- **Visibility:** Which columns are shown/hidden
- **Order:** The order columns appear in
- **Widths:** The pixel width of each column

### Presets
Presets are saved column configurations stored in Supabase:
- **Shared:** All users see the same presets
- **Per-Module:** Orders and Invoices have separate presets
- **Default:** One preset per module can be set as default (auto-applies on load)

## Implementation Steps

### Step 1: Database Setup
1. Run migration to create `table_view_presets` table
2. Verify RLS policies are active
3. Test creating a preset manually

### Step 2: API Layer
1. Create API functions in `src/shared/tableViewPresets/api/`
2. Create React Query hooks in `src/shared/tableViewPresets/hooks/`
3. Test API functions with Supabase client

### Step 3: Column State Utilities
1. Define types in `src/shared/tableViewPresets/types/`
2. Create default configs in `src/shared/tableViewPresets/config/`
3. Create utility functions in `src/shared/tableViewPresets/utils/`

### Step 4: UI Components
1. Install `@dnd-kit` packages
2. Create `ColumnsDialog` component
3. Create `ColumnsTab` with DnD reordering
4. Create `PresetsTab` with preset management

### Step 5: Orders Integration
1. Refactor `SortableOrdersTable` columns to definition array
2. Add column state to `OrdersPage`
3. Apply state to table rendering
4. Add resizer handles
5. Add "Columns" button

### Step 6: Invoices Integration
1. Refactor `InvoicingPage` columns to definition array
2. Add column state
3. Apply state to table rendering
4. Add resizer handles
5. Add "Columns" button

## Column ID Reference

### Orders Column IDs
- `id` - Order ID
- `customer` - Customer name
- `deceasedName` - Deceased name
- `type` - Order type
- `stoneStatus` - Stone status
- `progress` - Progress percentage
- `depositDate` - Deposit date
- `installationDate` - Installation date
- `dueDate` - Due date
- `value` - Order value
- `messages` - Message count

### Invoices Column IDs
- `expand` - Expand/collapse button
- `invoiceNumber` - Invoice number
- `customer` - Customer name
- `amount` - Invoice amount
- `status` - Invoice status
- `dueDate` - Due date
- `paymentMethod` - Payment method
- `actions` - Action buttons

## Common Patterns

### Loading Default Preset
```typescript
const { data: presets } = usePresetsByModule('orders');
const defaultPreset = presets?.find(p => p.is_default);

useEffect(() => {
  if (defaultPreset) {
    const state = applyPresetToState(defaultPreset.config, getDefaultState('orders'));
    setColumnState(state);
  } else {
    setColumnState(getDefaultState('orders'));
  }
}, [defaultPreset]);
```

### Saving Current State as Preset
```typescript
const createPreset = useCreatePreset();

const handleSavePreset = (name: string) => {
  const config = extractStateToConfig(columnState);
  createPreset.mutate({
    module: 'orders',
    name,
    config,
    is_default: false,
  });
};
```

### Applying Column State to Table
```typescript
const visibleColumns = columnDefinitions
  .filter(col => columnState.visibility[col.id] !== false)
  .sort((a, b) => {
    const aIndex = columnState.order.indexOf(a.id);
    const bIndex = columnState.order.indexOf(b.id);
    return aIndex - bIndex;
  });

// Render columns with widths
visibleColumns.map(col => (
  <TableHead 
    key={col.id}
    style={{ width: columnState.widths[col.id] || col.defaultWidth }}
  >
    {col.label}
  </TableHead>
));
```

## Testing Checklist

- [ ] Create preset in Orders
- [ ] Apply preset in Orders
- [ ] Set default preset in Orders
- [ ] Verify default applies on page load
- [ ] Toggle column visibility
- [ ] Reorder columns via DnD
- [ ] Resize columns
- [ ] Reset to defaults
- [ ] Create preset in Invoices
- [ ] Verify module isolation
- [ ] Delete preset
- [ ] Rename preset

## Troubleshooting

### Preset Not Applying
- Check preset config structure matches expected format
- Verify column IDs match table column definitions
- Check normalize function handles missing columns

### DnD Not Working
- Verify @dnd-kit packages installed
- Check DndContext and SortableContext are set up correctly
- Verify drag handles are properly configured

### Column Resizing Not Working
- Check resizer handles are in correct position
- Verify mouse event handlers are attached
- Check width state updates correctly

### Default Preset Not Loading
- Verify default preset exists in database
- Check `is_default = true` for correct module
- Verify preset fetch query runs on page load

