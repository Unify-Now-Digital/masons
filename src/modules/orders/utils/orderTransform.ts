import type { Order } from '../types/orders.types';
import { getOrderTotalFormatted, getOrderTotal } from './orderCalculations';

// UI-friendly order format (for display in tables/sidebars)
export interface UIOrder {
  id: string;
  customer: string;
  deceasedName: string;
  personId?: string | null; // NEW
  fallbackPhone?: string | null; // NEW
  fallbackEmail?: string | null; // NEW
  type: string;
  stoneStatus: string;
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
}

/**
 * Transform database order to UI-friendly format
 */
export function transformOrderForUI(order: Order): UIOrder {
  // Resolve customer name: prefer person_name, else derive from joined customer, else "—"
  const customerName = order.person_name 
    || (order.customers ? `${order.customers.first_name} ${order.customers.last_name}` : null)
    || '—';

  return {
    id: order.id,
    customer: customerName, // Person name (resolved)
    deceasedName: order.customer_name, // Deceased name (from customer_name)
    personId: order.person_id, // NEW
    fallbackPhone: order.customer_phone, // NEW
    fallbackEmail: order.customer_email, // NEW
    type: order.order_type,
    stoneStatus: order.stone_status,
    permitStatus: order.permit_status,
    proofStatus: order.proof_status,
    dueDate: order.due_date || '',
    depositDate: order.deposit_date || '',
    secondPaymentDate: order.second_payment_date || null,
    installationDate: order.installation_date || null,
    value: getOrderTotalFormatted(order), // Includes base value + permit cost + additional options (formatted for display)
    total: getOrderTotal(order), // Numeric total for sorting (base + permit cost + additional options)
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
  };
}

/**
 * Transform array of database orders to UI format
 */
export function transformOrdersForUI(orders: Order[]): UIOrder[] {
  return orders.map(transformOrderForUI);
}

