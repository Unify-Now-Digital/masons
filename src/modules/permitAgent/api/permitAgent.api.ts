import { supabase } from '@/shared/lib/supabase';
import type {
  OrderPermit,
  OrderPermitInsert,
  OrderPermitUpdate,
  PermitActivityLog,
  PermitActivityLogInsert,
  PermitPipelineItem,
} from '../types/permitAgent.types';

// ── Order Permits CRUD ──

export async function listOrderPermits(organizationId: string): Promise<OrderPermit[]> {
  const { data, error } = await supabase
    .from('order_permits')
    .select('*')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data as OrderPermit[];
}

export async function getOrderPermit(id: string, organizationId: string): Promise<OrderPermit> {
  const { data, error } = await supabase
    .from('order_permits')
    .select('*')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single();

  if (error) throw error;
  return data as OrderPermit;
}

export async function getOrderPermitByOrderId(
  orderId: string,
  organizationId: string,
): Promise<OrderPermit | null> {
  const { data, error } = await supabase
    .from('order_permits')
    .select('*')
    .eq('order_id', orderId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw error;
  return data as OrderPermit | null;
}

export async function createOrderPermit(
  payload: OrderPermitInsert,
  organizationId: string,
): Promise<OrderPermit> {
  const { data, error } = await supabase
    .from('order_permits')
    .insert({ ...payload, organization_id: organizationId })
    .select()
    .single();

  if (error) throw error;
  return data as OrderPermit;
}

export async function updateOrderPermit(id: string, payload: OrderPermitUpdate): Promise<OrderPermit> {
  const { data, error } = await supabase
    .from('order_permits')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as OrderPermit;
}

export async function deleteOrderPermit(id: string): Promise<void> {
  const { error } = await supabase
    .from('order_permits')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ── Activity Log ──

export async function listActivities(
  organizationId: string,
  orderPermitId: string,
): Promise<PermitActivityLog[]> {
  const { data, error } = await supabase
    .from('permit_activity_log')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('order_permit_id', orderPermitId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as PermitActivityLog[];
}

export async function createActivity(
  payload: PermitActivityLogInsert,
  organizationId: string,
): Promise<PermitActivityLog> {
  const { data, error } = await supabase
    .from('permit_activity_log')
    .insert({ ...payload, organization_id: organizationId })
    .select()
    .single();

  if (error) throw error;
  return data as PermitActivityLog;
}

// ── Pipeline view: permits joined with orders ──

export async function fetchPermitPipeline(organizationId: string): Promise<PermitPipelineItem[]> {
  // Fetch all permits
  const { data: permits, error: permitsError } = await supabase
    .from('order_permits')
    .select('*')
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false });

  if (permitsError) throw permitsError;
  if (!permits || permits.length === 0) return [];

  // Fetch related orders
  const orderIds = (permits as OrderPermit[]).map((p) => p.order_id);
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, person_name, location, installation_date, material, order_type, permit_status, value')
    .eq('organization_id', organizationId)
    .in('id', orderIds);

  if (ordersError) throw ordersError;

  // Fetch all activity logs
  const permitIds = (permits as OrderPermit[]).map((p) => p.id);
  const { data: activities, error: activitiesError } = await supabase
    .from('permit_activity_log')
    .select('*')
    .eq('organization_id', organizationId)
    .in('order_permit_id', permitIds)
    .order('created_at', { ascending: true });

  if (activitiesError) throw activitiesError;

  const ordersMap = new Map((orders || []).map((o) => [o.id, o]));
  const activitiesMap = new Map<string, PermitActivityLog[]>();
  for (const a of (activities || []) as PermitActivityLog[]) {
    const existing = activitiesMap.get(a.order_permit_id) || [];
    existing.push(a);
    activitiesMap.set(a.order_permit_id, existing);
  }

  const now = new Date();

  return (permits as OrderPermit[]).map((permit) => {
    const order = ordersMap.get(permit.order_id) || {
      id: permit.order_id,
      order_number: null,
      customer_name: 'Unknown',
      person_name: null,
      location: null,
      installation_date: null,
      material: null,
      order_type: 'Unknown',
      permit_status: 'pending',
      value: null,
    };

    const installDate = order.installation_date ? new Date(order.installation_date) : null;
    const daysUntilInstall = installDate
      ? Math.ceil((installDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const isUrgent = daysUntilInstall !== null && daysUntilInstall <= 30 && permit.permit_phase !== 'APPROVED';

    return {
      permit,
      order,
      activities: activitiesMap.get(permit.id) || [],
      daysUntilInstall,
      isUrgent,
    };
  });
}

// ── Update permit and sync order.permit_status ──

const PHASE_TO_ORDER_STATUS: Record<string, string> = {
  SENT_TO_CLIENT: 'form_sent',
  SUBMITTED: 'customer_completed',
  APPROVED: 'approved',
};

export async function updatePermitWithOrderSync(
  permitId: string,
  payload: OrderPermitUpdate,
  orderId: string,
  organizationId: string,
): Promise<OrderPermit> {
  const permit = await updateOrderPermit(permitId, payload);

  if (payload.permit_phase) {
    const newOrderStatus = PHASE_TO_ORDER_STATUS[payload.permit_phase];
    if (newOrderStatus) {
      await supabase
        .from('orders')
        .update({ permit_status: newOrderStatus })
        .eq('id', orderId)
        .eq('organization_id', organizationId);
    }
  }

  return permit;
}

// ── Initialize permits for orders that don't have one yet ──

export async function initializePermitsForOrders(organizationId: string): Promise<number> {
  const { data: allOrders, error: allOrdersError } = await supabase
    .from('orders')
    .select('id')
    .eq('organization_id', organizationId);

  if (allOrdersError) throw allOrdersError;

  const { data: existingPermits, error: existingError } = await supabase
    .from('order_permits')
    .select('order_id')
    .eq('organization_id', organizationId);

  if (existingError) throw existingError;

  const existingOrderIds = new Set((existingPermits || []).map((p: { order_id: string }) => p.order_id));
  const newOrders = (allOrders || []).filter((o: { id: string }) => !existingOrderIds.has(o.id));

  if (newOrders.length === 0) return 0;

  const inserts: OrderPermitInsert[] = newOrders.map((o: { id: string }) => ({
    order_id: o.id,
    permit_phase: 'REQUIRED' as const,
    authority_name: null,
    authority_contact: null,
    form_url: null,
    readiness_score: 0,
    fee_paid: false,
    submission_date: null,
    prefilled_data: null,
    notes: null,
  }));

  const { error: insertError } = await supabase
    .from('order_permits')
    .insert(
      inserts.map((row) => ({ ...row, organization_id: organizationId })),
    );

  if (insertError) throw insertError;
  return newOrders.length;
}
