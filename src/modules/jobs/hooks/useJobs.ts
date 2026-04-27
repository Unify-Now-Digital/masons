import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useTestDataMode } from '@/shared/context/TestDataContext';

export interface Job {
  id: string;
  order_id: string | null; // Legacy field, kept for backward compatibility
  customer_name: string; // Legacy field, kept for backward compatibility
  location_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  // Status: database-allowed values only
  status: 'scheduled' | 'in_progress' | 'ready_for_installation' | 'completed' | 'cancelled';
  scheduled_date: string | null;
  estimated_duration: string | null;
  priority: 'low' | 'medium' | 'high';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type JobInsert = Omit<Job, 'id' | 'created_at' | 'updated_at'>;
export type JobUpdate = Partial<JobInsert>;

export const jobsKeys = {
  all: ['jobs'] as const,
  list: (organizationId: string) => ['jobs', 'list', organizationId] as const,
  detail: (id: string, organizationId: string) => ['jobs', id, organizationId] as const,
};

async function fetchJobs(
  organizationId: string,
  options?: { workerIds?: string[]; excludeTest?: boolean }
) {
  let query = supabase
    .from('jobs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (options?.excludeTest) query = query.eq('is_test', false);

  // Filter by worker assignments if provided
  // Explicit guard: only filter if workerIds exist, is array, and has items
  if (options?.workerIds && Array.isArray(options.workerIds) && options.workerIds.length > 0) {
    // Get job IDs that have any of the specified workers assigned
    const { data: jobWorkers, error: jobWorkersError } = await supabase
      .from('job_workers')
      .select('job_id')
      .eq('organization_id', organizationId)
      .in('worker_id', options.workerIds);

    if (jobWorkersError) throw jobWorkersError;

    const jobIds = jobWorkers?.map(jw => jw.job_id) || [];
    if (jobIds.length > 0) {
      query = query.in('id', jobIds);
    } else {
      // No jobs found with these workers, return empty array
      return [] as Job[];
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  // Ensure always returns array (never undefined)
  return (data || []) as Job[];
}

async function fetchJob(id: string, organizationId: string) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single();
  
  if (error) throw error;
  return data as Job;
}

async function createJob(job: JobInsert, organizationId: string) {
  const { data, error } = await supabase
    .from('jobs')
    .insert({ ...job, organization_id: organizationId })
    .select()
    .single();
  
  if (error) {
    throw new Error(error.message || 'Failed to create job');
  }
  return data as Job;
}

async function updateJob(id: string, updates: JobUpdate) {
  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Job;
}

async function deleteJob(id: string) {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export function useJobsList(options?: { workerIds?: string[] }) {
  const { organizationId } = useOrganization();
  const { showTestData } = useTestDataMode();
  const excludeTest = !showTestData;
  const merged = { ...(options ?? {}), excludeTest };
  return useQuery({
    queryKey:
      organizationId ? [...jobsKeys.list(organizationId), merged] : ['jobs', 'list', 'disabled', merged],
    queryFn: () => fetchJobs(organizationId!, merged),
    enabled: !!organizationId,
  });
}

export function useJob(id: string) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey:
      id && organizationId ? jobsKeys.detail(id, organizationId) : ['jobs', id, 'disabled'],
    queryFn: () => fetchJob(id, organizationId!),
    enabled: !!id && !!organizationId,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (job: JobInsert) => {
      if (!organizationId) throw new Error('No organization selected');
      return createJob(job, organizationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: jobsKeys.list(organizationId) });
      }
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: JobUpdate }) =>
      updateJob(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: jobsKeys.list(organizationId) });
        queryClient.setQueryData(jobsKeys.detail(data.id, organizationId), data);
      }
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();

  return useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: jobsKeys.list(organizationId) });
      }
    },
  });
}

