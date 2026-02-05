import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Mail, Phone, MessageSquare, Send } from 'lucide-react';
import { Textarea } from "@/shared/components/ui/textarea";
import { useConversation } from "@/modules/inbox/hooks/useInboxConversations";
import { useMessagesByConversation, useSendReply } from "@/modules/inbox/hooks/useInboxMessages";
import { useCustomer } from '@/modules/customers/hooks/useCustomers';
import { formatMessageTimestamp } from "@/modules/inbox/utils/conversationUtils";
import { LinkConversationModal } from './LinkConversationModal';

interface ConversationViewProps {
  conversationId: string | null;
}

export const ConversationView: React.FC<ConversationViewProps> = ({ conversationId }) => {
  const [replyText, setReplyText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { data: conversation } = useConversation(conversationId);
  const { data: messages = [] } = useMessagesByConversation(conversationId);
  const { data: person } = useCustomer(conversation?.person_id ?? '');
  const sendReplyMutation = useSendReply();

  // Auto-scroll messages container to bottom when messages change (do not scroll the page)
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
  }, [messages]);

  const handleSendReply = () => {
    if (!conversationId || !replyText.trim() || !conversation) return;

    setErrorMessage(null);
    sendReplyMutation.mutate(
      { 
        conversationId, 
        bodyText: replyText,
        channel: conversation.channel as 'email' | 'sms' | 'whatsapp',
      },
      {
        onSuccess: () => {
          setReplyText(''); // Clear textarea
          // Auto-scroll handled by messages effect
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'Failed to send message';
          setErrorMessage(message);
        },
      }
    );
  };

  const getIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="h-4 w-4" />;
      case "sms":
      case "whatsapp": return <Phone className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  if (!conversationId || !conversation) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center text-slate-400">
            <Mail className="h-12 w-12 mx-auto mb-4" />
            <p>Select a conversation to view messages</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isUnlinked = !conversation.person_id || ((conversation.link_state ?? 'unlinked') !== 'linked');
  const isAmbiguous = (conversation.link_state ?? 'unlinked') === 'ambiguous';
  const personDisplay = person
    ? [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || person.email || person.phone || '—'
    : null;

  const linkStateLabel =
    (conversation.link_state ?? 'unlinked') === 'ambiguous'
      ? 'Ambiguous'
      : (conversation.link_state ?? 'unlinked') === 'linked'
        ? 'Linked'
        : 'Not linked';

  return (
    <div className="h-full flex flex-col min-h-0 min-w-0 overflow-hidden">
      <LinkConversationModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        conversationId={conversation.id}
        conversationPersonId={conversation.person_id}
        candidates={conversation.link_meta?.candidates}
        onLinked={() => setLinkModalOpen(false)}
        onUnlinked={() => setLinkModalOpen(false)}
      />

      {/* Compact sticky header: avatar + identity + status pill + action */}
      <div className="sticky top-0 z-10 bg-background border-b shrink-0 px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs">
              {personDisplay
                ? personDisplay.substring(0, 2).toUpperCase()
                : conversation.primary_handle.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {personDisplay ?? conversation.primary_handle}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {conversation.channel} · {conversation.primary_handle}
            </p>
          </div>
          <Badge variant="outline" className="text-[11px] px-1.5 py-0 shrink-0">
            {linkStateLabel}
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => setLinkModalOpen(true)} className="shrink-0">
          {isUnlinked ? 'Link person' : 'Change link'}
        </Button>
      </div>

      {/* Conversation Thread */}
      <Card className="flex-1 flex flex-col min-w-0 min-h-0">
        <CardHeader className="shrink-0">
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <div ref={messagesContainerRef} className="flex-1 min-w-0 space-y-4 overflow-y-auto overflow-x-hidden max-h-96 mb-4">
            {messages.length === 0 ? (
              <div className="text-center text-slate-400 py-8">
                <p>No messages in this conversation</p>
              </div>
            ) : (
              messages.map((message) => {
                const isInbound = message.direction === 'inbound';
                return (
                  <div
                    key={message.id}
                    className={`flex min-w-0 ${isInbound ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[75%] min-w-0 px-4 py-2 rounded-lg overflow-hidden ${
                        isInbound
                          ? 'bg-slate-100 text-slate-900'
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      <p
                        className={`text-sm whitespace-pre-wrap break-words ${
                          conversation.channel === 'email' ? 'break-all' : ''
                        }`}
                      >
                        {message.body_text}
                      </p>
                      <p className={`text-xs mt-1 shrink-0 ${
                        isInbound ? 'text-slate-500' : 'text-blue-100'
                      }`}>
                        {formatMessageTimestamp(message.sent_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Reply Box */}
          <div className="border-t pt-4 min-w-0 shrink-0">
            <Textarea 
              placeholder="Type your reply..."
              className="mb-3"
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            {errorMessage && (
              <p className="mb-2 text-xs text-red-600">{errorMessage}</p>
            )}
            <div className="flex justify-end">
              <Button 
                size="sm"
                onClick={handleSendReply}
                disabled={!replyText.trim() || sendReplyMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {sendReplyMutation.isPending ? 'Sending...' : 'Send Reply'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConversationView;
