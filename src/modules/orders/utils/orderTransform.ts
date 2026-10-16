import { resolveAttribution, type LeadChannel, type LeadSource } from '@/shared/lib/leadSource';
import { displayPersonName, tidyStoredName } from '@/shared/lib/personName';
import type { JobStage } from '@/modules/jobsPipeline';
import type { Order } from '../types/orders.types';
import { paymentStatusLabel } from '@/shared/lib/paymentStatusLabel';
import { getOrderTotalFormatted, getOrderTotal } from './orderCalculations';
import { getOrderGroup, type OrderGroup } from './orderGrouping';
import { isInvoiceLocked } from '@/modules/invoicing/utils/invoiceTransform';
import type { SupplierRollup } from '../../../../supabase/functions/_shared/supplierStatus';

// UI-friendly order format (for display in tables/sidebars)
export interface UIOrder {
  id: string;
  order_number: number | null;
  customer: string;
  deceasedName: string;
  personId?: string | null; // NEW
  fallbackPhone?: string | null; // NEW
  fallbackEmail?: string | null; // NEW
  type: string;
  stoneStatus: string;
  /** orders.created_at (ISO); drives the default oldest-first sort. */
  createdAt?: string | null;
  permitStatus: string;
  proofStatus: string;
  dueDate: string;
  depositDate: string;
  secondPaymentDate: string | null;
  installationDate: string | null;
  value: string; // Formatted currency string (includes base + permit cost + additional options)
  total: number; // Numeric total for sorting (base + permit cost + additional options)
  permitCost?: number | null;
  productPhotoUrl?: string | null; // Snapshot of product photo URL (optional for backward compatibility)
  location: string;
  progress: number;
  assignedTo: string;
  priority: string;
  sku: string;
  material: string;
  color: string;
  timelineWeeks: number;
  customerEmail?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  /** Present when order originated from a quote */
  quoteId: string | null;
  /** True when this row is part of seeded demo data (Sears Melvin only). */
  isTest: boolean;
  /**
   * Embedded from people!person_id in the list fetch.
   * @deprecated for the Client badge — use `group` (derived from job.stage) instead.
   */
  person?: { is_customer: boolean } | null;
  /** Derived once from the embedded job; consumed by BOTH the tab filter and the Client badge. */
  group: OrderGroup;
  jobStage: JobStage | null;
  /** Lead attribution from the linked job (then its enquiry); null = not recorded. */
  leadSource: LeadSource | null;
  leadChannel: LeadChannel | null;
  jobPaidAt: string | null;
  /** Exit is an axis, not a tab: exited orders stay in their stage tab with an "Exited" pill. */
  jobExitReason: string | null;
  /** True when the linked invoice is locked (paid/explicitly locked/Stripe-finalized); edits go via Revise. */
  invoiceLocked: boolean;
  /** Paid to date in pounds (order_payments + succeeded invoice payments); undefined = unknown / no money role. */
  amountPaid?: number;
  inscriptionText?: string | null;
  inscriptionStatus?: string | null;
  /** UI-only flag. No column yet — always false unless a row already carries it. */
  permitPreapproved?: boolean;
  permitFormSentAt?: string | null;
  permitSubmittedAt?: string | null;
  permitApprovedAt?: string | null;
  proofUploadedAt?: string | null;
  cemeteryName?: string | null;
  productId?: string | null;
  productName?: string | null;
  /** Parsed from the `Dimensions:` prefix on notes. */
  dimensions?: string | null;
  /** Set when the row is archived. Null on a live order. */
  archivedAt?: string | null;
  /** Not stored. Passed through when a caller already has the date. */
  stoneOrderedAt?: string | null;
  /** Ogee rollup. Null until the board query has loaded. */
  supplier?: SupplierRollup | null;
  /** True only after supplier_jobs has been read. Missing table stays false. */
  supplierLoaded?: boolean;
}

/** Dimensions are stored as a prefix on notes (`Dimensions: 30 × 20 × 3in`). */
export function parseOrderDimensions(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(/^Dimensions:\s*(.+?)(?:\n\n|$)/i);
  const value = match?.[1]?.trim();
  return value || null;
}

/**
 * Transform database order to UI-friendly format
 */
export function transformOrderForUI(order: Order, showMoney = true): UIOrder {
  const joined = order.customers
    ? displayPersonName(order.customers.first_name, order.customers.last_name)
    : null;
  const customerName = tidyStoredName(order.person_name) || joined || '—';

  return {
    id: order.id,
    order_number: order.order_number ?? null,
    customer: customerName, // Person name (resolved)
    deceasedName: tidyStoredName(order.customer_name),
    personId: order.person_id, // NEW
    fallbackPhone: order.customer_phone, // NEW
    fallbackEmail: order.customer_email, // NEW
    type: order.order_type,
    quoteId: order.quote_id ?? null,
    stoneStatus: order.stone_status,
    createdAt: order.created_at ?? null,
    permitStatus: order.permit_status,
    proofStatus: order.proof_status,
    dueDate: order.due_date || '',
    depositDate: order.deposit_date || '',
    secondPaymentDate: order.second_payment_date || null,
    installationDate: order.installation_date || null,
    value: showMoney ? getOrderTotalFormatted(order) : paymentStatusLabel(order.payment_status),
    total: showMoney ? getOrderTotal(order) : 0,
    permitCost: order.permit_cost ?? null,
    productPhotoUrl: order.product_photo_url ?? null, // Snapshot of product photo URL
    location: order.location || '',
    progress: order.progress,
    assignedTo: order.assigned_to || '',
    priority: order.priority,
    sku: order.sku || '',
    material: order.material || '',
    color: order.color || '',
    timelineWeeks: order.timeline_weeks,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    notes: order.notes,
    isTest: order.is_test === true,
    person: order.person ?? null,
    group: getOrderGroup(order.job),
    jobStage: order.job?.stage ?? null,
    leadSource: resolveAttribution(order.job, order.job?.enquiry).source,
    leadChannel: resolveAttribution(order.job, order.job?.enquiry).channel,
    jobPaidAt: order.job?.paid_at ?? null,
    jobExitReason: order.job?.exit_reason ?? null,
    invoiceLocked: order.invoice ? isInvoiceLocked(order.invoice) : false,
    inscriptionText: order.inscription_text ?? null,
    inscriptionStatus: order.inscription_status ?? null,
    permitPreapproved: order.permit_preapproved === true,
    permitFormSentAt: order.permit_form_sent_at ?? null,
    permitSubmittedAt: order.permit_submitted_at ?? null,
    permitApprovedAt: order.permit_approved_at ?? null,
    proofUploadedAt: order.proof_uploaded_at ?? null,
    cemeteryName: order.cemetery?.name ?? null,
    productId: order.product_id ?? null,
    productName: order.custom_product_name?.trim() || order.quote_product_name?.trim() || null,
    dimensions: parseOrderDimensions(order.notes),
    archivedAt: order.archived_at ?? null,
  };
}

/**
 * Transform array of database orders to UI format
 */
export function transformOrdersForUI(orders: Order[], showMoney = true): UIOrder[] {
  return orders.map((order) => transformOrderForUI(order, showMoney));
}

