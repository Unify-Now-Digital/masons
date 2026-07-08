import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { usePersonUnifiedTimeline } from '../hooks/useInboxMessages';
import { useCustomer } from '@/modules/customers/hooks/useCustomers';
import { useCustomerScores } from '@/modules/customers/hooks/useCustomerScores';
import { ScoreBadge } from '@/shared/components/ScoreBadge';
import { ConversationHeader } from './ConversationHeader';
import { ConversationThread, type ReplyToInfo } from './ConversationThread';
import type { InboxMessage } from '../types/inbox.types';

interface AllMessagesTimelineProps {
  personId: string | null;
  /** Called when user clicks a message: open that conversation in the correct channel tab. */
  onOpenThread: (params: { channel: 'email' | 'sms' | 'whatsapp'; conversationId: string }) => void;
}

export const AllMessagesTimeline: React.FC<AllMessagesTimelineProps> = ({ personId, onOpenThread }) => {
  const { messages, isLoading, isError } = usePersonUnifiedTimeline(personId);
  const { data: person } = useCustomer(personId ?? '');
  const { data: customerScores } = useCustomerScores();
  const personScore = personId ? customerScores?.find((s) => s.id === personId) : undefined;

  const personDisplayName = person
    ? [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || person.email || person.phone || '—'
    : '—';

  const showConversationWindow = !!personId && !isError;
  const hasMessages = !!messages && messages.length > 0;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const [replyTo, setReplyTo] = useState<ReplyToInfo | null>(null);

  useEffect(() => {
    setReplyTo(null);
  }, [personId]);

  const handleReplyToMessage = React.useCallback((info: { messageId: string; channel: 'email' | 'sms' | 'whatsapp'; preview?: string }) => {
    setReplyTo({ messageId: info.messageId, channel: info.channel, preview: info.preview ?? '' });
  }, []);

  const { conversationIdByChannel, defaultChannel } = useMemo(() => {
    const map: Record<'email' | 'sms' | 'whatsapp', string | null> = {
      email: null,
      sms: null,
      whatsapp: null,
    };
    let lastInboundChannel: 'email' | 'sms' | 'whatsapp' | null = null;
    (messages ?? []).forEach((msg: InboxMessage) => {
      map[msg.channel] = msg.conversation_id;
      if (msg.direction === 'inbound') lastInboundChannel = msg.channel;
    });
    return {
      conversationIdByChannel: map,
      defaultChannel: lastInboundChannel ?? 'email',
    };
  }, [messages]);

  const handleSendSuccess = React.useCallback(() => {
    if (personId) {
      queryClient.invalidateQueries({
        queryKey: ['inbox', 'messages', 'personTimeline', personId],
      });
    }
  }, [personId, queryClient]);

  if (!personId) {
    return (
      <Card className="flex-1 min-h-0 min-w-0 flex flex-col border rounded-lg shadow-sm bg-background">
        <CardHeader className="shrink-0 border-b py-3 px-4">
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col min-w-0">
          <div className="flex-1 min-h-0 overflow-auto min-w-0 p-4 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Select a person to view all messages.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 min-w-0 overflow-hidden flex-1">
      {showConversationWindow && (
        <ConversationHeader
          displayName={personDisplayName}
          secondaryLine="All channels"
          scoreBadge={
            personScore ? (
              <ScoreBadge
                score={personScore.score}
                band={personScore.band}
                breakdown={personScore.breakdown}
              />
            ) : undefined
          }
          linkStateLabel="Linked"
          actionButtonLabel={undefined}
        />
      )}

      {isError ? (
        <Card className="flex-1 min-h-0 min-w-0 flex flex-col border rounded-lg shadow-sm bg-background">
          <CardHeader className="shrink-0 border-b py-3 px-4">
            <CardTitle className="text-base">Conversation</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col min-w-0">
            <div className="flex-1 min-h-0 overflow-auto min-w-0 p-4 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Unable to load messages.</p>
            </div>
          </CardContent>
        </Card>
      ) : hasMessages ? (
        <ConversationThread
          messages={messages}
          readOnly={false}
          onMessageClick={(msg) => onOpenThread({ channel: msg.channel, conversationId: msg.conversation_id })}
          conversationIdByChannel={conversationIdByChannel}
          defaultChannel={defaultChannel}
          replyTo={replyTo}
          onReplyToClear={() => setReplyTo(null)}
          onReplyToMessage={handleReplyToMessage}
          onSendSuccess={handleSendSuccess}
          scrollContainerRef={scrollContainerRef}
        />
      ) : (
        <Card className="flex-1 min-h-0 min-w-0 flex flex-col border rounded-lg shadow-sm bg-background">
          <CardHeader className="shrink-0 border-b py-3 px-4">
            <CardTitle className="text-base">Conversation</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col min-w-0">
            <div className="flex-1 min-h-0 overflow-auto min-w-0 p-4 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">
                {isLoading ? 'Loading messages…' : 'No messages for this person yet.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
