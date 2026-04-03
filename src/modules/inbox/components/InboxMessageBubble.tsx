import React from 'react';
import { Reply } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface InboxMessageBubbleProps {
  /** Inbound = left, outbound = right, note = internal note (dashed border, centered) */
  direction: 'inbound' | 'outbound' | 'note';
  /** Primary sender display name (e.g. customer name, or "You") */
  senderName?: string | null;
  /** Message channel (for compact badge in header row) */
  channel?: 'email' | 'sms' | 'whatsapp' | null;
  /** Optional meta line (e.g. subject/from/to) shown secondary */
  metaLine?: string | null;
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

/** Message bubble for thread. Inbound = white card; outbound = terracotta tint; note = dashed border. */
export const InboxMessageBubble: React.FC<InboxMessageBubbleProps> = ({
  direction,
  senderName,
  channel,
  metaLine,
  children,
  timestamp,
  onReply,
  onClick,
  className,
}) => {
  const isInbound = direction === 'inbound';
  const isNote = direction === 'note';
  const channelLabel =
    channel === 'email' ? 'Email' : channel === 'whatsapp' ? 'WhatsApp' : channel === 'sms' ? 'SMS' : null;

  return (
    <div
      role={onClick ? 'button' : undefined}
      className={cn(
        'flex min-w-0',
        isNote ? 'justify-start' : isInbound ? 'justify-start' : 'justify-end',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className={cn('min-w-0', isNote ? 'max-w-full w-full' : 'max-w-[74%]')}>
        {/* Header row: sender name, channel badge, timestamp */}
        <div className={cn('mb-1.5 flex items-center gap-2 min-w-0', isInbound || isNote ? 'pr-2' : 'pl-2')}>
          <span className={cn(
            'text-[13px] font-semibold truncate',
            isNote ? 'text-gardens-txm' : 'text-gardens-tx'
          )}>
            {senderName || (isInbound ? 'Customer' : 'You')}
          </span>
          {channelLabel && !isNote && (
            <span className="inline-flex items-center gap-1 rounded-md bg-gardens-page px-1.5 py-0.5 text-[10px] font-medium text-gardens-txs shrink-0">
              {channelLabel}
            </span>
          )}
          {!!timestamp && (
            <span className="text-[11px] text-gardens-txm shrink-0 whitespace-nowrap">{timestamp}</span>
          )}
        </div>

        <div
          className={cn(
            'min-w-0 rounded-lg px-4 py-3 overflow-hidden',
            isNote
              ? 'border border-dashed border-gardens-bdr2 bg-transparent'
              : isInbound
                ? 'bg-gardens-surf2 text-gardens-tx border border-gardens-bdr shadow-sm'
                : 'bg-gardens-acc-lt text-gardens-tx border border-[#E8D0B8] shadow-sm'
          )}
        >
          {metaLine && (
            <p className="text-[11px] text-gardens-txm truncate mb-1.5">{metaLine}</p>
          )}
          <div className={cn(
            'text-[13px] leading-relaxed whitespace-pre-wrap break-words',
            isNote ? 'text-gardens-txs' : 'text-gardens-tx'
          )}>
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
                className="inline-flex items-center gap-1 text-[11px] text-gardens-txm hover:text-gardens-tx"
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
