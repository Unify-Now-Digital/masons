import { supabase } from '@/shared/lib/supabase';
import type { Order, OrderInsert, OrderUpdate, OrderAdditionalOption, OrderPerson } from '../types/orders.types';
import { normalizeOrder, type RawOrder } from '../utils/numberParsing';
import {
  defaultOrderInsertShell,
  orderDetailFieldsFromQuote,
  orderInsertFieldsFromQuote,
  type QuoteForOrderConversion,
} from '../utils/orderFromQuoteConversion';
import { resolvePaidCustomerOrderType } from '../utils/paidOrderType';
import { fetchAllPages } from '@/shared/lib/fetchAllPages';

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

/** Columns a non-owner may select. Money and product_config are revoked. */
const ORDERS_SAFE_SELECT = [
  'id', 'customer_name', 'customer_email', 'customer_phone', 'order_type', 'sku', 'material', 'color',
  'stone_status', 'permit_status', 'proof_status', 'deposit_date', 'second_payment_date', 'due_date',
  'installation_date', 'location', 'progress', 'assigned_to', 'priority', 'timeline_weeks', 'notes',
  'created_at', 'updated_at', 'invoice_id', 'latitude', 'longitude', 'renovation_service_description',
  'geocode_status', 'geocode_error', 'geocoded_at', 'geocode_place_id', 'order_number', 'person_id',
  'person_name', 'product_photo_url', 'permit_form_id', 'partner_id', 'edit_token', 'status', 'quote_id',
  'tracking_token', 'inscription_text', 'inscription_status', 'proof_url', 'proof_uploaded_at', 'proof_notes',
  'estimated_completion', 'permit_transferred_at', 'inscription_font', 'inscription_font_other',
  'inscription_layout', 'inscription_additional', 'product_id', 'organization_id', 'cemetery_id',
  'admin_notes', 'is_test', 'custom_product_name', 'job_id', 'stage', 'archived_at',
].join(', ');

const OPTION_SAFE_SELECT = 'id, order_id, name, description, created_at, updated_at, organization_id';

function invoiceEmbed(canSeeMoney: boolean): string {
  const cols = canSeeMoney
    ? 'amount, amount_paid, amount_remaining, status, locked_at, stripe_invoice_id'
    : 'status, locked_at, stripe_invoice_id';
  return `invoice:invoices!invoice_id(${cols})`;
}

function ordersListSelect(canSeeMoney: boolean): string {
  return `${ORDERS_SAFE_SELECT}, cemetery:cemeteries!cemetery_id(name), order_additional_options(${OPTION_SAFE_SELECT}), quote:quotes!quote_id(product_name), person:people!person_id(is_customer), job:jobs!job_id(id, stage, exit_reason, paid_at, source, lead_source, enquiry:enquiries!enquiry_id(channel, lead_source)), ${invoiceEmbed(canSeeMoney)}`;
}

function orderDetailSelect(canSeeMoney: boolean): string {
  return `${ORDERS_SAFE_SELECT}, customers(id, first_name, last_name), order_additional_options(${OPTION_SAFE_SELECT}), quote:quotes!quote_id(product_name), ${invoiceEmbed(canSeeMoney)}`;
}

const ORDERS_REL_SELECT =
  `${ORDERS_SAFE_SELECT}, order_additional_options(${OPTION_SAFE_SELECT}), quote:quotes!quote_id(product_name)`;

type MoneyRow = {
  id: string;
  order_additional_options?: Array<{ id: string; cost?: number | string | null }> | null;
  value?: number | string | null;
  permit_cost?: number | string | null;
  permit_fee?: number | string | null;
  renovation_service_cost?: number | string | null;
  product_config?: string | null;
  additional_options_total?: number | null;
  payment_status?: { deposit_received: boolean; fully_paid: boolean; balance_outstanding: boolean } | null;
};

async function rowsById(table: string, select: string, ids: string[], column = 'id') {
  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100);
    const { data, error } = await supabase.from(table).select(select).in(column, slice);
    if (error) return out;
    out.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
  }
  return out;
}

