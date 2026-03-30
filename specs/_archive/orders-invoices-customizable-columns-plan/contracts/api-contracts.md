# API Contracts: Table View Presets

## Database Table

### `table_view_presets`

**Schema:**
```sql
create table public.table_view_presets (
  id uuid primary key,
  module text not null,  -- 'orders' | 'invoices'
  name text not null,
  config jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
```

**Constraints:**
- `unique(module, name)` - No duplicate names per module
- Partial unique: `(module) where is_default = true` - Only one default per module

---

## API Functions

### `fetchPresetsByModule(module: string): Promise<TableViewPreset[]>`

**Purpose:** Fetch all presets for a specific module.

**Parameters:**
- `module: string` - Module identifier ('orders' | 'invoices')

**Returns:**
- `Promise<TableViewPreset[]>` - Array of presets, ordered by default first, then name

**Implementation:**
```typescript
export async function fetchPresetsByModule(module: string) {
  const { data, error } = await supabase
    .from('table_view_presets')
    .select('*')
    .eq('module', module)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });
  
  if (error) throw error;
  return data as TableViewPreset[];
}
```

**Error Handling:**
- Throws Supabase errors
- Returns empty array if no presets found (not an error)

---

### `createPreset(preset: TableViewPresetInsert): Promise<TableViewPreset>`

**Purpose:** Create a new preset.

**Parameters:**
```typescript
interface TableViewPresetInsert {
  module: string;
  name: string;
  config: PresetConfig;
  is_default?: boolean;
}
```

**Returns:**
- `Promise<TableViewPreset>` - Created preset

**Implementation:**
```typescript
export async function createPreset(preset: TableViewPresetInsert) {
  // If setting as default, unset current default first
  if (preset.is_default) {
    await supabase
      .from('table_view_presets')
      .update({ is_default: false })
      .eq('module', preset.module)
      .eq('is_default', true);
  }
  
  const { data, error } = await supabase
    .from('table_view_presets')
    .insert({
      ...preset,
      is_default: preset.is_default ?? false,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as TableViewPreset;
}
```

**Error Handling:**
- Throws on duplicate name (unique constraint violation)
- Throws on Supabase errors

---

### `updatePreset(id: string, updates: Partial<TableViewPresetUpdate>): Promise<TableViewPreset>`

**Purpose:** Update an existing preset (name, config, or is_default).

**Parameters:**
- `id: string` - Preset ID
- `updates: Partial<TableViewPresetUpdate>` - Fields to update

**Returns:**
- `Promise<TableViewPreset>` - Updated preset

**Implementation:**
```typescript
export async function updatePreset(
  id: string,
  updates: Partial<TableViewPresetUpdate>
) {
  // If setting as default, unset current default first
  if (updates.is_default === true) {
    const { data: preset } = await supabase
      .from('table_view_presets')
      .select('module')
      .eq('id', id)
      .single();
    
    if (preset) {
      await supabase
        .from('table_view_presets')
        .update({ is_default: false })
        .eq('module', preset.module)
        .eq('is_default', true)
        .neq('id', id);
    }
  }
  
  const { data, error } = await supabase
    .from('table_view_presets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as TableViewPreset;
}
```

**Error Handling:**
- Throws if preset not found
- Throws on duplicate name (if updating name)
- Throws on Supabase errors

---

### `deletePreset(id: string): Promise<void>`

**Purpose:** Delete a preset.

**Parameters:**
- `id: string` - Preset ID

**Returns:**
- `Promise<void>`

**Implementation:**
```typescript
export async function deletePreset(id: string) {
  const { error } = await supabase
    .from('table_view_presets')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}
```

**Error Handling:**
- Throws if preset not found
- Throws on Supabase errors

---

### `setDefaultPreset(module: string, presetId: string): Promise<TableViewPreset>`

**Purpose:** Set a preset as the default for a module (ensures only one default).

**Parameters:**
- `module: string` - Module identifier
- `presetId: string` - Preset ID to set as default

**Returns:**
- `Promise<TableViewPreset>` - Updated preset

**Implementation:**
```typescript
export async function setDefaultPreset(module: string, presetId: string) {
  // Unset current default
  await supabase
    .from('table_view_presets')
    .update({ is_default: false })
    .eq('module', module)
    .eq('is_default', true);
  
  // Set new default
  const { data, error } = await supabase
    .from('table_view_presets')
    .update({ is_default: true })
    .eq('id', presetId)
    .select()
    .single();
  
  if (error) throw error;
  return data as TableViewPreset;
}
```

