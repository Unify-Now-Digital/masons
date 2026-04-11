import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  fetchWorkers,
  fetchWorker,
  fetchWorkerWithAvailability,
  createWorker,
  updateWorker,
  upsertWorkerAvailability,
  fetchWorkersByJob,
  fetchWorkersByJobs,
  setWorkersForJob,
} from '../api/workers.api';
import type { WorkerInsert, WorkerUpdate, WorkerAvailabilityInsert } from '../types/workers.types';

export const workersKeys = {
  all: ['workers'] as const,
  detail: (id: string) => ['workers', id] as const,
  byJob: (jobId: string) => ['workers', 'byJob', jobId] as const,
  list: (organizationId: string, options?: { search?: string; activeOnly?: boolean }) =>
    ['workers', 'list', organizationId, options] as const,
};

export function useWorkers(options?: { search?: string; activeOnly?: boolean }) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? workersKeys.list(organizationId, options)
      : ['workers', 'list', 'disabled', options],
    queryFn: () => fetchWorkers(organizationId!, options),
    enabled: !!organizationId,
  });
}

export function useWorker(id: string) {
  return useQuery({
    queryKey: workersKeys.detail(id),
    queryFn: () => fetchWorker(id),
    enabled: !!id,
  });
}

export function useWorkerWithAvailability(id: string) {
  return useQuery({
    queryKey: ['workers', id, 'withAvailability'],
    queryFn: () => fetchWorkerWithAvailability(id),
    enabled: !!id,
  });
}

export function useCreateWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (worker: WorkerInsert) => createWorker(worker),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workersKeys.all });
    },
  });
}

export function useUpdateWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: WorkerUpdate }) =>
      updateWorker(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: workersKeys.all });
      queryClient.setQueryData(workersKeys.detail(data.id), data);
    },
  });
}

export function useUpsertWorkerAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (availability: WorkerAvailabilityInsert) =>
      upsertWorkerAvailability(availability),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workers', data.worker_id] });
    },
  });
}

export function useWorkersByJob(jobId: string) {
  return useQuery({
    queryKey: workersKeys.byJob(jobId),
    queryFn: () => fetchWorkersByJob(jobId),
    enabled: !!jobId,
  });
}

export function useWorkersByJobs(jobIds: string[]) {
  const sortedJobIds = useMemo(() => [...jobIds].sort(), [jobIds]);

  return useQuery({
    queryKey: ['workers', 'byJobs', sortedJobIds],
    queryFn: () => fetchWorkersByJobs(sortedJobIds),
    enabled: sortedJobIds.length > 0,
  });
}

export function useSetWorkersForJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, workerIds }: { jobId: string; workerIds: string[] }) =>
      setWorkersForJob(jobId, workerIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: workersKeys.byJob(data.jobId) });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

