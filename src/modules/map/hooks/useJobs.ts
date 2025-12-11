import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export interface Job {
  id: string;
  order_id: string | null;
  customer_name: string;
  location_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: 'scheduled' | 'in_progress' | 'ready_for_installation' | 'completed' | 'cancelled';
  scheduled_date: string | null;
  estimated_duration: string | null;
  priority: 'low' | 'medium' | 'high';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const jobsKeys = {
  all: ['jobs', 'map'] as const,
};

async function fetchJobsForMap() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as Job[];
}

export function useJobsList() {
  return useQuery({
    queryKey: jobsKeys.all,
    queryFn: fetchJobsForMap,
  });
}

