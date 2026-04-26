import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useTestDataMode } from '@/shared/context/TestDataContext';
import type { ScheduleStop } from '../utils/scheduleTypes';

export const scheduleKeys = {
  all: ['logistics', 'schedule'] as const,
  stops: (organizationId: string) =>
    ['logistics', 'schedule', 'stops', organizationId] as const,
};

interface OrderRow {
  id: string;
  job_id: string | null;
  customer_name: string;
  location: string | null;
  order_type: string;
  latitude: number | null;
  longitude: number | null;
  priority: 'low' | 'medium' | 'high' | null;
  created_at: string;
  is_test: boolean | null;
}

interface JobRow {
  id: string;
  scheduled_date: string | null;
  status: string;
  address: string | null;
  location_name: string | null;
  priority: 'low' | 'medium' | 'high' | null;
}

async function fetchSchedulableStops(
  organizationId: string,
  options: { excludeTest?: boolean } = {}
): Promise<ScheduleStop[]> {
  // 1. Ready-to-schedule orders: lettered + permit approved + stone in stock,
  //    and geocoded so we can place them on the map.
  let ordersQ = supabase
    .from('orders')
    .select(
      'id, job_id, customer_name, location, order_type, latitude, longitude, priority, created_at, is_test'
    )
    .eq('organization_id', organizationId)
    .eq('proof_status', 'Lettered')
    .eq('permit_status', 'approved')
    .eq('stone_status', 'In Stock')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
  if (options.excludeTest) ordersQ = ordersQ.eq('is_test', false);
  const { data: orders, error: ordersErr } = await ordersQ;
  if (ordersErr) throw ordersErr;

  const orderRows = (orders ?? []) as OrderRow[];
  const jobIds = orderRows.map((o) => o.job_id).filter((id): id is string => !!id);

  // 2. Their jobs (if any) — for the current scheduled_date and address.
  let jobsById = new Map<string, JobRow>();
  if (jobIds.length > 0) {
    const { data: jobs, error: jobsErr } = await supabase
      .from('jobs')
      .select('id, scheduled_date, status, address, location_name, priority')
      .eq('organization_id', organizationId)
      .in('id', jobIds);
    if (jobsErr) throw jobsErr;
    jobsById = new Map((jobs ?? []).map((j: JobRow) => [j.id, j]));
  }

  return orderRows.map<ScheduleStop>((o) => {
    const job = o.job_id ? jobsById.get(o.job_id) ?? null : null;
    return {
      orderId: o.id,
      jobId: job?.id ?? null,
      customerName: o.customer_name,
      location: job?.location_name ?? o.location ?? '',
      address: job?.address ?? o.location ?? '',
      latitude: o.latitude as number,
      longitude: o.longitude as number,
      orderType: o.order_type,
      priority: (job?.priority ?? o.priority ?? 'medium') as ScheduleStop['priority'],
      scheduledDate: job?.scheduled_date ?? null,
      createdAt: o.created_at,
      isTest: o.is_test === true,
    };
  });
}

export function useScheduleData() {
  const { organizationId } = useOrganization();
  const { showTestData } = useTestDataMode();
  const excludeTest = !showTestData;
  return useQuery({
    queryKey: organizationId
      ? [...scheduleKeys.stops(organizationId), { excludeTest }]
      : ['logistics', 'schedule', 'stops', 'disabled'],
    queryFn: () => fetchSchedulableStops(organizationId!, { excludeTest }),
    enabled: !!organizationId,
  });
}

interface SaveAssignment {
  stop: ScheduleStop;
  date: string | null;
}

interface SaveScheduleInput {
  changes: SaveAssignment[];
}

async function saveSchedule(
  { changes }: SaveScheduleInput,
  organizationId: string
) {
  for (const { stop, date } of changes) {
    if (stop.jobId) {
      // Existing job: only update scheduled_date.
      const { error } = await supabase
        .from('jobs')
        .update({ scheduled_date: date })
        .eq('id', stop.jobId)
        .eq('organization_id', organizationId);
      if (error) throw error;
    } else {
      if (!date) continue; // Nothing to create — order stays unscheduled.
      // Create a job from the order, then point the order at it.
      const { data: job, error: createErr } = await supabase
        .from('jobs')
        .insert({
          organization_id: organizationId,
          order_id: stop.orderId,
          customer_name: stop.customerName,
          location_name: stop.location || stop.address || stop.customerName,
          address: stop.address || stop.location || '',
          latitude: stop.latitude,
          longitude: stop.longitude,
          status: 'scheduled',
          scheduled_date: date,
          priority: stop.priority,
        })
        .select('id')
        .single();
      if (createErr) throw createErr;
      const { error: linkErr } = await supabase
        .from('orders')
        .update({ job_id: job.id })
        .eq('id', stop.orderId)
        .eq('organization_id', organizationId);
      if (linkErr) throw linkErr;
    }
  }
}

export function useSaveSchedule() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: (input: SaveScheduleInput) => {
      if (!organizationId) throw new Error('No organization selected');
      return saveSchedule(input, organizationId);
    },
    onSuccess: () => {
      if (organizationId) {
        queryClient.invalidateQueries({
          queryKey: scheduleKeys.stops(organizationId),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['logistics'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['map', 'orders'] });
    },
  });
}
