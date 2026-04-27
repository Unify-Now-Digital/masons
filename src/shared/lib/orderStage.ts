/**
 * Canonical order-stage derivation.
 *
 * Mirrors the `public.order_stage` SQL function and the
 * `public.v_orders_with_stage` view (see
 * supabase/migrations/20260419120000_orders_stage_view.sql).
 *
 * Keep this file in sync with the SQL. If you change the rule here,
 * update the migration and ship a new view revision.
 */

export type OrderStage = 'design' | 'proof' | 'lettering' | 'permit' | 'install_ready';

export const ORDER_STAGE_LABEL: Record<OrderStage, string> = {
  design: 'Design',
  proof: 'Proof',
  lettering: 'Lettering',
  permit: 'Permit',
  install_ready: 'Install-ready',
};

export const ORDER_STAGES: OrderStage[] = ['design', 'proof', 'lettering', 'permit', 'install_ready'];

interface StageInputs {
  stone_status: string | null | undefined;
  proof_status: string | null | undefined;
  permit_status: string | null | undefined;
}

export function deriveOrderStage({
  stone_status,
  proof_status,
  permit_status,
}: StageInputs): OrderStage {
  if (proof_status === 'NA' || proof_status === 'Not_Received' || proof_status == null) {
    return 'design';
  }
  if (proof_status === 'Received' || proof_status === 'In_Progress') {
    return 'proof';
  }
  if (proof_status === 'Lettered' && permit_status !== 'approved') {
    if (
      permit_status === 'form_sent' ||
      permit_status === 'customer_completed' ||
      permit_status === 'pending'
    ) {
      return 'permit';
    }
    return 'lettering';
  }
  if ((stone_status ?? 'NA') !== 'In Stock') {
    return 'lettering';
  }
  return 'install_ready';
}
