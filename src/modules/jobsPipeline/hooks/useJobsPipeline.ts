import { dedupeBareJobs } from '../utils/dedupeJobs';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { fetchActiveJobs, fetchJobInvoiceSummaries } from '../api/jobsPipeline.api';
import { jobsPipelineKeys } from '../api/jobsPipelineKeys';
import {
  BEFORE_PAID_STAGES,
  type BeforePaidStage,
  type JobInvoiceSummary,
  type PipelineJob,
} from '../types/jobsPipeline.types';

export interface JobsPipelineViewModel {
  columns: Record<BeforePaidStage, PipelineJob[]>;
  invoiceSummaries: Map<string, JobInvoiceSummary>;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

const emptyColumns = (): Record<BeforePaidStage, PipelineJob[]> => ({
  enquired: [],
  quoted: [],
  invoiced: [],
});

export function useJobsPipeline(): JobsPipelineViewModel {
  const { organizationId, canViewFinancials } = useOrganization();

  const jobsQuery = useQuery({
    queryKey: jobsPipelineKeys.active(organizationId),
    queryFn: () => fetchActiveJobs(organizationId!),
    enabled: !!organizationId,
  });

  const invoicesQuery = useQuery({
    queryKey: jobsPipelineKeys.invoiceSummaries(organizationId),
    queryFn: () => fetchJobInvoiceSummaries(organizationId!),
    enabled: !!organizationId && canViewFinancials,
  });

  const columns = useMemo(() => {
    const grouped = emptyColumns();
    for (const job of jobsQuery.data ?? []) {
      // Post-paid stages with a null paid_at shouldn't exist; render only the three columns.
      if ((BEFORE_PAID_STAGES as readonly string[]).includes(job.stage)) {
        grouped[job.stage as BeforePaidStage].push(job);
      }
    }
    // QA 2026-10-14: duplicate intake rows (same person, same stage, no enquiry/quote) showed
    // as several identical cards. Keep the newest; jobs with their own enquiry stay separate.
    for (const stage of BEFORE_PAID_STAGES) grouped[stage] = dedupeBareJobs(grouped[stage]);
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

