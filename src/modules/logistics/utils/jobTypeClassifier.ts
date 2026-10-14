export type JobBucket = 'kerb' | 'other';

/** Accepts order rows (`order_type`) and schedule stops (`orderType`). */
export interface JobLike {
  order_type?: string | null;
  orderType?: string | null;
}

export function classifyJob(order: JobLike): JobBucket {
  const t = order.order_type ?? order.orderType ?? null;
  return t === 'Kerb Set' ? 'kerb' : 'other';
}

export function isKerb(order: JobLike): boolean {
  return classifyJob(order) === 'kerb';
}
