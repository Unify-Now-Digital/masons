import React from 'react';
import { cn } from '@/shared/lib/utils';

/**
 * Inbox row mock variants (feat/mason-inbox-rows), switch with ?rows=a|b|c.
 * No param = the current production row. Style-only: same data, same ActionChip
 * (universal next-action colours from src/shared/nextAction.ts).
 * Spacing: strict 4/8/12/16/24/32 scale (Tailwind 1/2/3/4/6/8). Rows use 12px
 * horizontal padding so content lines up with the search icon (left-3) and the
 * column header's left edge.
 *  A: flat list, hairline dividers, initials avatar, 12px vertical padding.
 *  B: subtle card per row, 8px gap between cards.
 *  C: Front-style: unread = bold + dot, 4px left bar in the next-action colour,
 *     metadata right-aligned.
 * Names no longer share line 1 with the source label (moved to line 2), so a
 * name only competes with the timestamp.
 */
export type RowsVariant = 'a' | 'b' | 'c';
export function readRowsVariant(): RowsVariant | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('rows');
  return v === 'a' || v === 'b' || v === 'c' ? v : null;
}

export type RowTone = 'red' | 'amber' | 'blue' | 'none';
const BAR: Record<RowTone, string> = {
  red: 'bg-gardens-na-red',
  amber: 'bg-gardens-na-amber',
  blue: 'bg-gardens-na-blue',
  none: 'bg-transparent',
};

interface Props {
  variant: RowsVariant;
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

export const InboxRowVariant: React.FC<Props> = ({
  variant, title, initials, source, time, preview, hasPreview, isUnread, selected, tone, pill, meta, metaTitle, onSelect,
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
        'flex-1 min-w-0 m-0 text-[12px] leading-4 truncate',
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
    'data-row-variant': variant,
    'aria-current': selected ? ('true' as const) : undefined,
    onClick: onSelect,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
    },
  };
  const focus = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc/30 cursor-pointer transition-colors';

  if (variant === 'a') {
    return (
      <div
        {...common}
        className={cn(
          'w-full text-left flex items-start gap-3 px-3 py-3',
          focus,
          selected ? 'bg-gardens-acc-lt shadow-[inset_2px_0_0_var(--g-acc)]' : 'bg-gardens-surf2 hover:bg-gardens-page',
        )}
      >
        <span className="relative shrink-0">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold',
              selected ? 'bg-gardens-acc text-white' : 'bg-gardens-page text-gardens-txs border border-gardens-bdr',
            )}
            aria-hidden
          >
            {initials}
          </span>
          {isUnread && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-gardens-surf2 bg-gardens-acc" aria-label="Unread" role="img" />}
        </span>
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2 min-w-0">{name}{timeEl}</div>
          {sourceEl}
          <div className="flex items-center gap-2 min-w-0">{previewEl}{pill}</div>
          {metaEl}
        </div>
      </div>
    );
  }

  if (variant === 'b') {
    return (
      <div
        {...common}
        className={cn(
          'w-full text-left flex flex-col gap-1 rounded-lg border px-3 py-3',
          focus,
          selected
            ? 'bg-gardens-acc-lt border-gardens-acc shadow-sm'
            : 'bg-white border-gardens-bdr shadow-[0_1px_2px_rgba(26,24,21,0.06)] hover:border-gardens-txm',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-gardens-acc" aria-label="Unread" role="img" />}
          {name}
          {timeEl}
        </div>
        {sourceEl}
        <div className="flex items-center gap-2 min-w-0">{previewEl}</div>
        {(pill || metaEl) && (
          <div className="flex items-center gap-2 min-w-0 pt-1">
            <div className="min-w-0 flex-1">{metaEl}</div>
            {pill}
          </div>
        )}
      </div>
    );
  }

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
