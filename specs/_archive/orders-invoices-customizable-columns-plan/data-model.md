# Data Model: Orders + Invoices Customizable Columns

## Database Schema

### Table: `table_view_presets`

**Purpose:** Store shared column configuration presets for Orders and Invoices modules.

**Structure:**
```sql
create table public.table_view_presets (
  id uuid primary key default gen_random_uuid(),
  module text not null,  -- 'orders' | 'invoices'
  name text not null,
  config jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint unique_module_name unique (module, name)
);
```

**Indexes:**
- Primary key: `id`
- Unique: `(module, name)` - Prevents duplicate preset names per module
- Partial unique: `(module) where is_default = true` - Ensures only one default per module
- Index: `module` - For querying presets by module

**RLS Policies:**
- SELECT: Authenticated users can view all presets
- INSERT: Authenticated users can create presets
- UPDATE: Authenticated users can update presets
- DELETE: Authenticated users can delete presets

**Triggers:**
- `update_table_view_presets_updated_at` - Updates `updated_at` on row modification

## Preset Config Schema (JSONB)

### Structure

```typescript
interface PresetConfig {
  version: number;  // Schema version (currently 1)
  columns: {
    visibility: Record<string, boolean>;  // Column ID → visible
    order: string[];  // Ordered list of column IDs
    widths: Record<string, number>;  // Column ID → width in pixels
  };
}
```

### Example Config

**Orders Preset:**
```json
{
  "version": 1,
  "columns": {
    "visibility": {
      "id": true,
      "customer": true,
      "deceasedName": false,
      "type": true,
      "stoneStatus": true,
      "progress": true,
      "depositDate": false,
      "installationDate": true,
      "dueDate": true,
      "value": true,
      "messages": true
    },
    "order": [
      "id",
      "customer",
      "type",
      "stoneStatus",
      "progress",
      "installationDate",
      "dueDate",
      "value",
      "messages"
    ],
    "widths": {
      "id": 120,
      "customer": 180,
      "type": 150,
      "stoneStatus": 100,
      "progress": 80,
      "installationDate": 120,
      "dueDate": 120,
      "value": 100,
      "messages": 80
    }
  }
}
```

**Invoices Preset:**
```json
{
  "version": 1,
  "columns": {
    "visibility": {
      "expand": true,
      "invoiceNumber": true,
      "customer": true,
      "amount": true,
      "status": true,
      "dueDate": true,
      "paymentMethod": false,
      "actions": true
    },
    "order": [
      "expand",
      "invoiceNumber",
      "customer",
      "amount",
      "status",
      "dueDate",
      "actions"
    ],
    "widths": {
      "expand": 50,
      "invoiceNumber": 150,
      "customer": 180,
      "amount": 120,
      "status": 100,
      "dueDate": 120,
      "actions": 120
    }
  }
}
```

## Column State Model

### TypeScript Interface

```typescript
interface ColumnState {
  visibility: Record<string, boolean>;
  order: string[];
  widths: Record<string, number>;
}
```

### State Flow

1. **Initial State:**
   - Load default preset if exists
   - Otherwise use default column configuration
   - State stored in page component

2. **User Changes:**
   - Toggle visibility → update `visibility` map
   - Reorder columns → update `order` array
   - Resize column → update `widths` map
   - State updates trigger table re-render

3. **Save Preset:**
   - Extract state to `PresetConfig` format
   - Save to Supabase via API
   - Preset appears in list

4. **Apply Preset:**
   - Load preset config from Supabase
   - Convert to `ColumnState`
   - Update component state
   - Table re-renders with new configuration

## Column Definitions

### Orders Column Definitions

```typescript
const ordersColumns = [
  { id: 'id', label: 'ID', defaultWidth: 120 },
  { id: 'customer', label: 'Customer', defaultWidth: 180 },
  { id: 'deceasedName', label: 'Deceased Name', defaultWidth: 150 },
  { id: 'type', label: 'Type', defaultWidth: 150 },
  { id: 'stoneStatus', label: 'Stone Status', defaultWidth: 120 },
  { id: 'progress', label: 'Progress', defaultWidth: 80 },
  { id: 'depositDate', label: 'Deposit Date', defaultWidth: 120 },
  { id: 'installationDate', label: 'Installation Date', defaultWidth: 140 },
  { id: 'dueDate', label: 'Due Date', defaultWidth: 120 },
  { id: 'value', label: 'Value', defaultWidth: 100 },
  { id: 'messages', label: 'Messages', defaultWidth: 80 },
];
```

### Invoices Column Definitions

```typescript
const invoicesColumns = [
  { id: 'expand', label: '', defaultWidth: 50 },
  { id: 'invoiceNumber', label: 'Invoice Number', defaultWidth: 150 },
  { id: 'customer', label: 'Customer', defaultWidth: 180 },
  { id: 'amount', label: 'Amount', defaultWidth: 120 },
  { id: 'status', label: 'Status', defaultWidth: 100 },
  { id: 'dueDate', label: 'Due Date', defaultWidth: 120 },
  { id: 'paymentMethod', label: 'Payment Method', defaultWidth: 150 },
  { id: 'actions', label: 'Actions', defaultWidth: 120 },
];
```

## Data Relationships

### Module → Presets (One-to-Many)

```
module ('orders' | 'invoices')
  ↓
table_view_presets (many)
  - Each preset belongs to one module
  - Multiple presets per module
  - One default preset per module
```

### Preset → Config (One-to-One)

```
table_view_presets
  ↓
config (jsonb)
  - Each preset has one config
  - Config contains column state
```

## Query Patterns

### Fetch Presets by Module

```typescript
const { data: presets } = await supabase
  .from('table_view_presets')
  .select('*')
  .eq('module', 'orders')
  .order('is_default', { ascending: false })
  .order('name', { ascending: true });
```

### Get Default Preset

```typescript
const { data: defaultPreset } = await supabase
  .from('table_view_presets')
  .select('*')
  .eq('module', 'orders')
  .eq('is_default', true)
  .single();
```

### Set Default Preset

```typescript
// 1. Unset current default
await supabase
  .from('table_view_presets')
  .update({ is_default: false })
  .eq('module', 'orders')
  .eq('is_default', true);

// 2. Set new default
await supabase
  .from('table_view_presets')
  .update({ is_default: true })
  .eq('id', presetId);
```

## Constraints and Validation

### Database Constraints
- `unique(module, name)` - Prevents duplicate preset names per module
- Partial unique index on `(module) where is_default = true` - Ensures only one default per module

### Application Validation
- Zod schema validates preset config structure
- Normalize function handles version differences
- Column ID validation against available columns

## Edge Cases

### Missing Columns in Preset
- Normalize function adds missing columns with defaults
- Visibility defaults to true
- Width defaults to column's defaultWidth
- Order places new columns at end

### Removed Columns in Preset
- Normalize function removes deleted columns
- Preset config stays valid
- No errors when applying preset

### Multiple Defaults (Race Condition)
- Partial unique index prevents at database level
- Application code handles unsetting previous default
- Transaction ensures atomicity

### Empty Preset Config
- Default to all columns visible
- Use default order
- Use default widths

