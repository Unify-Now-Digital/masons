import { supabase } from '@/shared/lib/supabase';
import type { Order, OrderInsert, OrderUpdate, OrderAdditionalOption, OrderPerson } from '../types/orders.types';
import { normalizeOrder, type RawOrder } from '../utils/numberParsing';
import {
  defaultOrderInsertShell,
  orderDetailFieldsFromQuote,
  orderInsertFieldsFromQuote,
  type QuoteForOrderConversion,
} from '../utils/orderFromQuoteConversion';

function attachQuoteProductName<T extends { quote_id?: string | null; quote?: { product_name?: string | null } | null }>(
  order: T
): Omit<T, 'quote'> & { quote_product_name: string | null } {
  const quoteId = typeof order.quote_id === 'string' ? order.quote_id.trim() : '';
  const quoteProductName = order.quote?.product_name ?? null;
  // Remove embedded relation before normalizing to Order shape.
  const { quote: _quote, ...rest } = order as T & { quote?: { product_name?: string | null } | null };
  return {
    ...rest,
    quote_product_name: quoteId ? quoteProductName : null,
  };
}

export async function fetchOrders(organizationId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_additional_options(cost), quote:quotes!quote_id(product_name)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message ?? 'Failed to fetch orders');
  return (data || []).map((row) => {
    const normalizedOrder = normalizeOrder(attachQuoteProductName(row) as RawOrder);
    const options = row.order_additional_options || [];
    const optionsTotal = options.reduce((sum: number, opt: { cost?: number | string | null }) => {
      const cost = typeof opt.cost === 'string' ? parseFloat(opt.cost) : (opt.cost ?? 0);
      return sum + (Number.isFinite(cost) ? cost : 0);
    }, 0);
    normalizedOrder.additional_options_total = Number.isFinite(optionsTotal) ? optionsTotal : 0;
    return normalizedOrder;
  });
}

export async function fetchOrder(id: string, organizationId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(id, first_name, last_name), order_additional_options(*), quote:quotes!quote_id(product_name)')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single();
  
  if (error) throw error;
  // Calculate additional_options_total from joined options (single-order fetch uses orders table, not the view)
  if (data) {
    const orderAdditionalOptions = data.order_additional_options || [];
    const withQuoteProductName = {
      ...data,
      quote_product_name: data.quote?.product_name ?? null,
    };
    const normalizedOrder = normalizeOrder(withQuoteProductName as RawOrder);
    if (orderAdditionalOptions.length > 0) {
      const optionsTotal = orderAdditionalOptions.reduce((sum, opt) => {
        const cost = typeof opt.cost === 'string' ? parseFloat(opt.cost) : (opt.cost ?? 0);
        return sum + (Number.isFinite(cost) ? cost : 0);
      }, 0);
      normalizedOrder.additional_options_total = Number.isFinite(optionsTotal) ? optionsTotal : 0;
    } else {
      normalizedOrder.additional_options_total = 0;
    }
    return normalizedOrder;
  }
  throw new Error('Order not found');
}

/**
 * Fetch order_people for an order (people linked to order, with one primary)
 * @param orderId - UUID of the order
 * @returns Array of OrderPerson objects (primary first)
 */
export async function fetchOrderPeople(orderId: string): Promise<OrderPerson[]> {
  const { data, error } = await supabase
    .from('order_people')
    .select('id, order_id, person_id, is_primary, created_at, customers(id, first_name, last_name, email, phone)')
    .eq('order_id', orderId)
    .order('is_primary', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as OrderPerson[];
}

/**
 * Upsert order_people for an order; mirror primary to orders.person_id and orders.person_name
 * @param orderId - UUID of the order
 * @param people - Array of { person_id, is_primary }; exactly one must be primary (first used if none)
 */
export async function upsertOrderPeople(
  orderId: string,
  people: { person_id: string; is_primary: boolean }[]
): Promise<void> {
  if (people.length === 0) {
    const { error: delErr } = await supabase.from('order_people').delete().eq('order_id', orderId);
    if (delErr) throw delErr;
    const { error: updErr } = await supabase
      .from('orders')
      .update({ person_id: null, person_name: null })
      .eq('id', orderId);
    if (updErr) throw updErr;
    return;
  }

  // Enforce exactly one primary
  const hasPrimary = people.some((p) => p.is_primary);
  const normalized = hasPrimary
    ? people
    : people.map((p, i) => ({ ...p, is_primary: i === 0 }));

  // Delete existing, insert new (simpler than diff/upsert)
  const { error: delErr } = await supabase.from('order_people').delete().eq('order_id', orderId);
  if (delErr) throw delErr;

  const rows = normalized.map((p) => ({
    order_id: orderId,
    person_id: p.person_id,
    is_primary: p.is_primary,
  }));

  const { error: insErr } = await supabase.from('order_people').insert(rows);
  if (insErr) throw insErr;

  // Mirror primary to orders
  const primary = normalized.find((p) => p.is_primary);
  if (primary) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .eq('id', primary.person_id)
      .single();

    const personName = customer
      ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || null
      : null;

    const { error: updErr } = await supabase
      .from('orders')
      .update({ person_id: primary.person_id, person_name: personName })
      .eq('id', orderId);
    if (updErr) throw updErr;
  }
}

