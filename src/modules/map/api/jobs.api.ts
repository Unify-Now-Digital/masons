import { supabase } from '@/shared/lib/supabase';
import type { Job, JobInsert, JobUpdate } from '../types/jobs.types';

export async function fetchJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('scheduled_date', { ascending: true });
  
  if (error) throw error;
  return data as Job[];
}

export async function fetchJob(id: string) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Job;
}

export async function createJob(job: JobInsert) {
  const { data, error } = await supabase
    .from('jobs')
    .insert(job)
    .select()
    .single();

  if (error) throw error;
  return data as Job;
}

export async function updateJob(id: string, updates: JobUpdate) {
  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Job;
}

export async function deleteJob(id: string) {
  const { error } = await supabase.from('jobs').delete().eq('id', id);
  if (error) throw error;
}

