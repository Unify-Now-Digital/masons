import React from 'react';
import { cn } from '@/shared/lib/utils';

/**
 * Inbox list row (style C, approved by Arin 15 Oct 2026): hairline dividers (set by the
 * list), unread = bold + dot, 4px left bar in the next-action colour, metadata
 * right-aligned, source label on line 2 so names only compete with the time.
 * Spacing: strict 4/8/12/16/24/32 scale.
 */
export type RowTone = 'red' | 'amber' | 'blue' | 'none';
const BAR: Record<RowTone, string> = {
  red: 'bg-gardens-na-red',
  amber: 'bg-gardens-na-amber',
  blue: 'bg-gardens-na-blue',
  none: 'bg-transparent',
};

interface Props {
  title: string;
  initials: string;
  source: string;
  time: string;
  preview: string;
  hasPreview: boolean;
  isUnread: boolean;
  selected: boolean;
  tone: RowTone;
  pill: React.ReactNode;
  meta: React.ReactNode;
  metaTitle?: string;
  onSelect: () => void;
}

export const InboxRow: React.FC<Props> = ({
  title, initials, source, time, preview, hasPreview, isUnread, selected, tone, pill, meta, metaTitle, onSelect,
}) => {
  const name = (
    <span
      className={cn(
        'font-head text-[14px] leading-5 text-gardens-tx truncate min-w-0',
        isUnread ? 'font-bold' : 'font-medium',
      )}
      title={title}
    >
      {title}
    </span>
  );
  const timeEl = (
    <span className={cn('ml-auto shrink-0 text-[11px] leading-5 whitespace-nowrap tabular-nums', isUnread ? 'text-gardens-tx font-semibold' : 'text-gardens-txm-aa')}>
      {time}
    </span>
  );
  const previewEl = (
    <p
      className={cn(
        'm-0 min-w-0 flex-1 text-[12px] leading-4 max-lg:line-clamp-2 max-lg:whitespace-normal max-lg:break-words lg:truncate',
        !hasPreview ? 'italic text-gardens-txm-aa' : isUnread ? 'font-semibold text-gardens-tx' : 'text-gardens-txs',
      )}
      title={preview}
    >
      {preview}
    </p>
  );
  const metaEl = meta ? (
    <div className="flex items-center gap-1 text-[11px] leading-4 text-gardens-txm-aa min-w-0 whitespace-nowrap overflow-hidden" title={metaTitle}>
      {meta}
    </div>
  ) : null;
  const sourceEl = source ? (
    <span className="text-[11px] leading-4 text-gardens-txm-aa whitespace-nowrap truncate min-w-0">{source}</span>
  ) : null;

  const common = {
    role: 'button' as const,
    tabIndex: 0,
    'data-conv-card': true,
    'aria-current': selected ? ('true' as const) : undefined,
    onClick: onSelect,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
    },
  };
  const focus = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc/30 cursor-pointer transition-colors';

  // C: Front-style
  return (
    <div
      {...common}
      className={cn(
        'relative w-full text-left flex flex-col gap-1 pl-4 pr-3 py-2',
        focus,
        selected ? 'bg-gardens-acc-lt' : isUnread ? 'bg-white hover:bg-gardens-page' : 'bg-gardens-surf2 hover:bg-gardens-page',
      )}
    >
      <span className={cn('absolute left-0 top-0 bottom-0 w-1', selected && tone === 'none' ? 'bg-gardens-acc' : BAR[tone])} aria-hidden />
      <div className="flex items-center gap-2 min-w-0">
        {name}
        {timeEl}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        {previewEl}
        {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-gardens-acc" aria-label="Unread" role="img" />}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <div className="min-w-0 flex-1 flex items-center gap-1 overflow-hidden">
          {sourceEl}
          {sourceEl && metaEl && <span className="text-[11px] text-gardens-txm-aa">·</span>}
          {metaEl}
        </div>
        {pill}
      </div>
    </div>
  );
};
