import type { CustomerThreadRow } from '@/modules/inbox/types/inbox.types';
import type { AgingInfo, InboxBucket } from '@/modules/inbox/utils/inboxBuckets';

export type BucketAging = { bucket: InboxBucket; aging: AgingInfo | null };

export function groupWorstAging(
  row: CustomerThreadRow,
  bucketAndAgingByConversationId: Map<string, BucketAging>,
): BucketAging | null {
  let worstUs: BucketAging | null = null;
  let worstThem: BucketAging | null = null;
  for (const id of row.conversationIds) {
    const entry = bucketAndAgingByConversationId.get(id);
    if (!entry?.aging) continue;
    if (entry.aging.ball.side === 'us') {
      if (!worstUs || entry.aging.ball.sinceMs > worstUs.aging!.ball.sinceMs) worstUs = entry;
    } else {
      if (!worstThem || entry.aging.ball.sinceMs > worstThem.aging!.ball.sinceMs) worstThem = entry;
    }
  }
  return worstUs ?? worstThem;
}
