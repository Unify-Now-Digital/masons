/**
 * Utility functions for formatting order IDs for display
 * Centralized formatting ensures consistent display of order identifiers across the app
 */

/**
 * Format order number as human-friendly ID (e.g., ORD-000123)
 * @param orderNumber - Numeric order number
 * @returns Formatted string (ORD-xxxxxx, padded to 6 digits)
 */
export function formatOrderNumber(orderNumber: number): string {
  return `ORD-${String(orderNumber).padStart(6, '0')}`;
}

/**
 * Get display ID for an order (friendly format or UUID fallback)
 * @param order - Order object with id and optional order_number
 * @returns Formatted order ID (ORD-xxxxxx if order_number exists, else UUID)
 */
export function getOrderDisplayId(order: { id: string; order_number?: number | null }): string {
  if (order.order_number != null && typeof order.order_number === 'number') {
    return formatOrderNumber(order.order_number);
  }
  return order.id; // UUID fallback
}

/**
 * Get shortened display ID for tight UI spaces (e.g., table cells)
 * @param order - Order object with id and optional order_number
 * @returns Short formatted ID (ORD-xxxxxx or shortened UUID like "e0f4916d…")
 */
export function getOrderDisplayIdShort(order: { id: string; order_number?: number | null }): string {
  if (order.order_number != null && typeof order.order_number === 'number') {
    return formatOrderNumber(order.order_number);
  }
  // Shorten UUID: first 8 chars + ellipsis
  return `${order.id.substring(0, 8)}…`;
}
