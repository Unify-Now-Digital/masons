import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJobs, fetchJob, createJob, updateJob, deleteJob } from '../api/jobs.api';
import type { JobInsert, JobUpdate } from '../types/jobs.types';

export const jobsKeys = {
  all: ['jobs'] as const,
  detail: (id: string) => ['jobs', id] as const,
};

export function useJobsList() {
  return useQuery({
    queryKey: jobsKeys.all,
    queryFn: fetchJobs,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobsKeys.detail(id),
    queryFn: () => fetchJob(id),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (job: JobInsert) => createJob(job),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: JobUpdate }) => 
      updateJob(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
      queryClient.setQueryData(jobsKeys.detail(data.id), data);
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}

