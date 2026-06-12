import { supabase } from '@/shared/lib/supabase';
import type {
  TableViewPreset,
  TableViewPresetInsert,
  TableViewPresetUpdate,
} from '../types/tableViewPresets.types';

/**
 * Fetch all presets for a specific module, scoped to an organization
 */
export async function fetchPresetsByModule(
  module: string,
  organizationId: string
): Promise<TableViewPreset[]> {
  const { data, error } = await supabase
    .from('table_view_presets')
    .select('*')
    .eq('module', module)
    .eq('organization_id', organizationId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as TableViewPreset[];
}

/**
 * Create a new preset (organization_id must be present on the payload)
 */
export async function createPreset(preset: TableViewPresetInsert): Promise<TableViewPreset> {
  if (!preset.organization_id) {
    throw new Error('organization_id is required to create a preset');
  }

  // If setting as default, unset current default first (scoped to this org)
  if (preset.is_default) {
    const { error: unsetError } = await supabase
      .from('table_view_presets')
      .update({ is_default: false })
      .eq('module', preset.module)
      .eq('organization_id', preset.organization_id)
      .eq('is_default', true);

    if (unsetError && unsetError.code !== 'PGRST116') {
      console.warn('Error unsetting previous default:', unsetError);
    }
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

/**
 * Update an existing preset
 */
export async function updatePreset(
  id: string,
  updates: Partial<TableViewPresetUpdate>
): Promise<TableViewPreset> {
  // If setting as default, unset current default first
  if (updates.is_default === true) {
    // Get module AND organization_id so the unset is org-scoped
    const { data: preset } = await supabase
      .from('table_view_presets')
      .select('module, organization_id')
      .eq('id', id)
      .single();

    if (preset) {
      const { error: unsetError } = await supabase
        .from('table_view_presets')
        .update({ is_default: false })
        .eq('module', preset.module)
        .eq('organization_id', preset.organization_id)
        .eq('is_default', true)
        .neq('id', id);

      if (unsetError && unsetError.code !== 'PGRST116') {
        console.warn('Error unsetting previous default:', unsetError);
      }
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

/**
 * Delete a preset
 */
export async function deletePreset(id: string): Promise<void> {
  const { error } = await supabase
    .from('table_view_presets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Set a preset as the default for a module within an organization
 */
export async function setDefaultPreset(
  module: string,
  presetId: string,
  organizationId: string
): Promise<TableViewPreset> {
  // Unset current default (scoped to this org)
  const { error: unsetError } = await supabase
    .from('table_view_presets')
    .update({ is_default: false })
    .eq('module', module)
    .eq('organization_id', organizationId)
    .eq('is_default', true);

  if (unsetError && unsetError.code !== 'PGRST116') {
    console.warn('Error unsetting previous default:', unsetError);
  }

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