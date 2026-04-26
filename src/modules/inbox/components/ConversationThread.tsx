import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight, Loader2, Send, X, Sparkles, StickyNote } from 'lucide-react';
import { ReplyChannelPills } from '@/modules/inbox/components/ReplyChannelPills';
import { InboxMessageBubble } from '@/modules/inbox/components/InboxMessageBubble';
import { cn } from '@/shared/lib/utils';
import { useSendReply, useSaveInternalNote } from '@/modules/inbox/hooks/useInboxMessages';
import { useSuggestedReply } from '@/modules/inbox/hooks/useSuggestedReply';
import type { InboxMessage } from '@/modules/inbox/types/inbox.types';
import { formatDateTimeDMY } from '@/shared/lib/formatters';
import { ChannelSelector } from './ChannelSelector';
import { fetchWhatsAppTemplates, type WhatsAppTemplateSummary } from '@/modules/inbox/api/inboxTwilio.api';
import { fetchGmailMessageHtml } from '@/modules/inbox/api/inboxGmail.api';
import { supabase } from '@/shared/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  LINK_PERSON_FOR_CHANNEL_MESSAGE,
  SMS_NEW_CONVERSATION_NOT_SUPPORTED,
} from '@/modules/inbox/copy/channelSwitchMessages';
import {
  BUCKET_CHASE_TEMPLATES,
  BUCKET_LABEL,
  type InboxBucket,
} from '@/modules/inbox/utils/inboxBuckets';

/** Font stack for message body so Georgian and other non-Latin scripts render correctly. */
const MESSAGE_BODY_FONT_STACK =
  '"Noto Sans Georgian", "Sylfaen", "Segoe UI", "Segoe UI Symbol", system-ui, sans-serif';
/**
 * Minimal iframe chrome only. Broad rules (body * max-width, table-layout:fixed, width:100% on tables)
 * break nested-table marketing/transactional emails (collapsed columns, vertical text, broken images).
 */
const MESSAGE_BODY_IFRAME_STYLE =
  '<meta http-equiv="Content-Security-Policy" content="' +
    "default-src 'none'; " +
    "style-src 'unsafe-inline'; " +
    "img-src * data: blob:; " +
    "font-src *; " +
    "script-src 'unsafe-inline';" +
  '">' +
  '<style>' +
  'html,body{margin:0;padding:0;}' +
  'html{overflow-x:auto;-webkit-overflow-scrolling:touch;}' +
  'body{font-family:' + MESSAGE_BODY_FONT_STACK + ';}' +
  'img{max-width:100%;height:auto;vertical-align:middle;}' +
  'img[src=""], img:not([src]){display:none;}' +
  'pre,code{white-space:pre-wrap;overflow-x:auto;}' +
  '</style>' +
  '<script>' +
  'function resizeIframe(){' +
  '  try{' +
  '    var h=document.documentElement.scrollHeight||document.body.scrollHeight;' +
  '    if(h>0) window.parent.postMessage({iframeHeight:h,iframeId:document.currentScript&&document.currentScript.closest("iframe")?document.currentScript.closest("iframe").id:""},"*");' +
  '  }catch(e){}' +
  '}' +
  'document.addEventListener("DOMContentLoaded",function(){' +
  '  resizeIframe();' +
  '  document.querySelectorAll("img").forEach(function(img){' +
  '    img.addEventListener("error",function(){this.style.display="none";});' +
  '    img.addEventListener("load",function(){resizeIframe();});' +
  '  });' +
  '});' +
  '</script>';

/** WhatsApp Business API: freeform replies allowed within 24h of last customer inbound message. */
const WHATSAPP_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

