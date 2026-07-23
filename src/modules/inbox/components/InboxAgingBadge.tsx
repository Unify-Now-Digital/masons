import React from 'react';
import { cn } from '@/shared/lib/utils';
import {
  AGING_LEVEL_STYLES,
  BUCKET_LABEL,
  BUCKET_SLA,
  type AgingBadgeStyle,
  type AgingInfo,
  type InboxBucket,
} from '@/modules/inbox/utils/inboxBuckets';

/** Them-side style when `showSide` is on: informational, no SLA alarm colors. */
const THEM_STYLES: AgingBadgeStyle = {
  container: 'bg-gardens-page text-gardens-txm border-gardens-bdr',
  tail: 'text-gardens-txm/70',
};

interface InboxAgingBadgeProps {
  bucket: InboxBucket;
  aging: AgingInfo;
  /** When true, hide the bucket-name tail; useful in cramped rows. */
  compact?: boolean;
  /** Show an "Us"/"Them" marker; them-side then renders neutral (no SLA colors). */
  showSide?: boolean;
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
  showSide = false,
  className,
}) => {
  const isUs = aging.ball.side === 'us';
  const styles = showSide && !isUs ? THEM_STYLES : AGING_LEVEL_STYLES[aging.level];
  const sla = BUCKET_SLA[bucket];
  const slaHours =
    aging.ball.side === 'us'
      ? `${Math.round(sla.usOwesMs / 3_600_000)}h`
      : `${Math.round(sla.themOwesRedMs / 86_400_000)}d`;
  const ballLabel = aging.ball.side === 'us' ? 'we owe' : 'awaiting them';
  const title = `${BUCKET_LABEL[bucket]} · ${aging.shortLabel} (${ballLabel}; red at ${slaHours})`;

  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-semibold leading-none',
        styles.container,
        className
      )}
    >
      {showSide && (
        <span className={cn('font-medium', styles.tail)}>{isUs ? 'Us' : 'Them'} ·</span>
      )}
      <span>{aging.shortLabel}</span>
      {/* Bucket-name tail hidden for 'enquiry' — the age clock still shows and the
          bucket still drives the SLA colour; 'New enquiry' on every lead row was noise. */}
      {!compact && bucket !== 'enquiry' && (
        <span className={cn('font-medium', styles.tail)}>· {BUCKET_LABEL[bucket]}</span>
      )}
    </span>
  );
};
