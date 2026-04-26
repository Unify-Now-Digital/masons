import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Mail } from 'lucide-react';
import { useConversation, useConversationsList } from "@/modules/inbox/hooks/useInboxConversations";
import { buildConversationIdByChannel, useMessagesByConversation } from '@/modules/inbox/hooks/useInboxMessages';
import { useCustomer } from '@/modules/customers/hooks/useCustomers';
import { useOrdersByPersonId } from '@/modules/orders/hooks/useOrders';
import { getOrderDisplayId } from '@/modules/orders/utils/orderDisplayId';
import { LinkConversationModal } from './LinkConversationModal';
import { ConversationHeader } from './ConversationHeader';
import { ConversationSummaryBanner } from './ConversationSummaryBanner';
import { ConversationThread } from './ConversationThread';
import { useThreadSummary } from '@/modules/inbox/hooks/useThreadSummary';
import { ChannelSelector } from './ChannelSelector';
import { Button } from '@/shared/components/ui/button';
import {
  LINK_PERSON_FOR_CHANNEL_MESSAGE,
  SMS_NEW_CONVERSATION_NOT_SUPPORTED,
} from '@/modules/inbox/copy/channelSwitchMessages';
import {
  classifyConversation,
  buildCemeteryEmailSet,
  buildPermitThreadIdSet,
  isOrderOpen,
} from '@/modules/inbox/utils/inboxBuckets';
import { useCemeteries } from '@/modules/permitTracker/hooks/useCemeteries';
import { useEnquiryExtractions } from '@/modules/inbox/hooks/useEnquiryExtractions';

const HEADER_ORDERS_MAX = 5;
function formatOrderIdsForHeader(orderIds: string[], max: number = HEADER_ORDERS_MAX): string {
  if (orderIds.length === 0) return '';
  const show = orderIds.slice(0, max);
  const suffix = orderIds.length > max ? ', ...' : '';
  return show.join(', ') + suffix;
}

export interface EmptyChannelContext {
  personId: string | null;
  channel: 'email' | 'sms' | 'whatsapp';
}