function inboxMessageTimestampMs(m: InboxMessage): number {
  const raw = m.sent_at || m.created_at;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function formatBubbleTimestamp(value: string): string {
  // Standard: DD-MM-YYYY HH:MM (24h)
  const out = formatDateTimeDMY(value, { withTime: true, withSeconds: false, use12Hour: false });
  return out === '—' ? '' : out;
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    .replace(/<meta[\s\S]*?>/gi, '')
    /* Native lazy-load often never fires inside sandboxed srcDoc iframes; keep images loadable. */
    .replace(/\sloading\s*=\s*["']lazy["']/gi, ' loading="eager"')
    .replace(/\sloading\s*=\s*lazy\b/gi, ' loading="eager"');
}

/** QP soft line breaks: `=\n` joins wrapped MIME lines so tags/entities aren’t split. */
function unwrapQuotedPrintableSoftBreaks(s: string): string {
  return s.replace(/=\r\n/g, '').replace(/=\n/g, '');
}

/**
 * DB/sync sometimes stores markup entity-encoded (`&lt;html` …). Browsers then show source as text in iframes.
 * Decode common HTML entities while preserving real tags (textarea trick).
 */
function decodeHtmlEntitiesForEmail(html: string): string {
  if (!html) return html;
  if (typeof document === 'undefined') return html;
  try {
    const ta = document.createElement('textarea');
    let cur = html;
    for (let i = 0; i < 3; i++) {
      ta.innerHTML = cur;
      const next = ta.value;
      if (next === cur) break;
      cur = next;
    }
    return cur;
  } catch {
    return html;
  }
}

/** Normalize payload from DB / Gmail before detection and iframe use. */
function preprocessEmailHtmlPayload(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  return decodeHtmlEntitiesForEmail(unwrapQuotedPrintableSoftBreaks(t));
}

const FULL_DOC_HEAD_SAMPLE_LEN = 12000;

function isFullHtmlDocument(html: string): boolean {
  const s = html.slice(0, FULL_DOC_HEAD_SAMPLE_LEN);
  return (
    /<!doctype/i.test(s) ||
    /<html[\s>]/i.test(s) ||
    (/<head[\s>]/i.test(s) && /<body[\s>]/i.test(s))
  );
}

/**
 * Prepending raw `<style>` before `<!DOCTYPE` / `<html>` breaks document parsing; some iframes then show source as text.
 * Pass **sanitized** HTML only. Fragments are wrapped in a minimal document with our styles in `<head>`.
 */
function buildEmailIframeSrcDoc(sanitizedHtml: string): string {
  const trimmed = sanitizedHtml.trim();
  if (!trimmed) {
    return `<!DOCTYPE html><html><head>${MESSAGE_BODY_IFRAME_STYLE}</head><body></body></html>`;
  }

  if (!isFullHtmlDocument(trimmed)) {
    return `<!DOCTYPE html><html><head>${MESSAGE_BODY_IFRAME_STYLE}</head><body>${trimmed}</body></html>`;
  }

  if (/<\/head>/i.test(trimmed)) {
    return trimmed.replace(/<\/head>/i, `${MESSAGE_BODY_IFRAME_STYLE}</head>`);
  }

  if (/<head[\s>]/i.test(trimmed)) {
    return trimmed.replace(/<head([^>]*)>/i, `<head$1>${MESSAGE_BODY_IFRAME_STYLE}`);
  }

  if (/<html(\s[^>]*)?>/i.test(trimmed)) {
    return trimmed.replace(/<html(\s[^>]*)?>/i, (m) => `${m}<head>${MESSAGE_BODY_IFRAME_STYLE}</head>`);
  }

  if (/<!doctype/i.test(trimmed) && /<body[\s>]/i.test(trimmed)) {
    return trimmed.replace(/<body(\s[^>]*)?>/i, `<head>${MESSAGE_BODY_IFRAME_STYLE}</head><body$1>`);
  }

  return `<!DOCTYPE html><html><head>${MESSAGE_BODY_IFRAME_STYLE}</head><body>${trimmed}</body></html>`;
}

/**
 * Classifies `<img src="...">` in the **final** iframe document (after wrap + sanitization).
 * Set `VITE_DEBUG_EMAIL_IMG_SRC=1` in `.env` (dev) to log results per message — confirms whether
 * missing images are `cid:` (needs Gmail attachment mapping) vs `https:` (network/referrer/host).
 */
export function analyzeEmailImgSrcPatterns(html: string): {
  cid: number;
  https: number;
  http: number;
  data: number;
  relative: number;
  other: number;
  samples: string[];
} {
  const counts = { cid: 0, https: 0, http: 0, data: 0, relative: 0, other: 0 };
  const samples: string[] = [];
  const re = /<img\b[^>]*?\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const src = (m[2] ?? m[3] ?? m[4] ?? '').trim();
    if (!src) continue;
    if (samples.length < 16) samples.push(src.length > 120 ? `${src.slice(0, 120)}…` : src);
    const low = src.toLowerCase();
    if (low.startsWith('cid:')) counts.cid++;
    else if (low.startsWith('data:')) counts.data++;
    else if (low.startsWith('https://')) counts.https++;
    else if (low.startsWith('http://')) counts.http++;
    else if (
      low.startsWith('/') ||
      low.startsWith('./') ||
      low.startsWith('../') ||
      !/^[\w+.-]+:/i.test(src)
    ) {
      counts.relative++;
    } else counts.other++;
  }
  return { ...counts, samples };
}

const lastEmailImgSrcDiagSig: Record<string, string> = {};

function buildEmailIframeSrcDocWithOptionalImgDiagnostics(
  sanitizedHtml: string,
  debugLabel?: string
): string {
  const doc = buildEmailIframeSrcDoc(sanitizedHtml);
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_DEBUG_EMAIL_IMG_SRC === '1' &&
    debugLabel
  ) {
    const a = analyzeEmailImgSrcPatterns(doc);
    const n = a.cid + a.https + a.http + a.data + a.relative + a.other;
    if (n > 0) {
      const sig = `${a.cid},${a.https},${a.http},${a.data},${a.relative},${a.other}|${a.samples.join('|')}`;
      if (lastEmailImgSrcDiagSig[debugLabel] !== sig) {
        lastEmailImgSrcDiagSig[debugLabel] = sig;
        console.warn('[email-img-src]', debugLabel, {
          counts: { cid: a.cid, https: a.https, http: a.http, data: a.data, relative: a.relative, other: a.other },
          samples: a.samples,
          totalImgs: n,
        });
      }
    }
  }
  return doc;
}

/** True when stored plain-text field actually holds HTML email (e.g. sync only filled body_text). */
function looksLikeHtml(content: string): boolean {
  const s = (content ?? '').trim();
  if (s.length < 10) return false;
  const head = s.slice(0, 12000);
  if (/<!doctype/i.test(head)) return true;
  if (/<html[\s>]/i.test(head)) return true;
  if (/<head[\s>]/i.test(head)) return true;
  if (/<body[\s>]/i.test(head)) return true;
  if (/<table[\s>]/i.test(head)) return true;
  if (/<style[\s>]/i.test(head)) return true;
  if (/<div[\s>]/i.test(head)) return true;
  if (/<p[\s>]/i.test(head)) return true;
  if (/<meta[\s>]/i.test(head)) return true;
  const tags = head.match(/<\/?[a-z][a-z0-9:-]*(?:\s[^>]*)?>/gi);
  return (tags?.length ?? 0) >= 2;
}

function renderPlainTextWithLinks(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  const lines = (text ?? '').split('\n');
  return lines.map((line, lineIdx) => {
    const chunks: React.ReactNode[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;
    const regex = new RegExp(urlRegex);
    while ((match = regex.exec(line)) !== null) {
      const start = match.index;
      const rawUrl = match[0];
      if (start > cursor) chunks.push(line.slice(cursor, start));
      const href = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;
      chunks.push(
        <a
          key={`url-${lineIdx}-${start}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="underline text-emerald-700 hover:text-emerald-800 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {rawUrl}
        </a>
      );
      cursor = start + rawUrl.length;
    }
    if (cursor < line.length) chunks.push(line.slice(cursor));
    return (
      <span key={`line-${lineIdx}`} className="contents">
        {chunks.length > 0 ? chunks : line}
        {lineIdx < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
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
  /** Customers tab: linked person handles for gating Start conversation */
  startConversationContext?: {
    personId: string;
    email: string | null;
    phone: string | null;
  } | null;
  /** Customers tab: open parent modal to create conversation (email / whatsapp only). */
  onRequestStartConversation?: (channel: 'email' | 'whatsapp') => void;
  /**
   * Customers tab: Reply via = send channel only (does not navigate / must not call `onReplyChannelChange`).
   * Also limits syncing `selectedChannel` from `effectiveDefault` to customer switches (`autoScrollResetKey`), not every message update.
   */
  sendChannelOnlyMode?: boolean;
  /**
   * Inbox conversation has a linked `person_id` — show "Start conversation" / missing-handle hints, not "Link a person".
   */
  linkedInboxPersonId?: string | null;
  /**
   * Workflow bucket for this conversation (enquiry / order / cemetery).
   * When set, a one-click chase-template chip appears in the composer toolbar.
   */
  bucket?: InboxBucket | null;
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

function extractGmailMeta(message: InboxMessage): { messageId: string | null; threadId: string | null } {
  const meta = message.meta as { gmail?: { messageId?: string; threadId?: string } } | null | undefined;
  return {
    messageId: meta?.gmail?.messageId ?? null,
    threadId: meta?.gmail?.threadId ?? null,
  };
}

/**
 * Single source for email iframe HTML. Order: body_html → Gmail cache (only if trim non-empty) → body_text if HTML-like.
 * Ignores Gmail cache entries that are empty/whitespace so a weak API result does not override good body_text HTML.
 */
function resolveEmailDisplayHtml(
  message: InboxMessage,
  gmailHtmlByMessageId: Record<string, string>
): string {
  const directRaw = message.body_html?.trim();
  if (directRaw) {
    const direct = preprocessEmailHtmlPayload(directRaw);
    if (direct) return direct;
  }

  const { messageId } = extractGmailMeta(message);
  if (messageId != null && Object.prototype.hasOwnProperty.call(gmailHtmlByMessageId, messageId)) {
    const trimmedRaw = (gmailHtmlByMessageId[messageId] ?? '').trim();
    if (trimmedRaw.length > 0) {
      const trimmed = preprocessEmailHtmlPayload(trimmedRaw);
      if (trimmed.length > 0) return trimmed;
    }
  }

  const textRaw = message.body_text?.trim() ?? '';
  if (looksLikeHtml(textRaw)) return preprocessEmailHtmlPayload(textRaw) || textRaw;
  const textDecoded = preprocessEmailHtmlPayload(textRaw);
  if (textDecoded && looksLikeHtml(textDecoded)) return textDecoded;
  return '';
}

/**
 * Candidate HTML from current props/cache. Sticky ref may override when refetch empties body_*.
 * Upgrade cache only: fill empty, replace with authoritative body_html, or strictly longer HTML.
 */
function stickyResolvedEmailHtml(
  message: InboxMessage,
  candidateHtml: string,
  stableEmailHtmlByMessageIdRef: React.MutableRefObject<Record<string, string>>
): string {
  const id = message.id;
  const store = stableEmailHtmlByMessageIdRef.current;
  const c = candidateHtml.trim();
  const prev = (store[id] ?? '').trim();
  const authored = (message.body_html ?? '').trim();

  if (c.length > 0) {
    if (prev.length === 0) {
      store[id] = c;
    } else if (authored.length > 0 && c === authored) {
      store[id] = c;
    } else if (c.length > prev.length) {
      store[id] = c;
    }
  }

  const stable = (store[id] ?? '').trim();
  return stable.length > 0 ? stable : c;
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

function ChaseTemplatesChip({
  bucket,
  participantName,
  onApply,
}: {
  bucket: InboxBucket;
  participantName: string | null;
  onApply: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const templates = BUCKET_CHASE_TEMPLATES[bucket];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`One-click ${BUCKET_LABEL[bucket].toLowerCase()} chase templates`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-gardens-bdr bg-gardens-surf2 text-gardens-txs hover:bg-gardens-page"
      >
        <Send className="h-3.5 w-3.5 shrink-0 text-gardens-txm" />
        <span>Chase</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute z-20 bottom-full mb-1 left-0 w-56 rounded-md border border-gardens-bdr bg-gardens-surf2 shadow-md py-1">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-gardens-txm">
            {BUCKET_LABEL[bucket]}
          </div>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onApply(t.body({ participantName }));
                setOpen(false);
              }}
              className="block w-full text-left px-2 py-1.5 text-xs text-gardens-tx hover:bg-gardens-page"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
  conditionalAutoScroll = false,
  autoScrollResetKey = null,
  showEmailSubjectInHeader = false,
  enabledReplyChannels = undefined,
  startConversationContext = null,
  onRequestStartConversation,
  sendChannelOnlyMode = false,
  linkedInboxPersonId = null,
  bucket = null,
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
  const [viewingEmailMessage, setViewingEmailMessage] = useState<InboxMessage | null>(null);
  const [emailHtmlByGmailMessageId, setEmailHtmlByGmailMessageId] = useState<Record<string, string>>({});
  const [emailHtmlLoadingByMessageId, setEmailHtmlLoadingByMessageId] = useState<Record<string, boolean>>({});
  const [emailHtmlErrorByMessageId, setEmailHtmlErrorByMessageId] = useState<Record<string, string | null>>({});
  const [collapsedEmailMessageIds, setCollapsedEmailMessageIds] = useState<Set<string>>(new Set());
  const [emailViewLoading, setEmailViewLoading] = useState(false);
  const [emailViewError, setEmailViewError] = useState<string | null>(null);
  /** Sticky per inbox message.id: once we render non-empty HTML, refetch cannot downgrade to plain text. */
  const stableEmailHtmlByMessageIdRef = useRef<Record<string, string>>({});
  /** Set `VITE_DEBUG_INBOX_EMAIL_FLIP=1` to log when per-message email render snapshot changes (dev only). */
  const emailFlipDebugPrevRef = useRef<Record<string, string>>({});
  const sendReplyMutation = useSendReply();
  const saveNoteMutation = useSaveInternalNote();
  const composerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isNearBottomRef = useRef(true);
  const lastLengthRef = useRef(0);
  const lastResetKeyRef = useRef<string | null>(null);
  const lastSendChannelResetKeyRef = useRef<string | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const emailHtmlPrefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Unified mode: sync composer channel from timeline default when appropriate.
  // Customers tab (`sendChannelOnlyMode`): only when switching customer (`autoScrollResetKey`), not on every message tick (preserves send-channel choice).
  useEffect(() => {
    if (replyTo) return;
    if (!isUnifiedMode) return;
    if (effectiveDefault == null) return;

    if (sendChannelOnlyMode) {
      const key = autoScrollResetKey ?? '';
      if (lastSendChannelResetKeyRef.current === key) return;
      lastSendChannelResetKeyRef.current = key;
    }

    if (enabledReplyChannels && enabledReplyChannels.length > 0) {
      if (enabledReplyChannels.includes(effectiveDefault)) {
        setSelectedChannel(effectiveDefault);
        channelBeforeReplyRef.current = effectiveDefault;
      }
    } else if (conversationIdByChannel?.[effectiveDefault]) {
      setSelectedChannel(effectiveDefault);
      channelBeforeReplyRef.current = effectiveDefault;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    effectiveDefault,
    conversationIdByChannel,
    enabledReplyChannels,
    replyTo,
    isUnifiedMode,
    sendChannelOnlyMode,
    autoScrollResetKey,
  ]);

  const activeConversationId = isUnifiedMode
    ? conversationIdByChannel[effectiveChannel] ?? null
    : conversationId ?? null;
  const activeChannel = isUnifiedMode ? effectiveChannel : (channel ?? null);

  const whatsappInboundScoped = useMemo(() => {
    if (!activeConversationId) return [] as InboxMessage[];
    return messages.filter(
      (m) =>
        m.conversation_id === activeConversationId &&
        m.channel === 'whatsapp' &&
        m.direction === 'inbound'
    );
  }, [messages, activeConversationId]);

  const lastInboundWhatsAppForSession = useMemo(() => {
    if (whatsappInboundScoped.length === 0) return null;
    return whatsappInboundScoped.reduce((best, m) =>
      inboxMessageTimestampMs(m) >= inboxMessageTimestampMs(best) ? m : best
    );
  }, [whatsappInboundScoped]);

  const isWhatsAppSessionClosed = useMemo(() => {
    if (activeChannel !== 'whatsapp') return false;
    if (!activeConversationId) return true;
    if (whatsappInboundScoped.length === 0) return true;
    if (!lastInboundWhatsAppForSession) return true;
    const ts = inboxMessageTimestampMs(lastInboundWhatsAppForSession);
    return Date.now() - ts >= WHATSAPP_SESSION_WINDOW_MS;
  }, [activeChannel, activeConversationId, whatsappInboundScoped, lastInboundWhatsAppForSession]);

  const messageCountForActiveConversation = useMemo(() => {
    if (!activeConversationId) return 0;
    return messages.filter((m) => m.conversation_id === activeConversationId).length;
  }, [messages, activeConversationId]);

  const activeConversationEmailMessages = useMemo(() => {
    if (!activeConversationId) return [] as InboxMessage[];
    return messages.filter(
      (m) => m.conversation_id === activeConversationId && m.channel === 'email'
    );
  }, [messages, activeConversationId]);

  const handleReplyClick = (message: InboxMessage) => {
    const preview = derivePreview(message);
    onReplyToMessage?.({ messageId: message.id, channel: message.channel, preview });
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      textareaRef.current?.focus();
    });
  };
  const availableChannels = useMemo(() => {
    if (enabledReplyChannels !== undefined) {
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

  const lastInboundForSuggestedReply = useMemo(() => {
    if (!activeConversationId || !activeChannel) return null;
    const inbound = messages.filter(
      (m) =>
        m.conversation_id === activeConversationId &&
        m.channel === activeChannel &&
        m.direction === 'inbound'
    );
    if (inbound.length === 0) return null;
    return inbound.reduce((best, m) =>
      inboxMessageTimestampMs(m) >= inboxMessageTimestampMs(best) ? m : best
    );
  }, [messages, activeConversationId, activeChannel]);
  const suggestedReply = useSuggestedReply(lastInboundForSuggestedReply?.id ?? null);
  const isTemplateAllowed = activeChannel === 'whatsapp';
  const showWhatsAppModeToggle = isTemplateAllowed && !isWhatsAppSessionClosed;
  const showWhatsAppTemplateComposer =
    isTemplateAllowed && (replyMode === 'template' || isWhatsAppSessionClosed);
  const hasHandleForNewConversation =
    !!startConversationContext &&
    (effectiveChannel === 'email'
      ? !!startConversationContext.email?.trim()
      : effectiveChannel === 'whatsapp'
        ? !!startConversationContext.phone?.trim()
        : false);
  const showStartConversationButton =
    isUnifiedMode &&
    !activeConversationId &&
    (effectiveChannel === 'email' || effectiveChannel === 'whatsapp') &&
    hasHandleForNewConversation &&
    !!onRequestStartConversation;
  const showLinkPersonHint =
    isUnifiedMode &&
    !activeConversationId &&
    (effectiveChannel === 'email' || effectiveChannel === 'whatsapp') &&
    !linkedInboxPersonId;
  const showMissingHandleHint =
    isUnifiedMode &&
    !activeConversationId &&
    (effectiveChannel === 'email' || effectiveChannel === 'whatsapp') &&
    !!startConversationContext &&
    !hasHandleForNewConversation;
  const showSmsUnsupportedUnified =
    isUnifiedMode && !activeConversationId && effectiveChannel === 'sms';
  const selectedTemplate = templates.find((t) => t.sid === selectedTemplateSid) ?? null;
  const requiredPlaceholders = selectedTemplate ? extractPlaceholders(selectedTemplate.body) : [];

  const emailDisplayHtmlByInboxMessageId = useMemo(() => {
    const store = stableEmailHtmlByMessageIdRef.current;
    const activeIds = new Set<string>();
    const map: Record<string, string> = {};
    for (const m of messages) {
      if (m.channel !== 'email' || m.message_type === 'internal_note') continue;
      activeIds.add(m.id);
      const candidate = resolveEmailDisplayHtml(m, emailHtmlByGmailMessageId);
      map[m.id] = stickyResolvedEmailHtml(m, candidate, stableEmailHtmlByMessageIdRef);
    }
    const keepViewerId = viewingEmailMessage?.id;
    for (const k of Object.keys(store)) {
      if (!activeIds.has(k) && k !== keepViewerId) delete store[k];
    }
    return map;
  }, [messages, emailHtmlByGmailMessageId, viewingEmailMessage?.id]);

  const viewingEmailResolvedHtml = useMemo(() => {
    if (!viewingEmailMessage) return '';
    const candidate = resolveEmailDisplayHtml(viewingEmailMessage, emailHtmlByGmailMessageId);
    return stickyResolvedEmailHtml(viewingEmailMessage, candidate, stableEmailHtmlByMessageIdRef);
  }, [viewingEmailMessage, emailHtmlByGmailMessageId]);

  const ensureEmailHtmlLoaded = async (message: InboxMessage) => {
    if (message.channel !== 'email') return;
    if (message.body_html?.trim()) return;
    const { messageId } = extractGmailMeta(message);
    if (!messageId) return;
    if (Object.prototype.hasOwnProperty.call(emailHtmlByGmailMessageId, messageId)) return;
    if (emailHtmlLoadingByMessageId[message.id]) return;

    setEmailHtmlErrorByMessageId((prev) => ({ ...prev, [message.id]: null }));
    setEmailHtmlLoadingByMessageId((prev) => ({ ...prev, [message.id]: true }));
    try {
      const html = await fetchGmailMessageHtml(messageId);
      const trimmed = (html ?? '').trim();
      setEmailHtmlByGmailMessageId((prev) => ({ ...prev, [messageId]: trimmed }));
    } catch (e) {
      setEmailHtmlErrorByMessageId((prev) => ({
        ...prev,
        [message.id]: e instanceof Error ? e.message : 'Failed to load original email',
      }));
    } finally {
      setEmailHtmlLoadingByMessageId((prev) => ({ ...prev, [message.id]: false }));
    }
  };

  const toggleEmailCollapsed = (messageId: string) => {
    setCollapsedEmailMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const openEmailViewer = async (message: InboxMessage) => {
    setViewingEmailMessage(message);
    setEmailViewError(null);
    const embeddedHtml = message.body_html?.trim();
    if (embeddedHtml) return;
    if (looksLikeHtml(message.body_text ?? '')) return;
    if ((stableEmailHtmlByMessageIdRef.current[message.id] ?? '').trim().length > 0) return;
    const { messageId } = extractGmailMeta(message);
    if (!messageId) {
      setEmailViewError('Missing Gmail message ID for this email.');
      return;
    }
    if ((emailHtmlByGmailMessageId[messageId] ?? '').trim().length > 0) return;
    setEmailViewLoading(true);
    try {
      const html = await fetchGmailMessageHtml(messageId);
      const trimmed = (html ?? '').trim();
      setEmailHtmlByGmailMessageId((prev) => ({ ...prev, [messageId]: trimmed }));
    } catch (e) {
      setEmailViewError(e instanceof Error ? e.message : 'Failed to load original email');
    } finally {
      setEmailViewLoading(false);
    }
  };

  useEffect(() => {
    if (emailHtmlPrefetchTimeoutRef.current) {
      clearTimeout(emailHtmlPrefetchTimeoutRef.current);
      emailHtmlPrefetchTimeoutRef.current = null;
    }
    if (!activeConversationId || activeConversationEmailMessages.length === 0) return;
    emailHtmlPrefetchTimeoutRef.current = setTimeout(() => {
      activeConversationEmailMessages.forEach((m) => {
        void ensureEmailHtmlLoaded(m);
      });
      emailHtmlPrefetchTimeoutRef.current = null;
    }, 100);
    return () => {
      if (emailHtmlPrefetchTimeoutRef.current) {
        clearTimeout(emailHtmlPrefetchTimeoutRef.current);
        emailHtmlPrefetchTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, activeConversationEmailMessages]);

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
      if (emailHtmlPrefetchTimeoutRef.current) {
        clearTimeout(emailHtmlPrefetchTimeoutRef.current);
        emailHtmlPrefetchTimeoutRef.current = null;
      }
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
    if (!isTemplateAllowed || !isWhatsAppSessionClosed) return;
    setReplyMode('template');
    setTemplatesOpen(true);
  }, [isTemplateAllowed, isWhatsAppSessionClosed]);

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
    if (isTemplateAllowed && isWhatsAppSessionClosed && replyMode !== 'template') {
      setReplyMode('template');
      setTemplatesOpen(true);
      setErrorMessage(
        'WhatsApp session expired — only template messages can be sent until the customer replies.'
      );
      return;
    }
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
    const isFirstEmailMessage =
      activeChannel === 'email' && messageCountForActiveConversation === 0;
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
          const emailHtmlBody =
            isEmail && !isInternalNote ? emailDisplayHtmlByInboxMessageId[message.id] ?? '' : '';
          const showAsHtml = isEmail && !isInternalNote && emailHtmlBody.trim().length > 0;
          const isEmailHtmlLoading = !!emailHtmlLoadingByMessageId[message.id];

          if (
            import.meta.env.DEV &&
            import.meta.env.VITE_DEBUG_INBOX_EMAIL_FLIP === '1' &&
            isEmail &&
            !isInternalNote
          ) {
            const { messageId: gmailMsgId } = extractGmailMeta(message);
            const gmailCacheLen =
              gmailMsgId != null &&
              Object.prototype.hasOwnProperty.call(emailHtmlByGmailMessageId, gmailMsgId)
                ? (emailHtmlByGmailMessageId[gmailMsgId] ?? '').length
                : -1;
            const candidateOnly = resolveEmailDisplayHtml(message, emailHtmlByGmailMessageId);
            const srcDocForLog = showAsHtml
              ? buildEmailIframeSrcDoc(sanitizeHtml(emailHtmlBody))
              : '';
            const snap = {
              messageId: message.id,
              renderMode: showAsHtml ? 'iframe' : isEmailHtmlLoading ? 'loading' : 'plain',
              bodyHtmlLen: message.body_html?.length ?? 0,
              bodyTextLen: body.length,
              looksLikeHtmlBodyText: looksLikeHtml(body),
              gmailMessageId: gmailMsgId,
              gmailCacheLen,
              candidateResolvedLen: candidateOnly.length,
              finalResolvedLen: emailHtmlBody.length,
              stableStoreLen: (stableEmailHtmlByMessageIdRef.current[message.id] ?? '').length,
              finalResolved300: emailHtmlBody.slice(0, 300),
              srcDoc300: srcDocForLog.slice(0, 300),
            };
            const sig = JSON.stringify(snap);
            const prev = emailFlipDebugPrevRef.current[message.id];
            if (sig !== prev) {
              console.warn('[inbox-email-flip]', snap, prev ? { previous: JSON.parse(prev) } : {});
              emailFlipDebugPrevRef.current[message.id] = sig;
            }
          }
          const emailHtmlError = emailHtmlErrorByMessageId[message.id];
          const isEmailCollapsed = isEmail && !isInternalNote && collapsedEmailMessageIds.has(message.id);
          const isClickable = readOnly && !!onMessageClick;
          const showReplyAction = isUnifiedMode && !!onReplyToMessage && !readOnly && !isInternalNote;
          const metaLine = isInternalNote
            ? null
            : showEmailSubjectInHeader && message.channel === 'email'
              ? null
              : buildMetaLine(message);
          const emailSubjectInHeader =
            !isInternalNote && showEmailSubjectInHeader && message.channel === 'email'
              ? message.subject?.trim()
                ? message.subject.trim()
                : '(No subject)'
              : null;
          const senderName = isInternalNote
            ? 'Internal note'
            : isInbound
              ? participantName ?? message.from_handle
              : message.channel === 'whatsapp'
                ? (() => {
                    const senderEmail = getMetaSenderEmail(message);
                    if (!senderEmail) return 'You';
                    return senderEmail.toLowerCase() === staffEmail.trim().toLowerCase() ? 'You' : senderEmail;
                  })()
                : 'You';

          const bodyContent = isEmail && !isInternalNote ? (
            <>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-slate-600 truncate pr-2">
                  {message.subject?.trim() || '(No subject)'} {message.from_handle ? `• ${message.from_handle}` : ''}
                </div>
                <button
                  type="button"
                  className="inline-flex items-center rounded p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleEmailCollapsed(message.id);
                  }}
                  aria-label={isEmailCollapsed ? 'Expand email' : 'Collapse email'}
                  title={isEmailCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isEmailCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
              {!isEmailCollapsed && (
                <>
                  {showAsHtml ? (
                    <div
                      className="w-full max-w-none rounded border border-slate-200 bg-white min-h-[200px]"
                      style={{
                        resize: 'both',
                        overflow: 'auto',
                        width: '100%',
                        minWidth: '300px',
                        minHeight: '200px',
                        height: '400px',
                        maxHeight: '600px',
                      }}
                    >
                      <iframe
                        id="email-iframe-thread"
                        sandbox="allow-same-origin allow-scripts"
                        referrerPolicy="no-referrer"
                        srcDoc={buildEmailIframeSrcDocWithOptionalImgDiagnostics(
                          sanitizeHtml(emailHtmlBody),
                          `thread:${message.id}`
                        )}
                        title="Email content"
                        className="block w-full h-full max-w-none border-0 bg-white text-slate-900"
                        onLoad={(e) => {
                          try {
                            const iframe = e.currentTarget;
                            const doc = iframe.contentDocument || iframe.contentWindow?.document;
                            if (doc) {
                              const h = doc.documentElement.scrollHeight || doc.body?.scrollHeight || 0;
                              if (h > 0) {
                                const wrapper = iframe.parentElement;
                                if (wrapper) wrapper.style.height = h + 'px';
                              }
                            }
                          } catch {
                            // Ignore iframe sizing failures.
                          }
                        }}
                      />
                    </div>
                  ) : isEmailHtmlLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading original email...
                    </div>
                  ) : (
                    <p className="text-sm break-words break-all" style={{ fontFamily: MESSAGE_BODY_FONT_STACK }}>
                      {renderPlainTextWithLinks(body)}
                    </p>
                  )}
                </>
              )}
              {emailHtmlError ? (
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-xs text-red-600">{emailHtmlError}</span>
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-slate-700 underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openEmailViewer(message);
                    }}
                  >
                    Open viewer fallback
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm break-words" style={{ fontFamily: MESSAGE_BODY_FONT_STACK }}>
              {renderPlainTextWithLinks(body)}
            </p>
          );

          return (
            <InboxMessageBubble
              key={message.id}
              direction={isInternalNote ? 'note' : isInbound ? 'inbound' : 'outbound'}
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
        className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden scrollbar-hide space-y-6 px-4 sm:px-8 py-6 bg-gardens-page"
      >
        {messageList}
      </div>

      {!readOnly && (
        <div ref={composerRef} className="shrink-0 border-t border-gardens-bdr pt-4 pb-3 px-4 min-w-0 bg-gardens-surf">
          {isWhatsAppSessionClosed && isTemplateAllowed && (
            <div
              className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
              role="status"
            >
              WhatsApp session expired. You can only send template messages until the customer replies.
            </div>
          )}
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
                if (!sendChannelOnlyMode) onReplyChannelChange?.(ch);
              }}
              disabledChannels={disabledChannels}
            />
          ) : availableChannels.length > 0 ? (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-gardens-txm">Reply via</span>
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
              {showWhatsAppModeToggle && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Mode</span>
                  <button
                    type="button"
                    onClick={() => setReplyMode('freeform')}
                    className={cn(
                      'px-2 py-1 rounded-md text-xs border',
                      replyMode === 'freeform'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white border-slate-200'
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
                      replyMode === 'template'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white border-slate-200'
                    )}
                  >
                    Template
                  </button>
                </div>
              )}
              {showWhatsAppTemplateComposer && (
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
            disabled={
              (isUnifiedMode && !activeConversationId) ||
              (isTemplateAllowed && (replyMode === 'template' || isWhatsAppSessionClosed))
            }
            className="w-full mb-3 px-3 py-2.5 text-sm rounded-lg border border-gardens-bdr bg-gardens-surf2 text-gardens-tx placeholder:text-gardens-txm focus:outline-none focus:ring-2 focus:ring-gardens-acc/30 focus:border-gardens-acc resize-y min-h-[72px] disabled:bg-gardens-page disabled:opacity-70"
          />
          {errorMessage && <p className="mb-2 text-xs text-red-600">{errorMessage}</p>}
          {isUnifiedMode && !activeConversationId && (
            <div className="mb-2 space-y-2 text-xs text-slate-600">
              {showSmsUnsupportedUnified && <p>{SMS_NEW_CONVERSATION_NOT_SUPPORTED}</p>}
              {showLinkPersonHint && <p>{LINK_PERSON_FOR_CHANNEL_MESSAGE}</p>}
              {showMissingHandleHint &&
                (effectiveChannel === 'email' ? (
                  <p>
                    This customer has no email address on file. Update the customer record to start an
                    email conversation.
                  </p>
                ) : (
                  <p>
                    This customer has no phone number on file. Update the customer record to start a
                    WhatsApp conversation.
                  </p>
                ))}
              {showStartConversationButton && (
                <button
                  type="button"
                  onClick={() =>
                    onRequestStartConversation?.(
                      effectiveChannel === 'email' ? 'email' : 'whatsapp'
                    )
                  }
                  className="inline-flex items-center rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  Start conversation
                </button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
              {bucket && (
                <ChaseTemplatesChip
                  bucket={bucket}
                  participantName={participantName}
                  onApply={setReplyText}
                />
              )}
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
                      onSuccess: () => {
                        setReplyText('');
                        onSendSuccess?.();
                      },
                      onError: (err) =>
                        setErrorMessage(err instanceof Error ? err.message : 'Failed to save note'),
                    }
                  );
                }}
                disabled={
                  !replyText.trim() ||
                  saveNoteMutation.isPending ||
                  !activeConversationId ||
                  !activeChannel
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
                  (replyMode === 'template' && isTemplateAllowed ? !selectedTemplate : !replyText.trim()) ||
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
        </div>
      )}
      <Dialog open={!!viewingEmailMessage} onOpenChange={(open) => !open && setViewingEmailMessage(null)}>
        <DialogContent className="w-[95vw] max-w-[1200px] h-[90vh] p-0 overflow-hidden">
          <div className="h-full flex flex-col">
            <DialogHeader className="px-5 py-4 border-b">
              <DialogTitle className="text-base">
                {viewingEmailMessage?.subject?.trim() || '(No subject)'}
              </DialogTitle>
              <div className="text-xs text-slate-500 space-y-0.5">
                <div>From: {viewingEmailMessage?.from_handle || '—'}</div>
                <div>Date: {viewingEmailMessage ? formatBubbleTimestamp(viewingEmailMessage.sent_at) : '—'}</div>
              </div>
              {viewingEmailMessage && (
                <div className="pt-2 flex items-center gap-2">
                  {(() => {
                    const { threadId } = extractGmailMeta(viewingEmailMessage);
                    if (!threadId) return null;
                    return (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`https://mail.google.com/mail/u/0/#inbox/${threadId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Gmail
                        </a>
                      </Button>
                    );
                  })()}
                </div>
              )}
            </DialogHeader>
            <div className="flex-1 min-h-0 bg-white">
              {viewingEmailMessage && (
                <>
                  {emailViewLoading && !viewingEmailResolvedHtml && (
                    <div className="h-full flex items-center justify-center text-sm text-slate-500">
                      Loading original email...
                    </div>
                  )}
                  {!emailViewLoading && emailViewError && !viewingEmailResolvedHtml && (
                    <div className="h-full flex items-center justify-center text-sm text-red-600 px-6 text-center">
                      {emailViewError}
                    </div>
                  )}
                  {(viewingEmailResolvedHtml || viewingEmailMessage.body_text) && (
                    <iframe
                      sandbox=""
                      referrerPolicy="no-referrer"
                      srcDoc={buildEmailIframeSrcDocWithOptionalImgDiagnostics(
                        sanitizeHtml(
                          viewingEmailResolvedHtml ||
                            `<pre>${(viewingEmailMessage.body_text || '')
                              .replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;')}</pre>`
                        ),
                        `dialog:${viewingEmailMessage.id}`
                      )}
                      title="Original email"
                      className="w-full h-full border-0"
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
