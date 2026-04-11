import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import type { PermitForm, PermitFormInsert, PermitFormUpdate } from '../api/permitForms.api';
import { createPermitForm, deletePermitForm, getPermitForm, listPermitForms, updatePermitForm } from '../api/permitForms.api';

export const permitFormsKeys = {
  all: ['permitForms'] as const,
  list: (organizationId: string, search: string | undefined) =>
    ['permitForms', 'list', organizationId, search ?? ''] as const,
  detail: (id: string, organizationId: string) => ['permitForms', 'detail', id, organizationId] as const,
};

export function usePermitForms(search?: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? permitFormsKeys.list(organizationId, search)
      : ['permitForms', 'list', 'disabled', search],
    queryFn: () => listPermitForms(organizationId!, search),
    enabled: !!organizationId,
  });
}

export function usePermitForm(id: string | null | undefined) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      id && organizationId
        ? permitFormsKeys.detail(id, organizationId)
        : ['permitForms', 'detail', 'disabled', id],
    queryFn: () => getPermitForm(id!, organizationId!),
    enabled: !!id && !!organizationId,
  });
}

export function useCreatePermitForm() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: (payload: PermitFormInsert) => {
      if (!organizationId) throw new Error('No organization selected');
      return createPermitForm(payload, organizationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permitFormsKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: permitFormsKeys.list(organizationId, undefined) });
      }
    },
  });
}

export function useUpdatePermitForm() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: PermitFormUpdate }) =>
      updatePermitForm(id, updates),
    onSuccess: (data: PermitForm) => {
      queryClient.invalidateQueries({ queryKey: permitFormsKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: permitFormsKeys.list(organizationId, undefined) });
        queryClient.setQueryData(permitFormsKeys.detail(data.id, organizationId), data);
      }
    },
  });
}

export function useDeletePermitForm() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: (id: string) => deletePermitForm(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permitFormsKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: permitFormsKeys.list(organizationId, undefined) });
      }
    },
  });
}
