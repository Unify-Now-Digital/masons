/**
 * Resolve orders.order_type for a paid / converted customer.
 * Never returns 'quote' — legacy portal quotes must flip on convert.
 */

export type PaidCustomerOrderType = 'New Memorial' | 'Renovation';

export type PaidOrderTypeEvidence = {
  order_type?: string | null;
  renovation_service_description?: string | null;
  renovation_service_cost?: number | string | null;
};

function isRenovationType(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const n = String(raw).trim().toLowerCase().replace(/[\s_]+/g, '-');
  return n === 'renovation';
}

function hasRenovationServiceEvidence(row: PaidOrderTypeEvidence): boolean {
  const desc = row.renovation_service_description;
  if (typeof desc === 'string' && desc.trim().length > 0) return true;
  if (row.renovation_service_cost == null || row.renovation_service_cost === '') return false;
  const n =
    typeof row.renovation_service_cost === 'number'
      ? row.renovation_service_cost
      : parseFloat(String(row.renovation_service_cost));
  return Number.isFinite(n) && n > 0;
}

/**
 * Type to stamp when a quote converts to a paid customer (deposit_paid /
 * job confirmed / paid invoice). Prefer Renovation only with clear evidence.
 */
export function resolvePaidCustomerOrderType(row: PaidOrderTypeEvidence = {}): PaidCustomerOrderType {
  if (isRenovationType(row.order_type) || hasRenovationServiceEvidence(row)) {
    return 'Renovation';
  }
  return 'New Memorial';
}
