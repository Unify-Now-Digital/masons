import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchJobOrderFigures } from '../api/jobsPipeline.api';
import { fetchClosedThisMonth, fetchPipelineSignals } from '../api/pipelineSignals.api';
import { BEFORE_PAID_STAGES } from '../types/jobsPipeline.types';
import { buildOpportunity, forecast, todayList, type Opportunity } from '../utils/opportunities';
import { useJobsPipeline } from './useJobsPipeline';
import { isTestDeal } from '../utils/testDeals';

export function useOpportunities() {
  const { organizationId, isOrgAdmin, canViewFinancials } = useOrganization();
  const pipe = useJobsPipeline();
  const jobs = useMemo(() => BEFORE_PAID_STAGES.flatMap((s) => pipe.columns[s]).filter((j) => !isTestDeal(j)), [pipe.columns]);
  const ids = jobs.map((j) => j.id).sort().join(',');
  const signals = useQuery({
    queryKey: ['jobsPipeline', 'signals', organizationId, ids],
    queryFn: () => fetchPipelineSignals(organizationId!, jobs, canViewFinancials),
    enabled: !!organizationId && !pipe.isLoading,
    staleTime: 60_000,
  });
  const closed = useQuery({
    queryKey: ['jobsPipeline', 'closedMtd', organizationId],
    queryFn: () => fetchClosedThisMonth(organizationId!),
    enabled: !!organizationId && canViewFinancials,
  });
  const figures = useQuery({
    queryKey: ['jobsPipeline', 'orderFigures', organizationId, canViewFinancials],
    queryFn: () => fetchJobOrderFigures(organizationId!, canViewFinancials),
    enabled: !!organizationId && canViewFinancials,
    staleTime: 60_000,
  });
  return useMemo(() => {
    const now = new Date();
    const opps: Opportunity[] = signals.data
      ? jobs.map((job) =>
          buildOpportunity({
            job,
            inv: pipe.invoiceSummaries.get(job.id),
            order: figures.data?.get(job.id) ?? null,
            contact: signals.data.contacts.get(job.id) ?? { lastIn: null, lastOut: null },
            quote: signals.data.quotes.get(job.id) ?? null,
          }, now))
      : [];
    return {
      isLoading: pipe.isLoading,
      listLoading: !!organizationId && !pipe.isLoading && signals.isPending && !signals.data,
      isError: pipe.isError || signals.isError,
      opps,
      today: todayList(opps),
      forecast: canViewFinancials && closed.data ? forecast(opps, closed.data, now) : null,
      isOrgAdmin,
    };
  }, [jobs, pipe.invoiceSummaries, pipe.isLoading, pipe.isError, signals.data, signals.isPending, signals.isError, figures.data, closed.data, isOrgAdmin, canViewFinancials, organizationId]);
}
