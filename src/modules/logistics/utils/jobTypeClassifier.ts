export type JobBucket = 'kerb' | 'other';

export interface JobLike {
  order_type?: string | null;
}

export function classifyJob(order: JobLike): JobBucket {
  return order.order_type === 'Kerb Set' ? 'kerb' : 'other';
}

export function isKerb(order: JobLike): boolean {
  return classifyJob(order) === 'kerb';
}
