import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchOrgConnectedHandles } from '../api/ownHandles.api';
import { buildOwnHandles, type OwnHandles } from '../utils/ownHandles';

export const ownHandlesKeys = {
  byOrg: (organizationId: string | null) => ['inbox', 'own-handles', organizationId] as const,
};

/**
 * The org's own handles. Until the query resolves, or if it fails, the connected
 * part is empty and only the static own domains apply — it can under-exclude,
 * never hide more.
 */
export function useOwnHandles(): { ownHandles: OwnHandles; isLoading: boolean } {
  const { organizationId } = useOrganization();
  const { data: connected, isLoading } = useQuery({
    queryKey: ownHandlesKeys.byOrg(organizationId),
    queryFn: () => fetchOrgConnectedHandles(organizationId!),
    enabled: !!organizationId,
  });
  const ownHandles = useMemo(() => buildOwnHandles(connected ?? []), [connected]);
  return { ownHandles, isLoading };
}
