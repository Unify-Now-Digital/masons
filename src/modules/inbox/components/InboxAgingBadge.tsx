import React from 'react';
import { cn } from '@/shared/lib/utils';
import {
  AGING_LEVEL_STYLES,
  BUCKET_LABEL,
  BUCKET_SLA_HOURS,
  type AgingInfo,
  type InboxBucket,
} from '@/modules/inbox/utils/inboxBuckets';

interface InboxAgingBadgeProps {
  bucket: InboxBucket;
  aging: AgingInfo;
  /** When true, hide the bucket-name tail; useful in cramped rows. */
  compact?: boolean;
  className?: string;
}

/**
 * Compact pill: "{bucket} · {age}". Background colour reflects how close the
 * thread is to its bucket SLA (green / amber / red).
 */
export const InboxAgingBadge: React.FC<InboxAgingBadgeProps> = ({
  bucket,
  aging,
  compact = false,
  className,
}) => {
  const styles = AGING_LEVEL_STYLES[aging.level];
  const slaHours = BUCKET_SLA_HOURS[bucket];
  const title = `${BUCKET_LABEL[bucket]} · ${aging.shortLabel} since last activity (SLA ${slaHours}h)`;

  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-semibold leading-none',
        styles.container,
        className
      )}
    >
      <span>{aging.shortLabel}</span>
      {!compact && (
        <span className={cn('font-medium', styles.tail)}>· {BUCKET_LABEL[bucket]}</span>
      )}
    </span>
  );
};
