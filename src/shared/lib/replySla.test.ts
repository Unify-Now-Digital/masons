import { describe, expect, it } from 'vitest';
import { LANE_RULE_TEXT, REPLY_SLA_HOURS, replySlaHours } from './replySla';
import { BUCKET_SLA } from '@/modules/inbox/utils/inboxBuckets';

describe('reply SLAs', () => {
  it('matches the approved hours', () => {
    expect(REPLY_SLA_HOURS).toEqual({ Sales: 24, CS: 24, Permits: 48, Finance: 72 });
    expect(replySlaHours('unknown')).toBe(24);
    expect(LANE_RULE_TEXT.Finance).toBe('We aim to reply within three days');
    expect(Object.values(LANE_RULE_TEXT).join(' ')).not.toMatch(/SLA|72h/);
  });
  it('drives the inbox bucket timers', () => {
    expect(BUCKET_SLA.enquiry.usOwesMs).toBe(24 * 3_600_000);
    expect(BUCKET_SLA.order.usOwesMs).toBe(24 * 3_600_000);
    expect(BUCKET_SLA.cemetery.usOwesMs).toBe(48 * 3_600_000);
  });
});
