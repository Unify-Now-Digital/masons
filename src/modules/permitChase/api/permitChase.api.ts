import { supabase } from '@/shared/lib/supabase';

export type PermitStage =
  | 'form_needed'
  | 'with_customer'
  | 'completing'
  | 'submitted'
  | 'approved';

export const PERMIT_STAGES: PermitStage[] = [
  'form_needed',
  'with_customer',
  'completing',
  'submitted',
  'approved',
];

export const PERMIT_STAGE_LABEL: Record<PermitStage, string> = {
  form_needed: 'Form needed',
  with_customer: 'With customer',
  completing: 'Completing',
  submitted: 'Submitted',
  approved: 'Approved',
};

export interface PermitSla {
  target: number;
  warn: number;
  max: number;
}

export type SlaZone = 'ok' | 'warn' | 'amber' | 'red';

export interface PermitOrder {
  permitId: string;
  orderId: string;
  orderNumber: number | null;
  customerName: string;
  cemetery: string;
  council: string | null;
  contactEmail: string | null;
  stage: PermitStage;
  daysInStage: number;
  formStatus: 'matched' | 'missing' | null;
  formName: string | null;
  formDriveUrl: string | null;
  sentVia: string | null;
  returnedVia: string | null;
  specs: {
    inscription: boolean;
    material: boolean;
    dimensions: boolean;
    fixings: boolean;
    plot: boolean;
  };
  submittedAt: string | null;
  lastChase: string | null;
}

export interface PermitsPayload {
  orders: PermitOrder[];
  slas: Partial<Record<PermitStage, PermitSla>>;
  totalAlerts: number;
}

export function zoneFor(days: number, sla?: PermitSla): { zone: SlaZone; pct: number } {
  if (!sla) return { zone: 'ok', pct: 0 };
  if (days >= sla.max) return { zone: 'red', pct: 100 };
  if (days >= sla.warn) {
    return { zone: 'amber', pct: 60 + ((days - sla.warn) / Math.max(1, sla.max - sla.warn)) * 40 };
  }
  if (days >= sla.target) {
    return { zone: 'warn', pct: 35 + ((days - sla.target) / Math.max(1, sla.warn - sla.target)) * 25 };
  }
  return { zone: 'ok', pct: Math.min(35, (days / Math.max(1, sla.target)) * 35) };
}

const STAGE_TO_SLA_KEY: Record<PermitStage, string | null> = {
  form_needed: 'form_needed',
  with_customer: 'with_customer',
  completing: 'completing',
  submitted: 'submitted',
  approved: null,
};

const DAY = 1000 * 60 * 60 * 24;

export async function fetchPermitsPipeline(organizationId: string): Promise<PermitsPayload> {
  // SLAs
  let slas: Partial<Record<PermitStage, PermitSla>> = {};
  try {
    const { data: slaRows } = await supabase
      .from('workflow_slas')
      .select('stage, target_days, warn_days, max_days')
      .eq('organization_id', organizationId)
      .eq('workflow', 'permit');
    type SlaRow = { stage: string; target_days: number; warn_days: number; max_days: number };
    for (const raw of slaRows ?? []) {
      const r = raw as SlaRow;
      slas[r.stage as PermitStage] = {
        target: r.target_days,
        warn: r.warn_days,
        max: r.max_days,
      };
    }
  } catch {
    // workflow_slas may not exist yet
    slas = {};
  }
  // Sensible fallback defaults if migration hasn't seeded
  const fallback: Record<PermitStage, PermitSla> = {
    form_needed: { target: 2, warn: 3, max: 5 },
    with_customer: { target: 7, warn: 10, max: 14 },
    completing: { target: 2, warn: 3, max: 5 },
    submitted: { target: 21, warn: 25, max: 28 },
    approved: { target: 0, warn: 0, max: 0 },
  };
  for (const stage of PERMIT_STAGES) {
    if (!slas[stage]) slas[stage] = fallback[stage];
  }

  // Permits + joined order/cemetery/memorial info
  let permitRows: Array<Record<string, unknown>> = [];
  try {
    const { data, error } = await supabase
      .from('order_permits')
      .select(
        `id, order_id, permit_phase, updated_at, authority_name, authority_contact, form_url, sent_via, returned_via, returned_at, spec_fixings, spec_plot_ref, specs_completed_at, submission_date,
         orders:orders!inner(id, organization_id, order_number, customer_name, material, inscription_text),
         cemeteries:cemeteries(name)`,
      )
      .eq('orders.organization_id', organizationId);
    if (error) throw error;
    permitRows = data ?? [];
  } catch {
    permitRows = [];
  }

  const today = new Date();
  const orders: PermitOrder[] = [];
  let alerts = 0;

  for (const raw of permitRows) {
    type Row = {
      id: string;
      order_id: string;
      permit_phase: string;
      updated_at: string;
      authority_name: string | null;
      authority_contact: string | null;
      form_url: string | null;
      sent_via: string | null;
      returned_via: string | null;
      returned_at: string | null;
      spec_fixings: string | null;
      spec_plot_ref: string | null;
      specs_completed_at: string | null;
      submission_date: string | null;
      orders: {
        id: string;
        order_number: number | null;
        customer_name: string;
        material: string | null;
        inscription_text: string | null;
      } | null;
      cemeteries: { name: string | null } | null;
    };
    const row = raw as unknown as Row;
    if (!row.orders) continue;
    const stage = (row.permit_phase as PermitStage) ?? 'form_needed';
    if (!PERMIT_STAGES.includes(stage)) continue;
    const inPhaseDays = row.updated_at
      ? Math.max(0, Math.round((today.getTime() - new Date(row.updated_at).getTime()) / DAY))
      : 0;
    const slaKey = STAGE_TO_SLA_KEY[stage];
    const sla = slaKey ? slas[stage] : undefined;
    const z = sla ? zoneFor(inPhaseDays, sla).zone : 'ok';
    if (z === 'amber' || z === 'red') alerts += 1;

    orders.push({
      permitId: row.id,
      orderId: row.orders.id,
      orderNumber: row.orders.order_number,
      customerName: row.orders.customer_name,
      cemetery: row.cemeteries?.name ?? '—',
      council: row.authority_name,
      contactEmail: row.authority_contact,
      stage,
      daysInStage: inPhaseDays,
      formStatus: row.form_url ? 'matched' : null,
      formName: row.form_url ? row.form_url.split('/').pop() ?? null : null,
      formDriveUrl: row.form_url,
      sentVia: row.sent_via,
      returnedVia: row.returned_via,
      specs: {
        inscription: !!row.orders.inscription_text,
        material: !!row.orders.material,
        dimensions: false, // not modelled on order_permits / orders
        fixings: !!row.spec_fixings,
        plot: !!row.spec_plot_ref,
      },
      submittedAt: row.submission_date,
      lastChase: null,
    });
  }

  return { orders, slas, totalAlerts: alerts };
}
