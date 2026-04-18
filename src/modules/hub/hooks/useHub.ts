import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  fetchHubSummary,
  fetchHubPipeline,
  fetchHubKpis,
  fetchHubAtRisk,
  fetchHubRecentPayments,
} from '../api/hub.api';

const hubKeys = {
  summary: (orgId: string) => ['hub', 'summary', orgId] as const,
  pipeline: (orgId: string) => ['hub', 'pipeline', orgId] as const,
  kpis: (orgId: string) => ['hub', 'kpis', orgId] as const,
  atRisk: (orgId: string) => ['hub', 'at-risk', orgId] as const,
  recentPayments: (orgId: string) => ['hub', 'recent-payments', orgId] as const,
};

export function useHubSummary() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? hubKeys.summary(organizationId) : ['hub', 'summary', 'disabled'],
    queryFn: () => fetchHubSummary(organizationId!),
    enabled: !!organizationId,
  });
}

export function useHubPipeline() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? hubKeys.pipeline(organizationId) : ['hub', 'pipeline', 'disabled'],
    queryFn: () => fetchHubPipeline(organizationId!),
    enabled: !!organizationId,
  });
}

export function useHubKpis() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? hubKeys.kpis(organizationId) : ['hub', 'kpis', 'disabled'],
    queryFn: () => fetchHubKpis(organizationId!),
    enabled: !!organizationId,
  });
}

export function useHubAtRisk() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? hubKeys.atRisk(organizationId) : ['hub', 'at-risk', 'disabled'],
    queryFn: () => fetchHubAtRisk(organizationId!),
    enabled: !!organizationId,
  });
}

export function useHubRecentPayments() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId ? hubKeys.recentPayments(organizationId) : ['hub', 'recent-payments', 'disabled'],
    queryFn: () => fetchHubRecentPayments(organizationId!),
    enabled: !!organizationId,
  });
}
