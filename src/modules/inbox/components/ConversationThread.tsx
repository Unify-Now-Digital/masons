import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, X, Sparkles } from 'lucide-react';
import { ReplyChannelPills } from '@/modules/inbox/components/ReplyChannelPills';
import { InboxMessageBubble } from '@/modules/inbox/components/InboxMessageBubble';
import { cn } from '@/shared/lib/utils';
import { useSendReply } from '@/modules/inbox/hooks/useInboxMessages';
import { useSuggestedReply } from '@/modules/inbox/hooks/useSuggestedReply';
import type { InboxMessage } from '@/modules/inbox/types/inbox.types';
import { formatDateTimeDMY } from '@/shared/lib/formatters';
import { ChannelSelector } from './ChannelSelector';
import { fetchWhatsAppTemplates, type WhatsAppTemplateSummary } from '@/modules/inbox/api/inboxTwilio.api';
import { supabase } from '@/shared/lib/supabase';

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
  /** Enable near-bottom auto-scroll policy (customers mode). */
  conditionalAutoScroll?: boolean;
  /** Changing this key forces scroll-to-bottom once (e.g., switching customers). */
  autoScrollResetKey?: string | null;
  /** Customers-only refinement: show email subject in header row (instead of metaLine). */
  showEmailSubjectInHeader?: boolean;
  /** Customers-only refinement: override which reply channels are enabled. */
  enabledReplyChannels?: Array<'email' | 'sms' | 'whatsapp'>;
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

function getMetaSenderEmail(message: InboxMessage): string | null {
  const meta = message.meta;
  if (!meta || typeof meta !== 'object') return null;
  const value = (meta as Record<string, unknown>).sender_email;
  if (typeof value !== 'string') return null;
  const out = value.trim();
  return out.length ? out : null;
}

function extractPlaceholders(templateBody: string): string[] {
  const matches = templateBody.matchAll(/\{\{(\d+)\}\}/g);
  const set = new Set<string>();
  for (const m of matches) set.add(m[1]);
  return Array.from(set).sort((a, b) => Number(a) - Number(b));
}

