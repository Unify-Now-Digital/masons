import type { Order } from '../types/orders.types';

/**
 * Canonical label for an order line: "<order type> — <name>".
 * Name chain: custom_product_name → product name (via optional map) → material · colour → 'Memorial'.
 * sku is deliberately excluded — it holds the grave number, not a product name.
 * NOTE: the same rule is implemented server-side in stripe-create-invoice,
 * stripe-create-invoice-payment-link, and stripe-create-checkout-session — keep in sync.
 */
export function orderLineLabel(
  order: Pick<Order, 'order_type' | 'renovation_service_description' | 'custom_product_name' | 'product_id' | 'material' | 'color'>,
  productNameById?: Map<string, string>,
): string {
  if (order.order_type === 'Renovation') {
    return `Renovation — ${order.renovation_service_description?.trim() || 'Renovation service'}`;
  }
  const name =
    order.custom_product_name?.trim()
    || (order.product_id ? productNameById?.get(order.product_id) : undefined)?.trim()
    || [order.material?.trim(), order.color?.trim()].filter(Boolean).join(' · ')
    || 'Memorial';
  const typeSegment = order.order_type?.trim() || 'Order';
  return `${typeSegment} — ${name}`;
}
