import React from 'react';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import type { EnquiryPipelineItem } from '@/modules/inbox/api/enquiryPipeline.api';
import type { InboxConversation } from '@/modules/inbox/types/inbox.types';
import { formatConversationTimestamp } from '@/modules/inbox/utils/conversationUtils';
import { cn } from '@/shared/lib/utils';

export interface EnquiryPipelineCardProps {
  item: EnquiryPipelineItem;
  onMarkInProgress: (conversationId: string) => void;
  onSelect: (conversationId: string) => void;
}

function ChannelIcon({ channel }: { channel: InboxConversation['channel'] }) {
  const isWhatsApp = channel === 'whatsapp';
  const isEmail = channel === 'email';
  const Icon = isEmail ? Mail : isWhatsApp ? MessageCircle : Phone;
  return (
    <span
      className={cn(
        'inline-flex shrink-0',
        isWhatsApp ? 'text-gardens-grn-dk' : isEmail ? 'text-gardens-txs' : 'text-gardens-blu'
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
    </span>
  );
}

export const EnquiryPipelineCard: React.FC<EnquiryPipelineCardProps> = ({
  item,
  onMarkInProgress,
  onSelect,
}) => {
  const { conversation, displayName, person } = item;
  const preview = conversation.last_message_preview?.trim() || 'No preview';
  const subject = conversation.subject?.trim();
  const timestamp = formatConversationTimestamp(conversation.last_message_at);
  const showMarkInProgress = (conversation.enquiry_stage ?? 'new') === 'new';
  const secondaryDetail =
    person?.email?.trim() || person?.phone?.trim() || conversation.primary_handle;

  return (
    <div className="border-b border-gardens-bdr bg-white last:border-b-0">
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className="w-full px-3 py-2.5 text-left hover:bg-gardens-page/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc/40"
      >
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <ChannelIcon channel={conversation.channel} />
          <span className="text-[12.5px] font-semibold text-gardens-tx flex-1 truncate">
            {displayName}
          </span>
          <span className="text-[10.5px] text-gardens-txm shrink-0 tabular-nums">{timestamp}</span>
        </div>
        {secondaryDetail && secondaryDetail !== displayName ? (
          <p className="text-[10.5px] text-gardens-txm truncate mb-1">{secondaryDetail}</p>
        ) : null}
        <p className="text-[11.5px] text-gardens-txs leading-snug line-clamp-2">
          {subject ? (
            <>
              <span className="font-semibold text-gardens-tx">{subject}</span>
              {' — '}
            </>
          ) : null}
          {preview}
        </p>
        {conversation.unread_count > 0 ? (
          <p className="mt-1.5 text-[10.5px] font-medium text-gardens-acc-dk">
            {conversation.unread_count} unread
          </p>
        ) : null}
      </button>
      {showMarkInProgress ? (
        <div className="px-3 pb-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkInProgress(conversation.id);
            }}
            className="text-[11px] font-medium text-gardens-grn-dk hover:text-gardens-grn border border-gardens-grn-lt bg-gardens-grn-lt/50 rounded-md px-2 py-1"
          >
            Mark in progress
          </button>
        </div>
      ) : null}
    </div>
  );
};