**Error Handling:**
- Throws if preset not found
- Throws if preset belongs to different module
- Throws on Supabase errors

---

## React Query Hooks

### `usePresetsByModule(module: string)`

**Purpose:** Fetch presets for a module with React Query caching.

**Signature:**
```typescript
export function usePresetsByModule(module: string) {
  return useQuery({
    queryKey: ['table_view_presets', module],
    queryFn: () => fetchPresetsByModule(module),
  });
}
```

**Returns:**
- `UseQueryResult<TableViewPreset[], Error>`

---

### `useCreatePreset()`

**Purpose:** Create preset mutation.

**Signature:**
```typescript
export function useCreatePreset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (preset: TableViewPresetInsert) => createPreset(preset),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['table_view_presets', data.module] 
      });
    },
  });
}
```

**Returns:**
- `UseMutationResult<TableViewPreset, Error, TableViewPresetInsert>`

---

### `useUpdatePreset()`

**Purpose:** Update preset mutation.

**Signature:**
```typescript
export function useUpdatePreset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<TableViewPresetUpdate> }) =>
      updatePreset(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['table_view_presets', data.module] 
      });
    },
  });
}
```

**Returns:**
- `UseMutationResult<TableViewPreset, Error, { id: string; updates: Partial<TableViewPresetUpdate> }>`

---

### `useDeletePreset()`

**Purpose:** Delete preset mutation.

**Signature:**
```typescript
export function useDeletePreset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deletePreset(id),
    onSuccess: (_, id) => {
      // Invalidate all module queries (we don't know which module)
      queryClient.invalidateQueries({ 
        queryKey: ['table_view_presets'] 
      });
    },
  });
}
```

**Returns:**
- `UseMutationResult<void, Error, string>`

---

### `useSetDefaultPreset()`

**Purpose:** Set default preset mutation.

**Signature:**
```typescript
export function useSetDefaultPreset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ module, presetId }: { module: string; presetId: string }) =>
      setDefaultPreset(module, presetId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['table_view_presets', data.module] 
      });
    },
  });
}
```

**Returns:**
- `UseMutationResult<TableViewPreset, Error, { module: string; presetId: string }>`

---

## Type Definitions

### `TableViewPreset`

```typescript
interface TableViewPreset {
  id: string;
  module: 'orders' | 'invoices';
  name: string;
  config: PresetConfig;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
```

### `TableViewPresetInsert`

```typescript
interface TableViewPresetInsert {
  module: 'orders' | 'invoices';
  name: string;
  config: PresetConfig;
  is_default?: boolean;
}
```

### `TableViewPresetUpdate`

```typescript
interface TableViewPresetUpdate {
  name?: string;
  config?: PresetConfig;
  is_default?: boolean;
}
```

### `PresetConfig`

```typescript
interface PresetConfig {
  version: number;
  columns: {
    visibility: Record<string, boolean>;
    order: string[];
    widths: Record<string, number>;
  };
}
```

---

## Error Handling

### Common Errors

1. **Duplicate Name:**
   - Error code: `23505` (unique violation)
   - Message: "Preset name already exists for this module"
   - Handling: Show user-friendly error, suggest different name

2. **Preset Not Found:**
   - Error code: `PGRST116`
   - Message: "Preset not found"
   - Handling: Show error, refresh preset list

3. **Multiple Defaults (Race Condition):**
   - Error code: `23505` (unique violation on partial index)
   - Message: "Another preset is already set as default"
   - Handling: Retry after fetching current default

---

## Caching Strategy

### Query Keys
- `['table_view_presets', module]` - All presets for a module
- Cache invalidated on create/update/delete/setDefault

### Cache Invalidation
- Create: Invalidate module query
- Update: Invalidate module query
- Delete: Invalidate all preset queries (module unknown)
- SetDefault: Invalidate module query

---

## Performance Considerations

### Query Optimization
- Index on `module` for fast filtering
- Order by `is_default DESC, name ASC` for consistent ordering
- Single query fetches all presets for module

### Mutation Optimization
- Batch unset default + set new default in single transaction (if possible)
- Invalidate only affected module queries