interface ConversationViewProps {
  conversationId: string | null;
  /** Empty state only: switch target channel without changing the conversation list filter. */
  onEmptyChannelChange?: (channel: 'email' | 'sms' | 'whatsapp') => void;
  emptyChannelContext?: EmptyChannelContext | null;
  /** Opens new conversation modal (same as Customers tab). */
  onRequestNewConversation?: (args: { channel: 'email' | 'whatsapp'; personId: string }) => void;
  /**
   * Composer channel switch: `conversationId` from the linked person's open conversations map
   * (null → empty state with Start new conversation for that channel).
   */
  onNavigateToChannelConversation?: (args: {
    channel: 'email' | 'sms' | 'whatsapp';
    conversationId: string | null;
  }) => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  conversationId,
  onEmptyChannelChange,
  emptyChannelContext = null,
  onRequestNewConversation,
  onNavigateToChannelConversation,
}) => {
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { data: conversation, isLoading: conversationLoading } = useConversation(conversationId);
  const { data: messages = [] } = useMessagesByConversation(conversationId);
  const { data: person } = useCustomer(conversation?.person_id ?? '');
  const { data: personOrders = [] } = useOrdersByPersonId(conversation?.person_id ?? '');
  const { data: personOpenConversations = [] } = useConversationsList(
    conversation?.person_id ? { status: 'open', person_id: conversation.person_id } : undefined,
    { enabled: !!conversation?.person_id }
  );
  const threadSummary = useThreadSummary({
    scope: 'conversation',
    conversationId: conversationId ?? null,
  });

  const conversationIdByChannel = useMemo(() => {
    if (!conversation) {
      return { email: null, sms: null, whatsapp: null } as const;
    }
    if (!conversation.person_id) {
      const ch = conversation.channel as 'email' | 'sms' | 'whatsapp';
      return {
        email: ch === 'email' ? conversation.id : null,
        sms: ch === 'sms' ? conversation.id : null,
        whatsapp: ch === 'whatsapp' ? conversation.id : null,
      };
    }
    return buildConversationIdByChannel(personOpenConversations, messages);
  }, [conversation, personOpenConversations, messages]);

  const defaultChannel = useMemo((): 'email' | 'sms' | 'whatsapp' => {
    if (!conversation) return 'email';
    return conversation.channel as 'email' | 'sms' | 'whatsapp';
  }, [conversation]);

  const enabledReplyChannels = useMemo(() => {
    if (!conversation) return undefined;
    if (!conversation.person_id) {
      return [conversation.channel as 'email' | 'sms' | 'whatsapp'];
    }
    if (!person) return undefined;
    return [
      ...(person.email?.trim() ? (['email'] as const) : []),
      ...(person.phone?.trim() ? (['sms', 'whatsapp'] as const) : []),
    ];
  }, [conversation, person]);

  const handleComposerChannelChange = useCallback(
    (target: 'email' | 'sms' | 'whatsapp') => {
      onNavigateToChannelConversation?.({
        channel: target,
        conversationId: conversationIdByChannel[target] ?? null,
      });
    },
    [conversationIdByChannel, onNavigateToChannelConversation]
  );

  // ---- Bucket / chase context (hooks must run on every render) -----------
  const { data: cemeteries = [] } = useCemeteries();
  const conversationIdsForExtraction = useMemo(
    () => (conversation ? [conversation.id] : []),
    [conversation]
  );
  const { data: extractions = [] } = useEnquiryExtractions(conversationIdsForExtraction);
  const cemeteryEmailSet = useMemo(
    () => buildCemeteryEmailSet(cemeteries, personOrders),
    [cemeteries, personOrders]
  );
  const permitThreadIdSet = useMemo(() => buildPermitThreadIdSet(personOrders), [personOrders]);
  const personHasOpenOrders = useMemo(() => personOrders.some(isOrderOpen), [personOrders]);
  const linkedOrder = useMemo(
    () =>
      conversation?.order_id
        ? personOrders.find((o) => o.id === conversation.order_id) ?? null
        : null,
    [conversation?.order_id, personOrders]
  );
  const linkedOrderCemetery = useMemo(
    () =>
      linkedOrder?.cemetery_id
        ? cemeteries.find((c) => c.id === linkedOrder.cemetery_id) ?? null
        : null,
    [linkedOrder, cemeteries]
  );
  const permitOrderForChase = useMemo(() => {
    if (!linkedOrder) return null;
    return {
      id: linkedOrder.id,
      order_number: linkedOrder.order_number,
      customer_name: linkedOrder.customer_name,
      customer_email: linkedOrder.customer_email,
      person_name: linkedOrder.person_name,
      deceased_name: linkedOrder.person_name ?? null,
      order_type: linkedOrder.order_type,
      location: linkedOrder.location,
      memorial_type: linkedOrder.material,
      permit_status: linkedOrder.permit_status ?? 'not_started',
      permit_form_sent_at: linkedOrder.permit_form_sent_at ?? null,
      permit_submitted_at: linkedOrder.permit_submitted_at ?? null,
      permit_approved_at: linkedOrder.permit_approved_at ?? null,
      permit_correspondence_email: linkedOrder.permit_correspondence_email ?? null,
      permit_cemetery_email: linkedOrder.permit_cemetery_email ?? null,
      permit_gmail_thread_id: linkedOrder.permit_gmail_thread_id ?? null,
      cemetery_id: linkedOrder.cemetery_id ?? null,
      cemetery: linkedOrderCemetery,
      created_at: linkedOrder.created_at,
      updated_at: linkedOrder.updated_at,
    };
  }, [linkedOrder, linkedOrderCemetery]);

  if (!conversationId && emptyChannelContext) {
    const { personId, channel } = emptyChannelContext;
    return (
      <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 gap-4">
          <ChannelSelector
            value={channel}
            onChange={(ch) => onEmptyChannelChange?.(ch)}
            disabledChannels={[]}
          />
          <div className="text-center max-w-md space-y-3">
            {channel === 'sms' ? (
              <p className="text-sm text-slate-600">{SMS_NEW_CONVERSATION_NOT_SUPPORTED}</p>
            ) : !personId ? (
              <p className="text-sm text-slate-600">{LINK_PERSON_FOR_CHANNEL_MESSAGE}</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  No {channel === 'email' ? 'email' : 'WhatsApp'} thread for this customer on this
                  channel yet.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    if (!personId || channel === 'sms') return;
                    onRequestNewConversation?.({
                      channel: channel === 'email' ? 'email' : 'whatsapp',
                      personId,
                    });
                  }}
                  className="mt-1"
                >
                  Start new conversation
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <Mail className="h-12 w-12 mx-auto mb-4" />
          <p className="text-sm">Select a conversation to view messages</p>
        </div>
      </div>
    );
  }

  if (conversationLoading || !conversation) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-6">
        <p className="text-sm text-slate-500">Loading conversation…</p>
      </div>
    );
  }

  const personDisplay = person
    ? [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || person.email || person.phone || '—'
    : null;

  const linkStateLabel =
    (conversation.link_state ?? 'unlinked') === 'ambiguous'
      ? 'Ambiguous'
      : (conversation.link_state ?? 'unlinked') === 'linked'
        ? 'Linked'
        : 'Not linked';

  const isUnlinked = !conversation.person_id || ((conversation.link_state ?? 'unlinked') !== 'linked');
  const subject = conversation.subject?.trim() || null;
  const handleLine = `${conversation.channel} · ${conversation.primary_handle}`;

  const relatedOrderIds = personOrders.map(getOrderDisplayId);
  const orderDisplayIdsText = relatedOrderIds.length > 0 ? formatOrderIdsForHeader(relatedOrderIds) : null;

  // Bucket classification mirrors the page-level logic; uses the same authoritative
  // signals so the chase chip in the composer agrees with the badge in the list.
  const bucket = classifyConversation(conversation, {
    cemeteryEmails: cemeteryEmailSet,
    permitThreadIds: permitThreadIdSet,
    personHasOpenOrders,
    extraction: extractions[0] ?? null,
    linkedOrder,
  });

  const chaseContextForThread =
    bucket === 'cemetery' && permitOrderForChase
      ? { permitOrder: permitOrderForChase, cemetery: linkedOrderCemetery }
      : null;

  const summaryBannerBusy =
    threadSummary.isLoading ||
    (threadSummary.isFetching && !threadSummary.summary?.trim());

  const showSummarySlot =
    summaryBannerBusy ||
    threadSummary.error != null ||
    !!(threadSummary.summary && threadSummary.summary.trim());

  return (
    <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
      <LinkConversationModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        conversationId={conversation.id}
        conversationPersonId={conversation.person_id}
        candidates={conversation.link_meta?.candidates}
        onLinked={() => setLinkModalOpen(false)}
        onUnlinked={() => setLinkModalOpen(false)}
      />

      <div className="shrink-0">
        <ConversationHeader
          displayName={personDisplay ?? conversation.primary_handle}
          handleLine={handleLine}
          subjectLine={subject}
          linkStateLabel={linkStateLabel}
          orderDisplayIdsText={orderDisplayIdsText}
          actionButtonLabel={isUnlinked ? 'Link person' : 'Change link'}
          onActionClick={() => setLinkModalOpen(true)}
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
        <ConversationThread
          messages={messages}
          readOnly={false}
          conversationIdByChannel={conversationIdByChannel}
          defaultChannel={defaultChannel}
          participantName={personDisplay ?? null}
          scrollContainerRef={messagesContainerRef}
          conversationSubject={conversation.subject}
          sendChannelOnlyMode={false}
          onReplyChannelChange={handleComposerChannelChange}
          autoScrollResetKey={conversationId}
          enabledReplyChannels={enabledReplyChannels}
          linkedInboxPersonId={conversation.person_id}
          bucket={bucket}
          chaseContext={chaseContextForThread}
          startConversationContext={
            conversation.person_id && person
              ? {
                  personId: conversation.person_id,
                  email: person.email ?? null,
                  phone: person.phone ?? null,
                }
              : null
          }
          onRequestStartConversation={
            conversation.person_id && person && onRequestNewConversation
              ? (ch) => {
                  const ok =
                    ch === 'email' ? !!person.email?.trim() : !!person.phone?.trim();
                  if (!ok) return;
                  onRequestNewConversation({ channel: ch, personId: conversation.person_id });
                }
              : undefined
          }
        />
      </div>
    </div>
  );
};

export default ConversationView;
