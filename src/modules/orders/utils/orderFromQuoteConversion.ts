import type { OrderInsert } from '../types/orders.types';

/**
 * Quote row from `public.quotes` for order conversion.
 * `customer_id` → `orders.person_id`. `deceased_name` → `orders.customer_name` when set.
 */
export type QuoteForOrderConversion = {
  id: string;
  customer_id: string;
  deceased_name: string | null;
  product_name: string | null;
  product_sku: string | null;
  material: string | null;
  color: string | null;
  inscription: string | null;
  value: number | string | null;
  permit_cost: number | string | null;
  total_value: number | string | null;
  location: string | null;
  notes: string | null;
  status: string | null;
  converted_to_order_id: string | null;
  converted_at: string | null;
  customers?: {
    first_name: string | null;
    last_name: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

export function personNameSnapshotFromCustomer(customer: QuoteForOrderConversion['customers']): string | null {
  if (!customer) return null;
  const name = [customer.first_name, customer.last_name]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
  return name.length ? name : null;
}

function toFiniteNumberOrNull(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

function toFiniteNumberOrZero(raw: number | string | null | undefined): number {
  const n = toFiniteNumberOrNull(raw);
  return n ?? 0;
}

/**
 * Person + quote link + contact snapshot. Apply last so person fields win over caller overrides.
 */
export function orderInsertFieldsFromQuote(quote: QuoteForOrderConversion): Pick<
  OrderInsert,
  'quote_id' | 'person_id' | 'person_name' | 'customer_name' | 'customer_email' | 'customer_phone'
> {
  return {
    quote_id: quote.id,
    person_id: quote.customer_id,
    person_name: personNameSnapshotFromCustomer(quote.customers ?? null),
    customer_name: quote.deceased_name?.trim() ?? '',
    customer_email: quote.customers?.email ?? null,
    customer_phone: quote.customers?.phone ?? null,
  };
}

/**
 * Quote → order field mapping. `sku` stays empty (grave number is staff-filled). `product_id` is resolved separately.
 */
export function orderDetailFieldsFromQuote(
  quote: QuoteForOrderConversion,
  resolvedProductId: string | null
): Pick<
  OrderInsert,
  | 'product_id'
  | 'sku'
  | 'material'
  | 'color'
  | 'value'
  | 'permit_cost'
  | 'location'
  | 'notes'
  | 'inscription_text'
> {
  return {
    product_id: resolvedProductId,
    sku: null,
    material: quote.material?.trim() || null,
    color: quote.color?.trim() || null,
    value: toFiniteNumberOrNull(quote.value),
    permit_cost: toFiniteNumberOrZero(quote.permit_cost),
    location: quote.location?.trim() || null,
    notes: quote.notes?.trim() || null,
    inscription_text: quote.inscription?.trim() || null,
  };
}

/** Defaults aligned with CreateOrderDrawer / CreateInvoiceDrawer inserts (nullable / zero where DB allows). */
export function defaultOrderInsertShell(): Partial<OrderInsert> {
  return {
    invoice_id: null,
    job_id: null,
    permit_form_id: null,
    product_id: null,
    sku: null,
    material: null,
    color: null,
    stone_status: 'NA',
    permit_status: 'pending',
    proof_status: 'Not_Received',
    deposit_date: null,
    second_payment_date: null,
    due_date: null,
    installation_date: null,
    location: null,
    latitude: null,
    longitude: null,
    value: null,
    permit_cost: 0,
    product_photo_url: null,
    renovation_service_description: null,
    renovation_service_cost: 0,
    geocode_status: null,
    geocode_error: null,
    geocoded_at: null,
    geocode_place_id: null,
    progress: 0,
    assigned_to: null,
    priority: 'medium',
    timeline_weeks: 12,
    notes: null,
  };
}
