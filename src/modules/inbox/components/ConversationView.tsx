import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Mail, Phone, MessageSquare, Send } from 'lucide-react';
import { Textarea } from "@/shared/components/ui/textarea";
import { useConversation } from "@/modules/inbox/hooks/useInboxConversations";
import { useMessagesByConversation, useSendReply } from "@/modules/inbox/hooks/useInboxMessages";
import { formatMessageTimestamp } from "@/modules/inbox/utils/conversationUtils";

interface ConversationViewProps {
  conversationId: string | null;
}

export const ConversationView: React.FC<ConversationViewProps> = ({ conversationId }) => {
  const [replyText, setReplyText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data: conversation } = useConversation(conversationId);
  const { data: messages = [] } = useMessagesByConversation(conversationId);
  const sendReplyMutation = useSendReply();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendReply = () => {
    if (!conversationId || !replyText.trim()) return;

    setErrorMessage(null);
    sendReplyMutation.mutate(
      { conversationId, bodyText: replyText },
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

  return (
    <div className="h-full flex flex-col">
      {/* Contact Details Header */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarFallback>{conversation.primary_handle.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{conversation.primary_handle}</CardTitle>
                <p className="text-sm text-slate-600">{conversation.subject || 'No subject'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {conversation.unread_count > 0 && (
                <Badge variant="default" className="bg-blue-500">
                  {conversation.unread_count} unread
                </Badge>
              )}
              <Badge variant="outline" className="capitalize">
                {conversation.channel}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Conversation Thread */}
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto max-h-96 mb-4">
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
                    className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isInbound
                          ? 'bg-slate-100 text-slate-900'
                          : 'bg-blue-500 text-white'
                      }`}
                    >
                      <p className="text-sm">{message.body_text}</p>
                      <p className={`text-xs mt-1 ${
                        isInbound ? 'text-slate-500' : 'text-blue-100'
                      }`}>
                        {formatMessageTimestamp(message.sent_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Box */}
          <div className="border-t pt-4">
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
