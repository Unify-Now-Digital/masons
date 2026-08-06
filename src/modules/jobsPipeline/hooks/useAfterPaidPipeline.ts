import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchAfterPaidJobs, fetchJobInvoiceSummaries } from '../api/jobsPipeline.api';
import { jobsPipelineKeys } from '../api/jobsPipelineKeys';
import {
  AFTER_PAID_STAGES,
  type AfterPaidStage,
  type JobInvoiceSummary,
  type PipelineJob,
} from '../types/jobsPipeline.types';

export interface AfterPaidPipelineViewModel {
  columns: Record<AfterPaidStage, PipelineJob[]>;
  invoiceSummaries: Map<string, JobInvoiceSummary>;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

const emptyColumns = (): Record<AfterPaidStage, PipelineJob[]> => ({
  confirmed: [],
  in_production: [],
  fixed: [],
  complete: [],
});

export function useAfterPaidPipeline(): AfterPaidPipelineViewModel {
  const { organizationId } = useOrganization();

  const jobsQuery = useQuery({
    queryKey: jobsPipelineKeys.afterPaid(organizationId),
    queryFn: () => fetchAfterPaidJobs(organizationId!),
    enabled: !!organizationId,
  });

  // Same key as the before board — one cache entry serves both.
  const invoicesQuery = useQuery({
    queryKey: jobsPipelineKeys.invoiceSummaries(organizationId),
    queryFn: () => fetchJobInvoiceSummaries(organizationId!),
    enabled: !!organizationId,
  });

  const columns = useMemo(() => {
    const grouped = emptyColumns();
    for (const job of jobsQuery.data ?? []) {
      // The query filters on the same stage list, so every fetched row lands in a bucket.
      if ((AFTER_PAID_STAGES as readonly string[]).includes(job.stage)) {
        grouped[job.stage as AfterPaidStage].push(job);
      }
    }
    return grouped;
  }, [jobsQuery.data]);

  return {
    columns,
    invoiceSummaries: invoicesQuery.data ?? new Map(),
    isLoading: jobsQuery.isLoading || invoicesQuery.isLoading,
    isError: jobsQuery.isError,
    error: jobsQuery.error,
  };
}
