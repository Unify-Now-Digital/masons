import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCustomer } from '@/modules/customers/hooks/useCustomers';
import { useConversationsList } from '@/modules/inbox/hooks/useInboxConversations';
import {
  buildConversationIdByChannelFromMessages,
  useCustomerMessages,
  useUnlinkedHandleTimeline,
} from '@/modules/inbox/hooks/useInboxMessages';
import { ConversationHeader } from './ConversationHeader';
import { ConversationSummaryBanner } from './ConversationSummaryBanner';
import { ConversationThread } from './ConversationThread';
import { useThreadSummary } from '@/modules/inbox/hooks/useThreadSummary';
import { LinkConversationModal } from './LinkConversationModal';
import type { CustomersSelection, InboxMessage } from '@/modules/inbox/types/inbox.types';

const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

interface CustomerConversationViewProps {
  customersSelection: CustomersSelection | null;
  onLinkedToPerson?: (personId: string) => void;
  onRequestNewConversation?: (args: { channel: 'email' | 'whatsapp'; personId: string }) => void;
}

export const CustomerConversationView: React.FC<CustomerConversationViewProps> = ({
  customersSelection,
  onLinkedToPerson,
  onRequestNewConversation,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [displayMessages, setDisplayMessages] = useState<InboxMessage[]>([]);

  const selectionChannelKey =
    customersSelection == null
      ? null
      : customersSelection.type === 'linked'
        ? customersSelection.personId
        : customersSelection.type === 'unlinked'
          ? `${customersSelection.channel}:${customersSelection.handle}`
          : null;

  useEffect(() => {
    setDisplayMessages([]);
  }, [selectionChannelKey]);

  const linkedPersonId =
    customersSelection?.type === 'linked' ? customersSelection.personId : null;
  const unlinkedTarget =
    customersSelection?.type === 'unlinked'
      ? { channel: customersSelection.channel, handle: customersSelection.handle }
      : null;

  const threadSummaryParams =
    linkedPersonId != null
      ? ({ scope: 'customer_timeline' as const, personId: linkedPersonId } as const)
      : unlinkedTarget != null
        ? ({
            scope: 'unlinked_timeline' as const,
            channel: unlinkedTarget.channel,
            handle: unlinkedTarget.handle,
          } as const)
        : ({ scope: 'customer_timeline' as const, personId: null } as const);

  const threadSummary = useThreadSummary(threadSummaryParams);

  const { data: person } = useCustomer(linkedPersonId ?? '');
  const { data: conversations = [] } = useConversationsList(
    linkedPersonId ? { status: 'open', person_id: linkedPersonId } : undefined,
    { enabled: !!linkedPersonId && linkModalOpen }
  );

  const { data: unlinkedConversations = [] } = useConversationsList(
    unlinkedTarget
      ? {
          status: 'open',
          unlinked_only: true,
          channel: unlinkedTarget.channel,
          primary_handle_exact: unlinkedTarget.handle,
        }
      : undefined,
    { enabled: !!unlinkedTarget && linkModalOpen }
  );

  const bulkConversationIds = linkedPersonId
    ? conversations.map((c) => c.id)
    : unlinkedConversations.map((c) => c.id);
  const representativeConversationId = bulkConversationIds[0] ?? '';
  const representativeConversation =
    linkedPersonId ? conversations[0] : unlinkedConversations[0];
  const canLink = bulkConversationIds.length > 0;

  const personMessages = useCustomerMessages(linkedPersonId);
  const unlinkedMessages = useUnlinkedHandleTimeline(
    unlinkedTarget?.channel ?? null,
    unlinkedTarget?.handle ?? null
  );

  const messages = linkedPersonId ? personMessages.messages : unlinkedMessages.messages;
  const isLoading = linkedPersonId ? personMessages.isLoading : unlinkedMessages.isLoading;
  const isError = linkedPersonId ? personMessages.isError : unlinkedMessages.isError;

  useEffect(() => {
    if (isLoading) return;
    setDisplayMessages(messages);
  }, [messages, isLoading]);

  const personDisplay = person
    ? [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || person.email || person.phone || '—'
    : '—';

  const enabledReplyChannels =
    customersSelection?.type === 'unlinked'
      ? [customersSelection.channel]
      : customersSelection?.type === 'linked' && person
        ? [
            ...(person.email?.trim() ? (['email'] as const) : []),
            ...(person.phone?.trim() ? (['sms', 'whatsapp'] as const) : []),
          ]
        : undefined;

  const headerTitle = linkedPersonId ? personDisplay : (unlinkedTarget?.handle ?? '—');
  const handleLine = linkedPersonId
    ? 'all channels'
    : unlinkedTarget
      ? CHANNEL_LABEL[unlinkedTarget.channel] ?? unlinkedTarget.channel
      : '—';
  const linkStateLabel = linkedPersonId ? 'Linked' : unlinkedTarget ? 'Unlinked' : '';

  const summaryBannerBusy =
    threadSummary.isFetching && !!threadSummary.summary?.trim();

  const showSummarySlot =
    summaryBannerBusy ||
    threadSummary.error != null ||
    !!(threadSummary.summary && threadSummary.summary.trim());

  const { conversationIdByChannel, defaultChannel } = useMemo(() => {
    const map = buildConversationIdByChannelFromMessages(displayMessages);
    const latestInbound = displayMessages
      .slice()
      .reverse()
      .find((m) => m.direction === 'inbound')?.channel ?? null;
    const firstEnabled = (['email', 'sms', 'whatsapp'] as const).find((channel) => !!map[channel]) ?? 'email';
    return {
      conversationIdByChannel: map,
      defaultChannel: latestInbound ?? firstEnabled,
    };
  }, [displayMessages]);

  const autoScrollResetKey =
    linkedPersonId ?? (unlinkedTarget ? `unlinked:${unlinkedTarget.channel}:${unlinkedTarget.handle}` : '');

  if (!customersSelection) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-6">
        <p className="text-sm text-gardens-txs">Select a customer thread to view messages</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-6">
        <p className="text-sm text-gardens-txs">Unable to load customer timeline</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
      <div className="shrink-0">
        <LinkConversationModal
          open={linkModalOpen && canLink}
          onOpenChange={setLinkModalOpen}
          conversationId={representativeConversationId}
          conversationIds={bulkConversationIds}
          conversationPersonId={linkedPersonId}
          candidates={representativeConversation?.link_meta?.candidates}
          onLinked={(personId) => onLinkedToPerson?.(personId)}
          onUnlinked={() => {
            // Keep selection behaviour consistent with existing Customers-tab effects.
            setLinkModalOpen(false);
          }}
        />
        <ConversationHeader
          displayName={headerTitle}
          handleLine={handleLine}
          linkStateLabel={linkStateLabel}
          actionButtonLabel={linkedPersonId ? 'Change link' : 'Link person'}
          onActionClick={() => {
            if (!canLink) return;
            setLinkModalOpen(true);
          }}
          summarySlot={
            showSummarySlot ? (
              <ConversationSummaryBanner
                summary={threadSummary.summary}
                isLoading={summaryBannerBusy}
                error={threadSummary.error}
              />
            ) : undefined
          }
        />
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {isLoading && displayMessages.length === 0 ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <p className="text-sm text-gardens-txs">Loading messages...</p>
          </div>
        ) : (
          <ConversationThread
            messages={displayMessages}
            readOnly={false}
            conversationIdByChannel={conversationIdByChannel}
            defaultChannel={defaultChannel}
            participantName={headerTitle}
            scrollContainerRef={scrollContainerRef}
            conditionalAutoScroll
            autoScrollResetKey={autoScrollResetKey}
            sendChannelOnlyMode
            linkedInboxPersonId={linkedPersonId}
            showEmailSubjectInHeader
            enabledReplyChannels={enabledReplyChannels}
            startConversationContext={
              linkedPersonId && person
                ? {
                    personId: linkedPersonId,
                    email: person.email ?? null,
                    phone: person.phone ?? null,
                  }
                : null
            }
            onRequestStartConversation={
              linkedPersonId && person && onRequestNewConversation
                ? (ch) => {
                    const ok =
                      ch === 'email' ? !!person.email?.trim() : !!person.phone?.trim();
                    if (!ok) return;
                    onRequestNewConversation({ channel: ch, personId: linkedPersonId });
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
};
