import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, X, Sparkles, StickyNote } from 'lucide-react';
import { ReplyChannelPills } from '@/modules/inbox/components/ReplyChannelPills';
import { InboxMessageBubble } from '@/modules/inbox/components/InboxMessageBubble';
import { cn } from '@/shared/lib/utils';
import { useSendReply, useSaveInternalNote } from '@/modules/inbox/hooks/useInboxMessages';
import { useSuggestedReply } from '@/modules/inbox/hooks/useSuggestedReply';
import type { InboxMessage } from '@/modules/inbox/types/inbox.types';
import { formatDateTimeDMY } from '@/shared/lib/formatters';

/** Font stack for message body so Georgian and other non-Latin scripts render correctly. */
const MESSAGE_BODY_FONT_STACK =
  '"Noto Sans Georgian", "Sylfaen", "Segoe UI", "Segoe UI Symbol", system-ui, sans-serif';
const MESSAGE_BODY_IFRAME_STYLE =
  '<style>html,body,body *{font-family:' + MESSAGE_BODY_FONT_STACK + '}</style>';

function formatBubbleTimestamp(value: string): string {
  // Standard: DD-MM-YYYY HH:MM (24h)
  const out = formatDateTimeDMY(value, { withTime: true, withSeconds: false, use12Hour: false });
  return out === '—' ? '' : out;
}

function isLikelyHtml(body: string): boolean {
  if (!body || typeof body !== 'string') return false;
  return (
    /<\/?[a-z][\s\S]*>/i.test(body) &&
    (body.includes('<html') || body.includes('<div') || body.includes('<table') || body.includes('<body'))
  );
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    .replace(/<meta[\s\S]*?>/gi, '');
}

export interface ReplyToInfo {
  messageId: string;
  preview: string;
  channel: 'email' | 'sms' | 'whatsapp';
}

export interface ConversationThreadProps {
  messages: InboxMessage[];
  /** When true, do not render the reply composer. */
  readOnly?: boolean;
  /** When set (e.g. All tab), clicking a message opens that thread. Ignored when readOnly is false. */
  onMessageClick?: (message: InboxMessage) => void;
  /** For editable view: conversation id and channel for sending replies. */
  conversationId?: string | null;
  channel?: 'email' | 'sms' | 'whatsapp';
  /** Unified (All) tab: map channel -> conversation id; when set, composer shows channel dropdown. */
  conversationIdByChannel?: Record<'email' | 'sms' | 'whatsapp', string | null>;
  /** Initial channel when using conversationIdByChannel (overridden by replyTo.channel or most recent inbound). */
  defaultChannel?: 'email' | 'sms' | 'whatsapp';
  /** Optional "Replying to..." chip; show preview and allow clear. */
  replyTo?: ReplyToInfo | null;
  onReplyToClear?: () => void;
  /** When user clicks Reply on a message (unified mode only). */
  onReplyToMessage?: (info: { messageId: string; channel: 'email' | 'sms' | 'whatsapp'; preview?: string }) => void;
  /** Called after a reply is sent successfully (e.g. to invalidate person timeline). */
  onSendSuccess?: () => void;
  /** Optional ref to attach to the scroll container (e.g. for auto-scroll to bottom). */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  /** Optional linked person name (used for nicer sender display in message meta). */
  participantName?: string | null;
  /** Optional callback when user clicks a reply-channel pill (used by Unified Inbox). */
  onReplyChannelChange?: (channel: 'email' | 'sms' | 'whatsapp') => void;
  /** Conversation subject (for first email in new thread). */
  conversationSubject?: string | null;
}

function mostRecentInboundChannel(messages: InboxMessage[]): 'email' | 'sms' | 'whatsapp' | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === 'inbound') return messages[i].channel;
  }
  return null;
}

function derivePreview(msg: InboxMessage): string {
  const body = (msg.body_text ?? '').replace(/<[^>]+>/g, '').trim();
  if (msg.channel === 'email' && msg.subject?.trim()) {
    return msg.subject.trim().length > 80 ? `${msg.subject.trim().slice(0, 80)}…` : msg.subject.trim();
  }
  return body.length > 80 ? `${body.slice(0, 80)}…` : body || '(No preview)';
}

