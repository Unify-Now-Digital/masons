import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useTestDataMode } from '@/shared/context/TestDataContext';
import { tidyStoredName } from '@/shared/lib/personName';
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
  person_name: string | null;
  location: string | null;
  order_type: string;
  latitude: number | null;
  longitude: number | null;
  priority: 'low' | 'medium' | 'high' | null;
  created_at: string;
  is_test: boolean | null;
  installation_date: string | null;
}

function installationDay(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

async function fetchSchedulableStops(
  organizationId: string,
  options: { excludeTest?: boolean } = {}
): Promise<ScheduleStop[]> {
  // Ready-to-schedule orders: lettered + permit approved + stone in stock,
  // and geocoded so we can place them on the map.
  // The install day lives on orders.installation_date. `jobs` is the pipeline
  // table (stage, person_id, …) and has none of the logistics columns, so a
  // select of scheduled_date / address / status returns 400.
  let ordersQ = supabase
    .from('orders')
    .select(
      'id, job_id, customer_name, person_name, location, order_type, latitude, longitude, priority, created_at, is_test, installation_date'
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

  return orderRows.map<ScheduleStop>((o) => ({
    orderId: o.id,
    jobId: o.job_id,
    customerName: tidyStoredName(o.person_name) || tidyStoredName(o.customer_name) || 'Unknown',
    location: o.location ?? '',
    address: o.location ?? '',
    latitude: o.latitude as number,
    longitude: o.longitude as number,
    orderType: o.order_type,
    priority: (o.priority ?? 'medium') as ScheduleStop['priority'],
    scheduledDate: installationDay(o.installation_date),
    createdAt: o.created_at,
    isTest: o.is_test === true,
  }));
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
    const { error } = await supabase
      .from('orders')
      .update({ installation_date: date })
      .eq('id', stop.orderId)
      .eq('organization_id', organizationId);
    if (error) throw error;
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
