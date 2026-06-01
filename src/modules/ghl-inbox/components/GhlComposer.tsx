import React, { useCallback, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/lib/utils';
import type { GhlSendChannelType } from '../lib/channelType';
import { formatSendError, useGhlSendMessage } from '../hooks/useGhlSendMessage';

type Props = {
  conversationId: string;
  contactId: string;
  channelType: GhlSendChannelType | null;
  outboundEnabled: boolean;
};

export const GhlComposer: React.FC<Props> = ({
  conversationId,
  contactId,
  channelType,
  outboundEnabled,
}) => {
  const [draft, setDraft] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const sendMessage = useGhlSendMessage();

  const trimmed = draft.trim();
  const canSend =
    outboundEnabled &&
    !!channelType &&
    trimmed.length > 0 &&
    !sendMessage.isPending;

  const handleSend = useCallback(() => {
    if (!canSend || !channelType) return;

    setInlineError(null);
    const requestId = crypto.randomUUID();
    const messageText = trimmed;

    sendMessage.mutate(
      {
        contactId,
        conversationId,
        type: channelType,
        message: messageText,
        requestId,
      },
      {
        onSuccess: () => {
          setDraft('');
          setInlineError(null);
        },
        onError: (err) => {
          const { description } = formatSendError(err);
          setInlineError(description);
        },
      },
    );
  }, [canSend, channelType, contactId, conversationId, sendMessage, trimmed]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sendMessage.isPending) return;
    handleSend();
  };

  if (!outboundEnabled) {
    return (
      <div className="border-t border-border bg-muted/30 px-4 py-3">
        <p className="text-center text-sm text-muted-foreground">
          Outbound messaging is not yet enabled for this workshop. Contact your administrator
          after testing is complete.
        </p>
      </div>
    );
  }

  return (
    <form
      className="border-t border-border bg-background px-4 py-3 space-y-2"
      onSubmit={handleSubmit}
    >
      {!channelType && (
        <p className="text-xs text-muted-foreground">
          Cannot determine channel for this conversation. Open a thread with at least one message.
        </p>
      )}

      {inlineError && (
        <p className="text-sm text-destructive" role="alert">
          {inlineError}
        </p>
      )}

      <Textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (inlineError) setInlineError(null);
        }}
        placeholder={
          channelType
            ? `Reply via ${channelType}…`
            : 'Reply unavailable for this conversation'
        }
        disabled={!channelType || sendMessage.isPending}
        readOnly={sendMessage.isPending}
        rows={3}
        className={cn('resize-none text-sm', sendMessage.isPending && 'opacity-70')}
        aria-label="Reply message"
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {sendMessage.isPending
            ? 'Sending…'
            : channelType
              ? `Sending on ${channelType}`
              : null}
        </span>
        <Button type="submit" size="sm" disabled={!canSend}>
          {sendMessage.isPending ? 'Sending…' : 'Send'}
        </Button>
      </div>

      {trimmed.length === 0 && draft.length > 0 && (
        <p className="text-xs text-muted-foreground">Message cannot be empty.</p>
      )}
    </form>
  );
};
