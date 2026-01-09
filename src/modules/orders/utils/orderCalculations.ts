import type { Order } from '../types/orders.types';

/**
 * Check if an order is a Renovation order type
 * Uses the exact string value from the schema enum: 'Renovation'
 */
export function isRenovationOrder(order: Order): boolean {
  return order.order_type === 'Renovation';
}

/**
 * Get the base order value (null treated as 0)
 * - Renovation orders: uses renovation_service_cost as base value
 * - New Memorial orders: uses value field (product-driven)
 */
export function getOrderBaseValue(order: Order): number {
  // Renovation orders use renovation_service_cost as base value
  if (isRenovationOrder(order)) {
    // Defensive guard: if Renovation and renovation_service_cost is null/undefined, treat as 0
    return order.renovation_service_cost ?? 0;
  }
  // New Memorial orders use existing value field (product-driven)
  return order.value ?? 0;
}

/**
 * Get the permit cost (null treated as 0)
 */
export function getOrderPermitCost(order: Order): number {
  return order.permit_cost ?? 0;
}

/**
 * Get the additional options total (null/undefined treated as 0)
 * This value comes from the orders_with_options_total view
 */
export function getOrderAdditionalOptionsTotal(order: Order): number {
  return order.additional_options_total ?? 0;
}

/**
 * Calculate the total order value (base value + permit cost + additional options total)
 * All null/undefined values are treated as 0
 */
export function getOrderTotal(order: Order): number {
  const baseValue = getOrderBaseValue(order);
  const permitCost = getOrderPermitCost(order);
  const optionsTotal = getOrderAdditionalOptionsTotal(order);
  return baseValue + permitCost + optionsTotal;
}

/**
 * Format the order total as GBP currency string (en-GB locale)
 */
export function getOrderTotalFormatted(order: Order): string {
  const total = getOrderTotal(order);
  return `£${total.toLocaleString('en-GB', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
}