/**
 * Fetch all orders for a person (customer)
 * @param personId - UUID of the customer (person)
 * @returns Array of Order objects ordered by creation date (newest first)
 */
export async function fetchOrdersByPersonId(personId: string, organizationId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_additional_options(cost), quote:quotes!quote_id(product_name)')
    .eq('person_id', personId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => {
    const normalizedOrder = normalizeOrder(attachQuoteProductName(row) as RawOrder);
    const options = row.order_additional_options || [];
    const optionsTotal = options.reduce((sum: number, opt: { cost?: number | string | null }) => {
      const cost = typeof opt.cost === 'string' ? parseFloat(opt.cost) : (opt.cost ?? 0);
      return sum + (Number.isFinite(cost) ? cost : 0);
    }, 0);
    normalizedOrder.additional_options_total = Number.isFinite(optionsTotal) ? optionsTotal : 0;
    return normalizedOrder;
  });
}

/**
 * Fetch orders for multiple person IDs (e.g. for inbox list). Returns orders ordered by created_at desc.
 * Used to derive one order display ID per person without N+1.
 */
export async function fetchOrdersByPersonIds(
  personIds: string[],
  organizationId: string,
): Promise<Order[]> {
  if (personIds.length === 0) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_additional_options(cost), quote:quotes!quote_id(product_name)')
    .eq('organization_id', organizationId)
    .in('person_id', personIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => {
    const normalizedOrder = normalizeOrder(attachQuoteProductName(row) as RawOrder);
    const options = row.order_additional_options || [];
    const optionsTotal = options.reduce((sum: number, opt: { cost?: number | string | null }) => {
      const cost = typeof opt.cost === 'string' ? parseFloat(opt.cost) : (opt.cost ?? 0);
      return sum + (Number.isFinite(cost) ? cost : 0);
    }, 0);
    normalizedOrder.additional_options_total = Number.isFinite(optionsTotal) ? optionsTotal : 0;
    return normalizedOrder;
  });
}

/**
 * Fetch all orders associated with a specific invoice (includes additional_options for cost breakdown)
 * @param invoiceId - UUID of the invoice
 * @returns Array of Order objects ordered by creation date (newest first)
 */
