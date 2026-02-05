import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { usePersonUnifiedTimeline } from '../hooks/useInboxMessages';
import { useCustomer } from '@/modules/customers/hooks/useCustomers';
import { ConversationHeader } from './ConversationHeader';
import { ConversationThread } from './ConversationThread';

interface AllMessagesTimelineProps {
  personId: string | null;
  /** Called when user clicks a message: open that conversation in the correct channel tab. */
  onOpenThread: (params: { channel: 'email' | 'sms' | 'whatsapp'; conversationId: string }) => void;
}

export const AllMessagesTimeline: React.FC<AllMessagesTimelineProps> = ({ personId, onOpenThread }) => {
  const { messages, isLoading, isError } = usePersonUnifiedTimeline(personId);
  const { data: person } = useCustomer(personId ?? '');

  const personDisplayName = person
    ? [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || person.email || person.phone || '—'
    : '—';

  const showConversationWindow = !!personId && !isError;
  const hasMessages = !!messages && messages.length > 0;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
          readOnly={true}
          onMessageClick={(msg) => onOpenThread({ channel: msg.channel, conversationId: msg.conversation_id })}
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
