import { supabase } from '@/shared/lib/supabase';

export interface LogisticsStop {
  jobId: string;
  orderId: string | null;
  customerName: string;
  locationName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  priority: 'low' | 'medium' | 'high';
  status: string;
  estimatedDuration: string | null;
  notes: string | null;
  crew: string[];
  isTest: boolean;
}

export interface LogisticsDayGroup {
  date: string; // YYYY-MM-DD
  label: string; // "Mon 27 Apr"
  stops: LogisticsStop[];
  stopCount: number;
}

export interface LogisticsWeek {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Sunday)
  label: string; // "Mon 27 Apr — Sun 3 May"
  days: LogisticsDayGroup[];
  totalStops: number;
}

export interface LogisticsPayload {
  currentWeek: LogisticsWeek;
  nextWeek: LogisticsWeek;
  unscheduled: LogisticsStop[];
  totalActive: number;
}

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
const SHORT_LABEL = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=Sun..6=Sat
  const offset = (day + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function emptyWeek(weekStart: Date): LogisticsWeek {
  const end = addDays(weekStart, 6);
  const days: LogisticsDayGroup[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(weekStart, i);
    days.push({
      date: isoDate(day),
      label: DAY_LABEL.format(day),
      stops: [],
      stopCount: 0,
    });
  }
  return {
    weekStart: isoDate(weekStart),
    weekEnd: isoDate(end),
    label: `${SHORT_LABEL.format(weekStart)} — ${SHORT_LABEL.format(end)}`,
    days,
    totalStops: 0,
  };
}

export async function fetchLogistics(
  organizationId: string,
  options: { excludeTest?: boolean } = {}
): Promise<LogisticsPayload> {
  const today = new Date();
  const currentWeekStart = startOfWeek(today);
  const nextWeekStart = addDays(currentWeekStart, 7);
  const horizonEnd = addDays(currentWeekStart, 21); // 3-week window

  let jobsQuery = supabase
    .from('jobs')
    .select('id, order_id, customer_name, location_name, address, latitude, longitude, priority, status, scheduled_date, estimated_duration, notes, is_test')
    .eq('organization_id', organizationId)
    .in('status', ['scheduled', 'in_progress', 'ready_for_installation'])
    .or(`scheduled_date.is.null,scheduled_date.lte.${isoDate(horizonEnd)}`)
    .order('scheduled_date', { ascending: true, nullsFirst: false });
  if (options.excludeTest) jobsQuery = jobsQuery.eq('is_test', false);
  const { data: jobsRows, error: jobsErr } = await jobsQuery;
  if (jobsErr) throw jobsErr;

  const jobIds = (jobsRows ?? []).map((j) => j.id as string);

  // Crew assignments for these jobs
  let crewMap: Record<string, string[]> = {};
  if (jobIds.length) {
    const { data: assignments, error: assignErr } = await supabase
      .from('job_workers')
      .select('job_id, workers:workers!inner(full_name)')
      .in('job_id', jobIds);
    if (assignErr) throw assignErr;
    type AssignRow = { job_id: string; workers: { full_name: string } | null };
    crewMap = (assignments ?? []).reduce<Record<string, string[]>>((acc, rawRow) => {
      const row = rawRow as AssignRow;
      const name = row.workers?.full_name;
      if (!name) return acc;
      if (!acc[row.job_id]) acc[row.job_id] = [];
      acc[row.job_id].push(name);
      return acc;
    }, {});
  }

  const toStop = (j: typeof jobsRows extends Array<infer R> ? R : never): LogisticsStop => ({
    jobId: j.id as string,
    orderId: (j.order_id as string | null) ?? null,
    customerName: (j.customer_name as string) ?? 'Unknown',
    locationName: (j.location_name as string) ?? '',
    address: (j.address as string) ?? '',
    latitude: (j.latitude as number | null) ?? null,
    longitude: (j.longitude as number | null) ?? null,
    priority: (j.priority as LogisticsStop['priority']) ?? 'medium',
    status: (j.status as string) ?? 'scheduled',
    estimatedDuration: (j.estimated_duration as string | null) ?? null,
    notes: (j.notes as string | null) ?? null,
    crew: crewMap[j.id as string] ?? [],
    isTest: (j as { is_test?: boolean | null }).is_test === true,
  });

  const currentWeek = emptyWeek(currentWeekStart);
  const nextWeek = emptyWeek(nextWeekStart);
  const unscheduled: LogisticsStop[] = [];

  for (const raw of jobsRows ?? []) {
    const stop = toStop(raw);
    const scheduled = raw.scheduled_date as string | null;
    if (!scheduled) {
      unscheduled.push(stop);
      continue;
    }
    const d = new Date(scheduled);
    const dayIso = isoDate(d);
    const weekTarget =
      d >= currentWeekStart && d < nextWeekStart
        ? currentWeek
        : d >= nextWeekStart && d < addDays(nextWeekStart, 7)
          ? nextWeek
          : null;
    if (!weekTarget) continue;
    const dayGroup = weekTarget.days.find((day) => day.date === dayIso);
    if (!dayGroup) continue;
    dayGroup.stops.push(stop);
    dayGroup.stopCount += 1;
    weekTarget.totalStops += 1;
  }

  return {
    currentWeek,
    nextWeek,
    unscheduled,
    totalActive: (jobsRows ?? []).length,
  };
}