function formatHandle(value?: string | null): string | null {
  if (!value) return null;
  const out = value.trim().replace(/\s+/g, ' ');
  return out.length ? out : null;
}

function deriveSubject(message: InboxMessage): string | null {
  if (message.channel !== 'email') return null;
  const s = message.subject?.trim();
  return s && s.length ? s : null;
}

function buildMetaLine(message: InboxMessage): string | null {
  const subject = deriveSubject(message);
  // Important: do not display raw handles (emails/phone numbers) in the message header area.
  // Subject is still useful context for email messages.
  if (!subject) return null;
  return subject;
}

const SUGGEST_CHIP_MAX_LEN = 120;

function SuggestedReplyChip({
  suggestion,
  isLoading,
  error,
  onUseSuggestion,
}: {
  suggestion: string | null;
  isLoading: boolean;
  error: Error | null;
  onUseSuggestion: (text: string) => void;
}) {
  if (isLoading) {
    return (
      <span className="text-[11px] text-slate-500">Suggesting reply…</span>
    );
  }
  if (error) {
    return (
      <span className="text-[11px] text-slate-500">Couldn&apos;t load suggestion</span>
    );
  }
  if (!suggestion) return null;

  const label =
    suggestion.length > SUGGEST_CHIP_MAX_LEN
      ? `${suggestion.slice(0, SUGGEST_CHIP_MAX_LEN)}…`
      : suggestion;
  return (
    <button
      type="button"
      title={suggestion}
      onClick={() => onUseSuggestion(suggestion)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-[#F0C8A0] bg-gardens-amb-lt text-gardens-amb-dk hover:bg-[#FAE4D0] max-w-full"
    >
      <Sparkles className="h-3.5 w-3.5 text-gardens-acc shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export const ConversationThread: React.FC<ConversationThreadProps> = ({
  messages,
  readOnly = false,
  onMessageClick,
  conversationId,
  channel,
  conversationIdByChannel,
  defaultChannel,
  replyTo,
  onReplyToClear,
  onReplyToMessage,
  onSendSuccess,
  scrollContainerRef,
  participantName = null,
  onReplyChannelChange,
  conversationSubject = null,
}) => {
  const isUnifiedMode = !!conversationIdByChannel;
  const effectiveDefault = useMemo(() => {
    if (!isUnifiedMode) return null;
    return replyTo?.channel ?? defaultChannel ?? mostRecentInboundChannel(messages) ?? 'email';
  }, [isUnifiedMode, replyTo?.channel, defaultChannel, messages]);

  const [selectedChannel, setSelectedChannel] = useState<'email' | 'sms' | 'whatsapp'>(effectiveDefault ?? 'email');
  const channelBeforeReplyRef = useRef<'email' | 'sms' | 'whatsapp'>(effectiveDefault ?? 'email');
  const [replyText, setReplyText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawHtmlMessageIds, setRawHtmlMessageIds] = useState<Set<string>>(new Set());
  const sendReplyMutation = useSendReply();
  const saveNoteMutation = useSaveInternalNote();
  const composerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // When replyTo is set, lock channel to replyTo.channel; when cleared, restore previous
  const channelLocked = !!replyTo;
  const effectiveChannel = channelLocked ? replyTo!.channel : selectedChannel;
  useEffect(() => {
    if (replyTo) {
      channelBeforeReplyRef.current = selectedChannel;
    } else {
      setSelectedChannel(channelBeforeReplyRef.current);
    }
    // Intentionally omit selectedChannel: we only capture it when replyTo becomes truthy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyTo]);

  // Sync selected channel when effectiveDefault changes (e.g. person or messages change), but not when replyTo is set
  useEffect(() => {
    if (replyTo) return;
    if (effectiveDefault != null && conversationIdByChannel?.[effectiveDefault]) {
      setSelectedChannel(effectiveDefault);
      channelBeforeReplyRef.current = effectiveDefault;
    }
    // Omit replyTo so clearing replyTo does not overwrite the restored channel from the other effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDefault, conversationIdByChannel]);

  const activeConversationId = isUnifiedMode
    ? conversationIdByChannel[effectiveChannel] ?? null
    : conversationId ?? null;
  const activeChannel = isUnifiedMode ? effectiveChannel : (channel ?? null);

  const handleReplyClick = (message: InboxMessage) => {
    const preview = derivePreview(message);
    onReplyToMessage?.({ messageId: message.id, channel: message.channel, preview });
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      textareaRef.current?.focus();
    });
  };
  const availableChannels = useMemo(() => {
    if (conversationIdByChannel) {
      return (['email', 'sms', 'whatsapp'] as const).filter(
        (ch) => conversationIdByChannel[ch] != null
      );
    }
    return ['email', 'sms', 'whatsapp'] as const;
  }, [conversationIdByChannel]);

  // Active Reply via pill: always reflect the currently open conversation's channel (no stale local state).
  const pillActiveChannel =
    channelLocked ? replyTo!.channel : (isUnifiedMode ? selectedChannel : (channel ?? null)) ?? availableChannels[0];

  const lastInboundMessage = useMemo(
    () => messages.slice().reverse().find((m) => m.direction === 'inbound') ?? null,
    [messages]
  );
  const suggestedReply = useSuggestedReply(lastInboundMessage?.id ?? null);

  const toggleRawHtml = (messageId: string) => {
    setRawHtmlMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  useEffect(() => {
    const el = scrollContainerRef?.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
  }, [messages, scrollContainerRef]);

  const handleSendReply = () => {
    if (!activeConversationId || !replyText.trim() || !activeChannel) return;
    setErrorMessage(null);
    const isFirstEmailMessage = activeChannel === 'email' && messages.length === 0;
    sendReplyMutation.mutate(
      {
        conversationId: activeConversationId,
        bodyText: replyText,
        channel: activeChannel,
        isFirstEmailMessage: isFirstEmailMessage || undefined,
        subject: isFirstEmailMessage ? conversationSubject : undefined,
      },
      {
        onSuccess: () => {
          setReplyText('');
          onReplyToClear?.();
          onSendSuccess?.();
        },
        onError: (error) => setErrorMessage(error instanceof Error ? error.message : 'Failed to send message'),
      }
    );
  };

  const emptyState = (
    <div className="text-center text-slate-400 py-8">
      <p>No messages in this conversation</p>
    </div>
  );

  const messageList =
    messages.length === 0 ? (
      emptyState
    ) : (
      <>
        {messages.map((message) => {
          const isInternalNote = message.message_type === 'internal_note';
          const isInbound = message.direction === 'inbound';
          const isEmail = message.channel === 'email';
          const body = message.body_text ?? '';
          const showAsHtml = isEmail && isLikelyHtml(body) && !isInternalNote;
          const showRaw = showAsHtml && rawHtmlMessageIds.has(message.id);
          const isClickable = readOnly && !!onMessageClick;
          const showReplyAction = isUnifiedMode && !!onReplyToMessage && !readOnly && !isInternalNote;
          const metaLine = isInternalNote ? null : buildMetaLine(message);
          const senderName = isInternalNote
            ? 'Internal note'
            : isInbound
              ? participantName ?? message.from_handle
              : 'You';

          const bodyContent = showAsHtml ? (
            <>
              {showRaw ? (
                <pre
                  className="text-xs whitespace-pre-wrap break-words"
                  style={{ fontFamily: MESSAGE_BODY_FONT_STACK }}
                >
                  {body}
                </pre>
              ) : (
                <div className="min-w-0 overflow-hidden max-w-full">
                  <iframe
                    sandbox=""
                    srcDoc={MESSAGE_BODY_IFRAME_STYLE + sanitizeHtml(body)}
                    title="Email content"
                    className="w-full max-w-full min-h-[60px] max-h-48 border-0 bg-white text-slate-900"
                  />
                </div>
              )}
              <button
                type="button"
                className="h-6 px-1.5 text-xs mt-1 -ml-1 text-slate-500 hover:text-slate-700"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRawHtml(message.id);
                }}
              >
                {showRaw ? 'View formatted' : 'View raw'}
              </button>
            </>
          ) : (
            <p
              className={cn('text-sm whitespace-pre-wrap break-words', isEmail && 'break-all')}
              style={{ fontFamily: MESSAGE_BODY_FONT_STACK }}
            >
              {body}
            </p>
          );

          return (
            <InboxMessageBubble
              key={message.id}
              direction={isInternalNote ? 'note' : isInbound ? 'inbound' : 'outbound'}
              senderName={senderName}
              channel={message.channel}
              metaLine={metaLine}
              timestamp={formatBubbleTimestamp(message.sent_at)}
              onReply={showReplyAction ? () => handleReplyClick(message) : undefined}
              onClick={isClickable ? () => onMessageClick(message) : undefined}
            >
              {bodyContent}
            </InboxMessageBubble>
          );
        })}
      </>
    );

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col min-w-0 overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden scrollbar-hide space-y-6 px-4 sm:px-8 py-6 bg-gardens-page"
      >
        {messageList}
      </div>

      {!readOnly && (
        <div ref={composerRef} className="shrink-0 border-t border-gardens-bdr pt-4 pb-3 px-4 min-w-0 bg-gardens-surf">
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">Replying to:</span>
              <span
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                title={replyTo.preview}
              >
                {replyTo.preview.length > 40 ? `${replyTo.preview.slice(0, 40)}…` : replyTo.preview}
                {onReplyToClear && (
                  <button
                    type="button"
                    onClick={onReplyToClear}
                    className="rounded p-0.5 hover:bg-slate-200"
                    aria-label="Clear reply-to"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            </div>
          )}
          {/* Reply via pills: unified mode uses internal channel switching; inbox uses parent callback */}
          {availableChannels.length > 0 && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-gardens-txm">Reply via</span>
              <ReplyChannelPills
                channels={availableChannels}
                value={availableChannels.includes(pillActiveChannel) ? pillActiveChannel : availableChannels[0]}
                onChange={(v) => {
                  const ch = v as 'email' | 'sms' | 'whatsapp';
                  if (isUnifiedMode) {
                    setSelectedChannel(ch);
                  }
                  onReplyChannelChange?.(ch);
                }}
                disabled={false}
              />
            </div>
          )}
          <textarea
            ref={textareaRef}
            placeholder="Type your reply..."
            rows={3}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              if (e.shiftKey) return; // Shift+Enter: allow default (newline)
              e.preventDefault();
              if (
                replyText.trim() &&
                activeConversationId &&
                activeChannel &&
                !sendReplyMutation.isPending
              ) {
                handleSendReply();
              }
            }}
            className="w-full mb-3 px-3 py-2.5 text-sm rounded-lg border border-gardens-bdr bg-gardens-surf2 text-gardens-tx placeholder:text-gardens-txm focus:outline-none focus:ring-2 focus:ring-gardens-acc/30 focus:border-gardens-acc resize-y min-h-[72px]"
          />
          {errorMessage && <p className="mb-2 text-xs text-red-600">{errorMessage}</p>}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <SuggestedReplyChip
                suggestion={suggestedReply.suggestion}
                isLoading={suggestedReply.isLoading}
                error={suggestedReply.error}
                onUseSuggestion={setReplyText}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!activeConversationId || !replyText.trim() || !activeChannel) return;
                  saveNoteMutation.mutate(
                    { conversationId: activeConversationId, bodyText: replyText, channel: activeChannel },
                    {
                      onSuccess: () => { setReplyText(''); onSendSuccess?.(); },
                      onError: (err) => setErrorMessage(err instanceof Error ? err.message : 'Failed to save note'),
                    }
                  );
                }}
                disabled={
                  !replyText.trim() ||
                  saveNoteMutation.isPending ||
                  !activeConversationId
                }
                className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg border border-dashed border-gardens-bdr2 text-gardens-txs hover:bg-gardens-page disabled:opacity-50 disabled:pointer-events-none"
              >
                <StickyNote className="h-4 w-4 mr-1.5" />
                {saveNoteMutation.isPending ? 'Saving...' : 'Note'}
              </button>
              <button
                type="button"
                onClick={handleSendReply}
                disabled={
                  !replyText.trim() ||
                  sendReplyMutation.isPending ||
                  !activeConversationId ||
                  !activeChannel
                }
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-gardens-acc text-white hover:bg-gardens-acc-dk disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-gardens-acc focus:ring-offset-2"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendReplyMutation.isPending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