function renderTemplateBody(templateBody: string, values: Record<string, string>): string {
  return templateBody.replace(/\{\{(\d+)\}\}/g, (_, key: string) => values[key] ?? '');
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
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 max-w-full"
    >
      <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
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
  conditionalAutoScroll = false,
  autoScrollResetKey = null,
  showEmailSubjectInHeader = false,
  enabledReplyChannels = undefined,
}) => {
  const isUnifiedMode = !!conversationIdByChannel;
  const allChannels = useMemo(() => ['email', 'sms', 'whatsapp'] as const, []);
  const effectiveDefault = useMemo(() => {
    if (!isUnifiedMode) return null;
    return replyTo?.channel ?? defaultChannel ?? mostRecentInboundChannel(messages) ?? 'email';
  }, [isUnifiedMode, replyTo?.channel, defaultChannel, messages]);

  const [selectedChannel, setSelectedChannel] = useState<'email' | 'sms' | 'whatsapp'>(effectiveDefault ?? 'email');
  const channelBeforeReplyRef = useRef<'email' | 'sms' | 'whatsapp'>(effectiveDefault ?? 'email');
  const [replyText, setReplyText] = useState('');
  const [replyMode, setReplyMode] = useState<'freeform' | 'template'>('freeform');
  const [templates, setTemplates] = useState<WhatsAppTemplateSummary[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateSid, setSelectedTemplateSid] = useState<string>('');
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [staffEmail, setStaffEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawHtmlMessageIds, setRawHtmlMessageIds] = useState<Set<string>>(new Set());
  const sendReplyMutation = useSendReply();
  const composerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isNearBottomRef = useRef(true);
  const lastLengthRef = useRef(0);
  const lastResetKeyRef = useRef<string | null>(null);
  const rafIdRef = useRef<number | null>(null);

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
    if (enabledReplyChannels && enabledReplyChannels.length > 0) {
      return enabledReplyChannels;
    }
    if (conversationIdByChannel) {
      return (['email', 'sms', 'whatsapp'] as const).filter(
        (ch) => conversationIdByChannel[ch] != null
      );
    }
    return ['email', 'sms', 'whatsapp'] as const;
  }, [conversationIdByChannel, enabledReplyChannels]);
  const disabledChannels = useMemo(
    () => (allChannels.filter((channel) => !availableChannels.includes(channel))),
    [allChannels, availableChannels]
  );

  useEffect(() => {
    if (channelLocked) return;
    if (!isUnifiedMode) return;
    if (availableChannels.length === 0) return;
    if (!availableChannels.includes(selectedChannel)) {
      setSelectedChannel(availableChannels[0]);
    }
  }, [availableChannels, selectedChannel, channelLocked, isUnifiedMode]);

  // Active Reply via pill: always reflect the currently open conversation's channel (no stale local state).
  const pillActiveChannel =
    channelLocked ? replyTo!.channel : (isUnifiedMode ? selectedChannel : (channel ?? null)) ?? availableChannels[0];

  const lastInboundMessage = useMemo(
    () => messages.slice().reverse().find((m) => m.direction === 'inbound') ?? null,
    [messages]
  );
  const suggestedReply = useSuggestedReply(lastInboundMessage?.id ?? null);
  const isTemplateAllowed = activeChannel === 'whatsapp';
  const selectedTemplate = templates.find((t) => t.sid === selectedTemplateSid) ?? null;
  const requiredPlaceholders = selectedTemplate ? extractPlaceholders(selectedTemplate.body) : [];

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
    if (!el) return;
    if (!conditionalAutoScroll) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
      return;
    }

    const thresholdPx = 120;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      isNearBottomRef.current = distance <= thresholdPx;
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
    };
  }, [scrollContainerRef, conditionalAutoScroll]);

  useEffect(() => {
    const el = scrollContainerRef?.current;
    if (!el) return;
    if (!conditionalAutoScroll) {
      lastLengthRef.current = messages.length;
      return;
    }
    const resetChanged = autoScrollResetKey !== lastResetKeyRef.current;
    const lengthChanged = messages.length !== lastLengthRef.current;
    const shouldScroll = resetChanged || (lengthChanged && isNearBottomRef.current);
    lastResetKeyRef.current = autoScrollResetKey;
    lastLengthRef.current = messages.length;
    if (!shouldScroll) return;
    if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
      rafIdRef.current = null;
    });
  }, [messages.length, scrollContainerRef, conditionalAutoScroll, autoScrollResetKey]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setStaffEmail(data.user?.email ?? '');
    }).catch(() => {
      setStaffEmail('');
    });
  }, []);

  useEffect(() => {
    if (!isTemplateAllowed) {
      setReplyMode('freeform');
      setTemplatesOpen(false);
    }
  }, [isTemplateAllowed]);

  useEffect(() => {
    if (!templatesOpen || !isTemplateAllowed) return;
    setTemplatesLoading(true);
    fetchWhatsAppTemplates()
      .then((items) => setTemplates(items.filter((t) => t.status === 'approved')))
      .catch((err) => setErrorMessage(err instanceof Error ? err.message : 'Failed to load templates'))
      .finally(() => setTemplatesLoading(false));
  }, [templatesOpen, isTemplateAllowed]);

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateVariables({});
      return;
    }
    const placeholders = extractPlaceholders(selectedTemplate.body);
    const nextVars: Record<string, string> = {};
    for (const key of placeholders) {
      if (key === '1') nextVars[key] = participantName ?? '';
      else if (key === '2') nextVars[key] = staffEmail;
      else nextVars[key] = '';
    }
    setTemplateVariables(nextVars);
  }, [selectedTemplateSid, selectedTemplate, participantName, staffEmail]);

  const handleSendReply = () => {
    if (!activeConversationId || !activeChannel) return;
    setErrorMessage(null);
    if (replyMode === 'template' && isTemplateAllowed) {
      if (!selectedTemplate) {
        setErrorMessage('Select a template first');
        return;
      }
      if (!selectedTemplate.body?.trim()) {
        setErrorMessage('Template body missing. Please reload templates.');
        return;
      }
      const placeholders = extractPlaceholders(selectedTemplate.body);
      for (const key of placeholders) {
        if (!templateVariables[key] || !templateVariables[key].trim()) {
          setErrorMessage(`Template variable {{${key}}} is required`);
          return;
        }
      }
      const rendered = renderTemplateBody(selectedTemplate.body, templateVariables);
      sendReplyMutation.mutate(
        {
          conversationId: activeConversationId,
          bodyText: rendered,
          channel: activeChannel,
          whatsappTemplate: {
            contentSid: selectedTemplate.sid,
            contentVariables: templateVariables,
          },
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
      return;
    }
    if (!replyText.trim()) return;
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
          const isInbound = message.direction === 'inbound';
          const isEmail = message.channel === 'email';
          const body = message.body_text ?? '';
          const showAsHtml = isEmail && isLikelyHtml(body);
          const showRaw = showAsHtml && rawHtmlMessageIds.has(message.id);
          const isClickable = readOnly && !!onMessageClick;
          const showReplyAction = isUnifiedMode && !!onReplyToMessage && !readOnly;
          const metaLine =
            showEmailSubjectInHeader && message.channel === 'email' ? null : buildMetaLine(message);
          const emailSubjectInHeader =
            showEmailSubjectInHeader && message.channel === 'email'
              ? message.subject?.trim()
                ? message.subject.trim()
                : '(No subject)'
              : null;
          const senderName = isInbound
            ? participantName ?? message.from_handle
            : message.channel === 'whatsapp'
              ? (() => {
                  const senderEmail = getMetaSenderEmail(message);
                  if (!senderEmail) return 'You';
                  return senderEmail.toLowerCase() === staffEmail.trim().toLowerCase() ? 'You' : senderEmail;
                })()
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
              direction={isInbound ? 'inbound' : 'outbound'}
              senderName={senderName}
              channel={message.channel}
              metaLine={metaLine}
              emailSubjectInHeader={emailSubjectInHeader}
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
        className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden scrollbar-hide space-y-6 px-8 py-6 bg-slate-50/30"
      >
        {messageList}
      </div>

      {!readOnly && (
        <div ref={composerRef} className="shrink-0 border-t border-slate-200 pt-4 pb-3 px-4 min-w-0 bg-slate-100/60">
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
          {isUnifiedMode ? (
            <ChannelSelector
              value={allChannels.includes(pillActiveChannel) ? pillActiveChannel : allChannels[0]}
              onChange={(ch) => {
                if (isUnifiedMode) setSelectedChannel(ch);
                onReplyChannelChange?.(ch);
              }}
              disabledChannels={disabledChannels}
            />
          ) : availableChannels.length > 0 ? (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-slate-500">Reply via</span>
              <ReplyChannelPills
                channels={availableChannels}
                value={availableChannels.includes(pillActiveChannel) ? pillActiveChannel : availableChannels[0]}
                onChange={(v) => {
                  const ch = v as 'email' | 'sms' | 'whatsapp';
                  onReplyChannelChange?.(ch);
                }}
                disabled={false}
              />
            </div>
          ) : null}
          {isTemplateAllowed && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Mode</span>
                <button
                  type="button"
                  onClick={() => setReplyMode('freeform')}
                  className={cn(
                    'px-2 py-1 rounded-md text-xs border',
                    replyMode === 'freeform' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white border-slate-200'
                  )}
                >
                  Freeform
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplyMode('template');
                    setTemplatesOpen(true);
                  }}
                  className={cn(
                    'px-2 py-1 rounded-md text-xs border',
                    replyMode === 'template' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white border-slate-200'
                  )}
                >
                  Template
                </button>
              </div>
              {replyMode === 'template' && (
                <div className="space-y-2">
                  <select
                    value={selectedTemplateSid}
                    onFocus={() => setTemplatesOpen(true)}
                    onChange={(e) => setSelectedTemplateSid(e.target.value)}
                    className="w-full h-9 px-2 text-sm rounded-md border border-slate-200 bg-white"
                  >
                    <option value="">{templatesLoading ? 'Loading templates...' : 'Select template'}</option>
                    {templates.map((t) => (
                      <option key={t.sid} value={t.sid}>
                        {t.friendlyName || t.sid}
                      </option>
                    ))}
                  </select>
                  {selectedTemplate && requiredPlaceholders.length > 0 && (
                    <div className="grid gap-2">
                      {requiredPlaceholders.map((k) => (
                        <input
                          key={k}
                          value={templateVariables[k] ?? ''}
                          onChange={(e) => setTemplateVariables((prev) => ({ ...prev, [k]: e.target.value }))}
                          placeholder={`Variable {{${k}}}`}
                          className="w-full h-9 px-2 text-sm rounded-md border border-slate-200 bg-white"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
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
            disabled={isTemplateAllowed && replyMode === 'template'}
            className="w-full mb-3 px-3 py-2.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 resize-y min-h-[72px] disabled:bg-slate-100"
          />
          {errorMessage && <p className="mb-2 text-xs text-red-600">{errorMessage}</p>}
          {isUnifiedMode && !activeConversationId && (
            <p className="mb-2 text-xs text-slate-500">
              This customer does not have an active conversation for the selected channel.
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <SuggestedReplyChip
                suggestion={suggestedReply.suggestion}
                isLoading={suggestedReply.isLoading}
                error={suggestedReply.error}
                onUseSuggestion={setReplyText}
              />
            </div>
            <button
              type="button"
              onClick={handleSendReply}
              disabled={
                (
                  replyMode === 'template' && isTemplateAllowed
                    ? !selectedTemplate
                    : !replyText.trim()
                ) ||
                sendReplyMutation.isPending ||
                !activeConversationId ||
                !activeChannel
              }
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendReplyMutation.isPending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
