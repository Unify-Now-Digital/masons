import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPresetsByModule,
  createPreset,
  updatePreset,
  deletePreset,
  setDefaultPreset,
} from '../api/tableViewPresets.api';
import type {
  TableViewPreset,
  TableViewPresetInsert,
  TableViewPresetUpdate,
} from '../types/tableViewPresets.types';

export function usePresetsByModule(module: string, organizationId: string | null) {
  return useQuery({
    queryKey: ['table_view_presets', module, organizationId],
    queryFn: () => fetchPresetsByModule(module, organizationId as string),
    enabled: !!organizationId,
  });
}

export function useCreatePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preset: TableViewPresetInsert) => createPreset(preset),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['table_view_presets', data.module] });
    },
  });
}

export function useUpdatePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<TableViewPresetUpdate> }) =>
      updatePreset(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['table_view_presets', data.module] });
    },
  });
}

export function useDeletePreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePreset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['table_view_presets'] });
    },
  });
}

export function useSetDefaultPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ module, presetId, organizationId }: { module: string; presetId: string; organizationId: string }) =>
      setDefaultPreset(module, presetId, organizationId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['table_view_presets', data.module] });
    },
  });
}