/**
 * Owners read pounds from the definer views. Non-owners must not request those
 * views: the locked columns 403 in the console even when the error is swallowed.
 * Payment status is yes/no only and stays available.
 */
async function hydrateOrderMoney<T extends MoneyRow>(rows: T[], canSeeMoney = false): Promise<T[]> {
  if (rows.length === 0) return rows;
  const ids = rows.map((row) => row.id);
  const [amounts, configs, options, status] = await Promise.all([
    canSeeMoney
      ? rowsById('order_amounts', 'id, value, permit_cost, permit_fee, renovation_service_cost, additional_options_total', ids)
      : Promise.resolve([]),
    canSeeMoney ? rowsById('order_configs', 'id, product_config', ids) : Promise.resolve([]),
    canSeeMoney ? rowsById('option_amounts', 'id, order_id, cost', ids, 'order_id') : Promise.resolve([]),
    rowsById('order_payment_status', 'id, deposit_received, fully_paid, balance_outstanding', ids),
  ]);
  const amountById = new Map(amounts.map((row) => [String(row.id), row]));
  const configById = new Map(configs.map((row) => [String(row.id), row.product_config]));
  const costById = new Map(options.map((row) => [String(row.id), row.cost]));
  const statusById = new Map(status.map((row) => [String(row.id), row]));
  return rows.map((row) => {
    const amount = amountById.get(row.id);
    const flags = statusById.get(row.id);
    const optionRows = (row.order_additional_options ?? []).map((opt) => ({
      ...opt,
      cost: (costById.get(opt.id) as number | string | null | undefined) ?? null,
    }));
    return {
      ...row,
      ...(amount
        ? {
            value: amount.value as number | string | null,
            permit_cost: amount.permit_cost as number | string | null,
            permit_fee: amount.permit_fee as number | string | null,
            renovation_service_cost: amount.renovation_service_cost as number | string | null,
            additional_options_total: amount.additional_options_total as number | null,
          }
        : {}),
      product_config: (configById.get(row.id) as string | null | undefined) ?? row.product_config ?? null,
      order_additional_options: optionRows,
      payment_status: flags
        ? {
            deposit_received: flags.deposit_received === true,
            fully_paid: flags.fully_paid === true,
            balance_outstanding: flags.balance_outstanding === true,
          }
        : null,
    };
  });
}

async function hydrateOptionCosts<T extends { id: string; cost?: number | null }>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;
  const costs = await rowsById('option_amounts', 'id, cost', rows.map((row) => row.id));
  const byId = new Map(costs.map((row) => [String(row.id), row.cost]));
  return rows.map((row) => ({ ...row, cost: (byId.get(row.id) as number | null | undefined) ?? null }));
}

/** Every order (paged past the 1,000-row cap), same shape as fetchOrders. Read-only. */
export async function fetchAllOrdersPaged(organizationId: string, options: { excludeTest?: boolean; canSeeMoney?: boolean } = {}) {
  const canSeeMoney = options.canSeeMoney === true;
  const rows = await fetchAllPages((from, to) => {
    let q = supabase.from('orders').select(ordersListSelect(canSeeMoney)).eq('organization_id', organizationId);
    if (options.excludeTest) q = q.eq('is_test', false);
    return q.order('created_at', { ascending: false }).order('id').range(from, to);
  });
  return mapOrderRows(await hydrateOrderMoney(rows as unknown as MoneyRow[], canSeeMoney));
}

