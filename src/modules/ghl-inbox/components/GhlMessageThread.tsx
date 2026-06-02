import React, { useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/utils';
import type { GhlMessageItem } from '../api/ghlInbox.api';
import { deriveConversationChannelType } from '../lib/channelType';
import { useGhlMarkRead } from '../hooks/useGhlMarkRead';
import { GhlComposer } from './GhlComposer';

type Props = {
  conversationId: string | null;
  contactId: string | null;
  unreadCount: number;
  outboundEnabled: boolean;
  messages: GhlMessageItem[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
};

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function messageText(m: GhlMessageItem): string {
  const text = (m.plainText ?? m.body ?? '').trim();
  if (text) return text;

  const type = (m.messageType ?? '').toUpperCase();
  if (type.includes('CALL')) return '📞 Call';
  if (type.includes('VOICEMAIL')) return '🎙️ Voicemail';
  if (type.includes('EMAIL')) return '✉️ Email';
  if (type.includes('SMS')) return '💬 SMS';
  if (type.includes('WHATSAPP')) return '🟢 WhatsApp message';
  return 'No message preview';
}

export const GhlMessageThread: React.FC<Props> = ({
  conversationId,
  contactId,
  unreadCount,
  outboundEnabled,
  messages,
  isLoading,
  isError,
  errorMessage,
}) => {
  const { toast } = useToast();
  const markRead = useGhlMarkRead();

  const sorted = useMemo(
    () =>
      [...messages].sort((a, b) => {
        const ta = a.dateAdded ? new Date(a.dateAdded).getTime() : 0;
        const tb = b.dateAdded ? new Date(b.dateAdded).getTime() : 0;
        return ta - tb;
      }),
    [messages],
  );

  const channelType = useMemo(
    () => deriveConversationChannelType(messages),
    [messages],
  );

  if (!conversationId) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Select a conversation to view messages.
      </div>
    );
  }

  const handleMarkRead = () => {
    markRead.mutate(conversationId, {
      onError: (err) => {
        toast({
          title: 'Could not mark as read',
          description: err instanceof Error ? err.message : 'Please try again.',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <span className="text-xs text-muted-foreground font-mono truncate">{conversationId}</span>
        {unreadCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={markRead.isPending}
            onClick={handleMarkRead}
          >
            {markRead.isPending ? 'Updating…' : 'Mark as read'}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">Loading messages…</p>
        )}
        {isError && !isLoading && (
          <p className="text-sm text-destructive text-center py-8">
            {errorMessage ?? 'Could not load messages.'}
          </p>
        )}
        {!isLoading && !isError && sorted.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No messages in this thread.</p>
        )}
        {!isLoading &&
          !isError &&
          sorted.map((m) => {
            const inbound = m.direction?.toLowerCase() === 'inbound';
            const optimistic = m.id.startsWith('optimistic-');
            return (
              <div
                key={m.id}
                className={cn('flex', inbound ? 'justify-start' : 'justify-end')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                    inbound ? 'bg-muted' : 'bg-primary text-primary-foreground',
                    optimistic && 'opacity-80',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{messageText(m)}</p>
                  <p
                    className={cn(
                      'mt-1 text-[10px] opacity-70',
                      inbound ? 'text-muted-foreground' : 'text-primary-foreground/80',
                    )}
                  >
                    {optimistic ? 'Sending…' : formatWhen(m.dateAdded)}
                    {m.messageType ? ` · ${m.messageType}` : ''}
                  </p>
                </div>
              </div>
            );
          })}
      </div>

      {contactId ? (
        <GhlComposer
          conversationId={conversationId}
          contactId={contactId}
          channelType={channelType}
          outboundEnabled={outboundEnabled}
        />
      ) : (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          <p className="text-center text-sm text-muted-foreground">
            No contact linked to this conversation.
          </p>
        </div>
      )}
    </div>
  );
};
