import { describe, expect, it } from 'vitest';
import { REPLY_SLA_HOURS, replySlaHours } from './replySla';
import { BUCKET_SLA } from '@/modules/inbox/utils/inboxBuckets';

describe('reply SLAs', () => {
  it('matches the approved hours', () => {
    expect(REPLY_SLA_HOURS).toEqual({ Sales: 24, CS: 24, Permits: 48, Finance: 72 });
    expect(replySlaHours('unknown')).toBe(24);
  });
  it('drives the inbox bucket timers', () => {
    expect(BUCKET_SLA.enquiry.usOwesMs).toBe(24 * 3_600_000);
    expect(BUCKET_SLA.order.usOwesMs).toBe(24 * 3_600_000);
    expect(BUCKET_SLA.cemetery.usOwesMs).toBe(48 * 3_600_000);
  });
});