export async function fetchOrdersByInvoice(invoiceId: string, organizationId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_additional_options(cost), quote:quotes!quote_id(product_name)')
    .eq('invoice_id', invoiceId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map((row) => {
    const normalizedOrder = normalizeOrder(attachQuoteProductName(row) as RawOrder);
    const options = row.order_additional_options || [];
    const optionsTotal = options.reduce((sum: number, opt: { cost?: number | string | null }) => {
      const cost = typeof opt.cost === 'string' ? parseFloat(opt.cost) : (opt.cost ?? 0);
      return sum + (Number.isFinite(cost) ? cost : 0);
    }, 0);
    normalizedOrder.additional_options_total = Number.isFinite(optionsTotal) ? optionsTotal : 0;
    return normalizedOrder;
  });
}

export async function createOrder(order: OrderInsert, organizationId: string) {
  const { data, error } = await supabase
    .from('orders')
    .insert({ ...order, organization_id: organizationId })
    .select('*')
    .single();
  
  if (error) throw error;
  return normalizeOrder(data as RawOrder);
}

/**
 * Resolve `products.id` from quote `product_sku` (tries `slug` then `sku` on products).
 */
export async function resolveProductIdFromQuoteProductSku(
  productSku: string | null | undefined
): Promise<string | null> {
  const t = productSku?.trim();
  if (!t) return null;

  const { data: bySlug, error: errSlug } = await supabase
    .from('products')
    .select('id')
    .eq('slug', t)
    .maybeSingle();
  if (!errSlug && bySlug?.id) return bySlug.id;

  const { data: bySku, error: errSku } = await supabase.from('products').select('id').eq('sku', t).maybeSingle();
  if (!errSku && bySku?.id) return bySku.id;

  return null;
}

/**
 * Load a quote row (with linked customer) for converting to an order.
 */
export async function fetchQuoteForOrderConversion(quoteId: string): Promise<QuoteForOrderConversion> {
  const { data, error } = await supabase
    .from('quotes')
    .select(
      [
        'id',
        'customer_id',
        'deceased_name',
        'product_name',
        'product_sku',
        'material',
        'color',
        'inscription',
        'value',
        'permit_cost',
        'total_value',
        'location',
        'notes',
        'status',
        'converted_to_order_id',
        'converted_at',
        'customers(first_name, last_name, email, phone)',
      ].join(', ')
    )
    .eq('id', quoteId)
    .single();

  if (error) throw new Error(error.message ?? 'Failed to load quote');
  if (!data) throw new Error('Quote not found');
  return data as unknown as QuoteForOrderConversion;
}

/**
 * Create an order from a quote: person vs deceased fields, catalog product_id by SKU, no grave sku.
 */
export async function createOrderFromQuote(
  quoteId: string,
  fields: Partial<OrderInsert> = {},
  organizationId: string,
): Promise<Order> {
  const quote = await fetchQuoteForOrderConversion(quoteId);
  const resolvedProductId = await resolveProductIdFromQuoteProductSku(quote.product_sku);
  const fromQuote = orderInsertFieldsFromQuote(quote);
  const merged: OrderInsert = {
    ...(defaultOrderInsertShell() as OrderInsert),
    order_type: 'New Memorial',
    ...orderDetailFieldsFromQuote(quote, resolvedProductId),
    ...fields,
    ...fromQuote,
  };
  const created = await createOrder(merged, organizationId);
  await upsertOrderPeople(created.id, [{ person_id: quote.customer_id, is_primary: true }]);
  return fetchOrder(created.id, organizationId);
}

export async function updateOrder(id: string, updates: OrderUpdate) {
  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return normalizeOrder(data as RawOrder);
}

export async function deleteOrder(id: string) {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

/**
 * Fetch only person_id from an order (lightweight query)
 * @param orderId - UUID of the order
 * @returns person_id string or null
 */
export async function fetchOrderPersonId(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('person_id')
    .eq('id', orderId)
    .single();
  
  if (error) {
    // Handle gracefully - if order not found, return null
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }
  
  return data?.person_id as string | null;
}

/**
 * Fetch all person_id values from orders linked to an invoice
 * @param invoiceId - UUID of the invoice
 * @returns Array of unique non-null person_id strings
 */
export async function fetchInvoicePersonIds(invoiceId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('person_id')
    .eq('invoice_id', invoiceId);
  
  if (error) throw error;
  
  // Extract unique non-null person_ids
  const personIds = new Set<string>();
  data?.forEach(order => {
    if (order.person_id) {
      personIds.add(order.person_id);
    }
  });
  
  return Array.from(personIds);
}

// ============================================================================
// Additional Options CRUD Functions
// ============================================================================

/**
 * Fetch all additional options for a specific order
 * @param orderId - UUID of the order
 * @returns Array of OrderAdditionalOption objects
 */
export async function fetchAdditionalOptionsByOrder(orderId: string) {
  const { data, error } = await supabase
    .from('order_additional_options')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data as OrderAdditionalOption[];
}

/**
 * Create a new additional option for an order
 * @param option - Additional option data (order_id, name, cost, description?)
 * @returns Created OrderAdditionalOption
 */
export async function createAdditionalOption(option: {
  order_id: string;
  name: string;
  cost: number;
  description?: string | null;
}) {
  const { data, error } = await supabase
    .from('order_additional_options')
    .insert(option)
    .select()
    .single();
  
  if (error) throw error;
  return data as OrderAdditionalOption;
}

/**
 * Update an existing additional option
 * @param id - UUID of the additional option
 * @param updates - Partial update data (name?, cost?, description?)
 * @returns Updated OrderAdditionalOption
 */
export async function updateAdditionalOption(
  id: string,
  updates: {
    name?: string;
    cost?: number;
    description?: string | null;
  }
) {
  const { data, error } = await supabase
    .from('order_additional_options')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as OrderAdditionalOption;
}

/**
 * Delete an additional option
 * @param id - UUID of the additional option
 * @returns The order_id of the deleted option (for cache invalidation)
 */
export async function deleteAdditionalOption(id: string) {
  // First fetch the option to get order_id for cache invalidation
  const { data: option, error: fetchError } = await supabase
    .from('order_additional_options')
    .select('order_id')
    .eq('id', id)
    .single();
  
  if (fetchError) throw fetchError;
  
  // Then delete the option
  const { error } = await supabase
    .from('order_additional_options')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  
  // Return order_id for cache invalidation
  return option.order_id;
}

