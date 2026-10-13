import type { CustomerThreadRow } from '@/modules/inbox/types/inbox.types';
import type { AgingInfo, InboxBucket } from './inboxBuckets';
import { sortChasedFirst, type RowWait } from './inboxRowAction';

type BucketAging = { bucket: InboxBucket; aging: AgingInfo | null };

/** Group wait: us-side (customer chasing) wins, longest first; else longest them-side. */
export function rowWait(row: Pick<CustomerThreadRow, 'conversationIds'>, map: Map<string, BucketAging>): RowWait | null {
  let us: RowWait | null = null;
  let them: RowWait | null = null;
  for (const id of row.conversationIds) {
    const ball = map.get(id)?.aging?.ball;
    if (!ball) continue;
    if (ball.side === 'us') { if (!us || ball.sinceMs > us.sinceMs) us = { side: 'us', sinceMs: ball.sinceMs }; }
    else if (!them || ball.sinceMs > them.sinceMs) them = { side: 'them', sinceMs: ball.sinceMs };
  }
  return us ?? them;
}

/**
 * The ONE Inbox order (chased first, then longest wait). Applied at page level so
 * the default selection is the top row the user sees.
 */
export function sortCustomerRows<T extends Pick<CustomerThreadRow, 'conversationIds'>>(rows: T[], map: Map<string, BucketAging>): T[] {
  return sortChasedFirst(rows, (r) => rowWait(r, map));
}
