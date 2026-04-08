import React from 'react';
import { Reply } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface InboxMessageBubbleProps {
  /** Inbound = left, outbound = right */
  direction: 'inbound' | 'outbound';
  /** Primary sender display name (e.g. customer name, or "You") */
  senderName?: string | null;
  /** Message channel (for compact badge in header row) */
  channel?: 'email' | 'sms' | 'whatsapp' | null;
  /** Optional meta line (e.g. subject/from/to) shown secondary */
  metaLine?: string | null;
  /** Optional email subject shown in the header row (after sender, before channel/time). */
  emailSubjectInHeader?: string | null;
  /** Message body (or custom content for HTML) */
  children: React.ReactNode;
  /** Formatted timestamp */
  timestamp: string;
  /** Show reply button (unified mode) */
  onReply?: () => void;
  /** Click handler for the whole bubble (e.g. open thread in read-only) */
  onClick?: () => void;
  /** Extra class for the bubble container */
  className?: string;
}

/** Message bubble for thread. Inbound = white/light border; outbound = light green. No shadcn. */
export const InboxMessageBubble: React.FC<InboxMessageBubbleProps> = ({
  direction,
  senderName,
  channel,
  metaLine,
  emailSubjectInHeader,
  children,
  timestamp,
  onReply,
  onClick,
  className,
}) => {
  const isInbound = direction === 'inbound';
  const channelLabel =
    channel === 'email' ? 'Email' : channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : null;

  return (
    <div
      role={onClick ? 'button' : undefined}
      className={cn(
        'flex min-w-0',
        isInbound ? 'justify-start' : 'justify-end',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className={cn('min-w-0 max-w-[74%]')}>
        {/* Header row: sender name, channel badge, timestamp */}
        <div
          className={cn(
            'mb-1.5 flex items-center gap-2 min-w-0',
            isInbound ? 'pr-2' : 'pl-2'
          )}
        >
          <span className="text-[13px] font-semibold text-slate-800 truncate">
            {senderName || (isInbound ? 'Customer' : 'You')}
          </span>
          {emailSubjectInHeader != null && (
            <span className="flex-1 min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-slate-600 leading-snug">
              {emailSubjectInHeader}
            </span>
          )}
          {channelLabel && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 shrink-0">
              {channelLabel}
            </span>
          )}
          {!!timestamp && (
            <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">{timestamp}</span>
          )}
        </div>

        <div
          className={cn(
            'min-w-0 rounded-lg px-4 py-3 overflow-hidden',
            'border shadow-sm',
            isInbound
              ? 'bg-slate-100/80 text-slate-900 border-slate-200/90'
              : 'bg-emerald-100/70 text-slate-900 border-emerald-200/80'
          )}
        >
          {metaLine && (
            <p className="text-[11px] text-slate-500 truncate mb-1.5">{metaLine}</p>
          )}
          <div className="text-[13px] leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
            {children}
          </div>
          {onReply && (
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReply();
                }}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700"
                aria-label="Reply"
              >
                <Reply className="h-3 w-3" />
                Reply
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
