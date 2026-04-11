import { supabase } from '@/shared/lib/supabase';
import type {
  Worker,
  WorkerInsert,
  WorkerUpdate,
  WorkerAvailability,
  WorkerAvailabilityInsert,
} from '../types/workers.types';

export async function fetchWorkers(
  organizationId: string,
  options?: { search?: string; activeOnly?: boolean },
) {
  let query = supabase
    .from('workers')
    .select('*')
    .eq('organization_id', organizationId)
    .order('full_name', { ascending: true });

  if (options?.activeOnly) {
    query = query.eq('is_active', true);
  }

  if (options?.search) {
    const search = options.search.toLowerCase();
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Worker[];
}

export async function fetchWorker(id: string) {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Worker;
}

export async function fetchWorkerWithAvailability(id: string) {
  const { data, error } = await supabase
    .from('workers')
    .select('*, worker_availability(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Worker & { worker_availability: WorkerAvailability | null };
}

export async function createWorker(worker: WorkerInsert) {
  const { data, error } = await supabase
    .from('workers')
    .insert(worker)
    .select()
    .single();

  if (error) throw error;
  return data as Worker;
}

export async function updateWorker(id: string, updates: WorkerUpdate) {
  const { data, error } = await supabase
    .from('workers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Worker;
}

export async function upsertWorkerAvailability(availability: WorkerAvailabilityInsert) {
  const { data, error } = await supabase
    .from('worker_availability')
    .upsert(availability, { onConflict: 'worker_id' })
    .select()
    .single();

  if (error) throw error;
  return data as WorkerAvailability;
}

export async function fetchWorkersByJob(jobId: string) {
  const { data, error } = await supabase
    .from('job_workers')
    .select('worker_id, workers(*)')
    .eq('job_id', jobId);

  if (error) throw error;
  return (data || []).map((item: { worker_id: string; workers: Worker | null }) => item.workers).filter((w): w is Worker => w !== null);
}

export async function fetchWorkersByJobs(jobIds: string[]): Promise<Record<string, Worker[]>> {
  if (jobIds.length === 0) return {};

  const { data, error } = await supabase
    .from('job_workers')
    .select('job_id, workers(*)')
    .in('job_id', jobIds);

  if (error) throw error;

  // Group by job_id
  const workersByJob: Record<string, Worker[]> = {};
  (data || []).forEach((item: { job_id: string; workers: Worker | null }) => {
    if (item.workers) {
      if (!workersByJob[item.job_id]) {
        workersByJob[item.job_id] = [];
      }
      workersByJob[item.job_id].push(item.workers);
    }
  });

  return workersByJob;
}

export async function setWorkersForJob(jobId: string, workerIds: string[]) {
  // Delete existing assignments
  const { error: deleteError } = await supabase
    .from('job_workers')
    .delete()
    .eq('job_id', jobId);

  if (deleteError) throw deleteError;

  // Insert new assignments
  if (workerIds.length > 0) {
    const assignments = workerIds.map(workerId => ({
      job_id: jobId,
      worker_id: workerId,
    }));

    const { error: insertError } = await supabase
      .from('job_workers')
      .insert(assignments);

    if (insertError) throw insertError;
  }

  return { jobId, workerIds };
}

