import type { Order } from '@/modules/orders/types/orders.types';

export type JobBucket = 'kerb' | 'other';

export function classifyJob(order: Pick<Order, 'order_type'>): JobBucket {
  return order.order_type === 'Kerb Set' ? 'kerb' : 'other';
}

export function isKerb(order: Pick<Order, 'order_type'>): boolean {
  return classifyJob(order) === 'kerb';
}