export async function fetchOrders(
  organizationId: string,
  options: { excludeTest?: boolean; includeArchived?: boolean; canSeeMoney?: boolean } = {}
) {
  const canSeeMoney = options.canSeeMoney === true;
  try {
    const rows = await fetchAllPages((from, to) => {
      let query = supabase
        .from('orders')
        .select(ordersListSelect(canSeeMoney))
        .eq('organization_id', organizationId);
      if (options.excludeTest) query = query.eq('is_test', false);
      // Archived rows are the legacy pre-cutover quote orders; hidden unless explicitly requested.
      if (!options.includeArchived) query = query.is('archived_at', null);
      return query.order('created_at', { ascending: false }).order('id').range(from, to);
    });
    return mapOrderRows(await hydrateOrderMoney(rows as unknown as MoneyRow[], canSeeMoney));
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Failed to fetch orders';
    throw new Error(message);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrderRows(data: any[]) {
  return data.map((row) => {
    const normalizedOrder = normalizeOrder(attachQuoteProductName(row) as unknown as RawOrder);
    const options = row.order_additional_options || [];
    const optionsTotal = options.reduce((sum: number, opt: { cost?: number | string | null }) => {
      const cost = typeof opt.cost === 'string' ? parseFloat(opt.cost) : (opt.cost ?? 0);
      return sum + (Number.isFinite(cost) ? cost : 0);
    }, 0);
    normalizedOrder.additional_options_total = Number.isFinite(optionsTotal) ? optionsTotal : 0;
    return normalizedOrder;
  });
}

export async function fetchOrder(id: string, organizationId: string, options: { canSeeMoney?: boolean } = {}) {
  const canSeeMoney = options.canSeeMoney === true;
  const { data, error } = await supabase
    .from('orders')
    .select(orderDetailSelect(canSeeMoney))
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single();
  
  if (error) throw error;
  if (data) {
    const [hydrated] = await hydrateOrderMoney([data as unknown as MoneyRow], canSeeMoney);
    const orderAdditionalOptions = hydrated.order_additional_options || [];
    const withQuoteProductName = {
      ...hydrated,
      quote_product_name: (hydrated as { quote?: { product_name?: string | null } | null }).quote?.product_name ?? null,
    };
    const normalizedOrder = normalizeOrder(withQuoteProductName as unknown as RawOrder);
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

  const { data: opOrder, error: opOrderErr } = await supabase
    .from('orders')
    .select('organization_id')
    .eq('id', orderId)
    .single();
  if (opOrderErr) throw opOrderErr;
  if (!opOrder?.organization_id) throw new Error('Order has no organization_id');

  const rows = normalized.map((p) => ({
    order_id: orderId,
    person_id: p.person_id,
    is_primary: p.is_primary,
    organization_id: opOrder.organization_id,
  }));

  const { error: insErr } = await supabase.from('order_people').insert(rows);
  if (insErr) throw insErr;

  // Mirror primary to orders
  const primary = normalized.find((p) => p.is_primary);
  if (primary) {
    const { data: customer } = await supabase
      .from('people')
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
    .select(ORDERS_REL_SELECT)
    .eq('person_id', personId)
    .eq('organization_id', organizationId)
    // Archived orders (quote-to-job cutover) must not feed inbox bucketing / open-order checks.
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return mapOrderRows(await hydrateOrderMoney((data || []) as unknown as MoneyRow[]));
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
    .select(ORDERS_REL_SELECT)
    .eq('organization_id', organizationId)
    .in('person_id', personIds)
    // Archived orders (quote-to-job cutover) must not feed inbox bucketing / open-order checks.
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return mapOrderRows(await hydrateOrderMoney((data || []) as unknown as MoneyRow[]));
}

/**
 * Fetch all orders associated with a specific invoice (includes additional_options for cost breakdown)
 * @param invoiceId - UUID of the invoice
 * @returns Array of Order objects ordered by creation date (newest first)
 */
export async function fetchOrdersByInvoice(invoiceId: string, organizationId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDERS_REL_SELECT)
    .eq('invoice_id', invoiceId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return mapOrderRows(await hydrateOrderMoney((data || []) as unknown as MoneyRow[]));
}

/**
 * Fetch all orders associated with a specific job (includes additional_options for cost breakdown)
 * @param jobId - UUID of the job
 * @returns Array of Order objects ordered by creation date (newest first)
 */
export async function fetchOrdersByJobId(jobId: string, organizationId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDERS_REL_SELECT)
    .eq('job_id', jobId)
    .eq('organization_id', organizationId)
    // Archived orders (quote-to-job cutover) must not feed the Order context panel or summon
    // its Create-invoice button — S5 provenance stamps gave archived quote orders a job_id.
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return mapOrderRows(await hydrateOrderMoney((data || []) as unknown as MoneyRow[]));
}

/**
 * Link pre-existing orders to an invoice (FR-6: org-scoped update, never re-create).
 * The `invoice_id IS NULL` guard means this can never silently re-point an
 * already-invoiced order — callers filter to uninvoiced orders, this enforces it.
 */
export async function linkOrdersToInvoice(
  orderIds: string[],
  invoiceId: string,
  organizationId: string,
) {
  if (orderIds.length === 0) return;
  const { error } = await supabase
    .from('orders')
    .update({ invoice_id: invoiceId })
    .in('id', orderIds)
    .eq('organization_id', organizationId)
    .is('invoice_id', null);

  if (error) throw error;
}

export async function createOrder(order: OrderInsert, organizationId: string) {
  // An order for a person with no ACTIVE job auto-creates one (P2, quote-to-job-pipeline), so
  // the job_id-gated stage automation in useCreateOrder's onSuccess fires. A person who already
  // has an active job is left unlinked here — attaching to an existing job is the deferred
  // person-wide job picker (OQ-C).
  let jobId = order.job_id ?? null;
  if (!jobId && order.person_id) {
    try {
      const { data: activeJobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('person_id', order.person_id)
        .is('exit_reason', null)
        .limit(1);
      if (jobsError) throw jobsError;
      if ((activeJobs ?? []).length === 0) {
        const { data: newJob, error: jobInsertError } = await supabase
          .from('jobs')
          .insert({
            organization_id: organizationId,
            person_id: order.person_id,
            source: 'manual',
            stage: 'enquired',
            stage_status: 'uncontacted',
          })
          .select('id')
          .single();
        if (jobInsertError) throw jobInsertError;
        jobId = newJob.id;
      }
    } catch (autoJobError) {
      // Order creation must never fail because of job automation.
      console.error('[createOrder] auto-create job failed; creating order without job', autoJobError);
      jobId = order.job_id ?? null;
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({ ...order, job_id: jobId, organization_id: organizationId })
    .select(ORDERS_SAFE_SELECT)
    .single();
  
  if (error) throw error;
  const [hydrated] = await hydrateOrderMoney([data as unknown as MoneyRow]);
  return normalizeOrder(hydrated as unknown as RawOrder);
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
  const amounts = await supabase.from('quote_amounts').select('value, permit_cost, total_value').eq('id', quoteId).maybeSingle();
  const merged = {
    ...(data as unknown as Record<string, unknown>),
    value: amounts.data?.value ?? null,
    permit_cost: amounts.data?.permit_cost ?? null,
    total_value: amounts.data?.total_value ?? null,
  };
  return merged as unknown as QuoteForOrderConversion;
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
  // Convert path must never leave order_type as quote (caller fields cannot stick it).
  merged.order_type = resolvePaidCustomerOrderType(merged);
  const created = await createOrder(merged, organizationId);
  await upsertOrderPeople(created.id, [{ person_id: quote.customer_id, is_primary: true }]);
  return fetchOrder(created.id, organizationId);
}

export async function updateOrder(id: string, updates: OrderUpdate) {
  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select(ORDERS_SAFE_SELECT)
    .single();
  
  if (error) throw error;
  const [hydrated] = await hydrateOrderMoney([data as unknown as MoneyRow]);
  return normalizeOrder(hydrated as unknown as RawOrder);
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
    .select(OPTION_SAFE_SELECT)
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return hydrateOptionCosts((data ?? []) as unknown as OrderAdditionalOption[]);
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
  // Stamp organization_id from the parent order so the RLS with_check passes.
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('organization_id')
    .eq('id', option.order_id)
    .single();
  if (orderErr) throw orderErr;
  if (!order?.organization_id) throw new Error('Order has no organization_id');

  const { data, error } = await supabase
    .from('order_additional_options')
    .insert({ ...option, organization_id: order.organization_id })
    .select(OPTION_SAFE_SELECT)
    .single();
  if (error) throw error;
  const [hydrated] = await hydrateOptionCosts([data as unknown as OrderAdditionalOption]);
  return hydrated;
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
    .select(OPTION_SAFE_SELECT)
    .single();
  
  if (error) throw error;
  const [hydrated] = await hydrateOptionCosts([data as unknown as OrderAdditionalOption]);
  return hydrated;
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

