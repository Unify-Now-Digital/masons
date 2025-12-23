import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

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
  detail: (id: string) => ['jobs', id] as const,
};

async function fetchJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Job[];
}

async function fetchJob(id: string) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Job;
}

async function createJob(job: JobInsert) {
  const { data, error } = await supabase
    .from('jobs')
    .insert(job)
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

