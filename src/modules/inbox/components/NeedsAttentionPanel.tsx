import { RefreshCw, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { ToastAction } from '@/shared/components/ui/toast';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useToast } from '@/shared/hooks/use-toast';
import { useInboxAiSweep } from '../hooks/useInboxAiSweep';
import { useMutedSenders } from '../hooks/useMutedSenders';
import { useNeedsAttentionConversations } from '../hooks/useNeedsAttentionConversations';
import { useOwnHandles } from '../hooks/useOwnHandles';
import { useSetNeedsAttentionDismissed } from '../hooks/useSetNeedsAttentionDismissed';
import { InboxListSkeleton } from './InboxListSkeleton';
import type { InboxChannel } from '../types/inbox.types';
import { deriveBallInCourt } from '../utils/inboxBuckets';
import {
  NEEDS_ATTENTION_DEFAULT_PAGE_SIZE,
  NEEDS_ATTENTION_HIGH_PRIORITY,
  NEEDS_ATTENTION_PAGE_SIZES,
  selectNeedsAttentionAll,
  type NeedsAttentionPageSize,
  type ScoredConversation,
} from '../utils/needsAttention';

const MEDIUM_THRESHOLD = 40;
const PAGE_SIZE_STORAGE_KEY = 'needs_attention_page_size';

/**
 * Per-viewer, per-browser only — same shape as InvoiceWorkspace.tsx:62-71.
 * Anything unreadable or not one of the three choices falls back to the default.
 */
const readStoredPageSize = (): NeedsAttentionPageSize => {
  try {
    const stored = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    return (NEEDS_ATTENTION_PAGE_SIZES as readonly number[]).includes(stored)
      ? (stored as NeedsAttentionPageSize)
      : NEEDS_ATTENTION_DEFAULT_PAGE_SIZE;
  } catch {
    return NEEDS_ATTENTION_DEFAULT_PAGE_SIZE;
  }
};

/**
 * Panel-local band. Deliberately not `ScoreBadge`, which carries order-history
 * RFM semantics (AC-002). The numeric priority never renders (FR-014).
 */
type PriorityBand = 'high' | 'medium';

const BAND_LABEL: Record<PriorityBand, string> = { high: 'High', medium: 'Medium' };
const BAND_CLASS: Record<PriorityBand, string> = {
  high: 'bg-gardens-red-lt text-gardens-red-dk',
  medium: 'bg-gardens-amb-lt text-gardens-amb-dk',
};

/** Left stripe per band; the text badge stays, so colour is never the only signal. */
const BAND_STRIPE_CLASS: Record<PriorityBand, string> = {
  high: 'border-l-gardens-red',
  medium: 'border-l-gardens-amb',
};

function bandFor(priority: number): PriorityBand | null {
  if (priority >= NEEDS_ATTENTION_HIGH_PRIORITY) return 'high';
  if (priority >= MEDIUM_THRESHOLD) return 'medium';
  return null;
}

/**
 * Categories that earn a chip. 'other' is deliberately absent — it is the
 * ranker's "no useful label" value, so a chip reading "Other" would be noise
 * rather than information.
 */
const CATEGORY_LABEL: Record<'sales' | 'support' | 'admin', string> = {
  sales: 'Sales',
  support: 'Support',
  admin: 'Admin',
};

function categoryLabelFor(category: string | null | undefined): string | null {
  if (!category || category === 'other') return null;
  return CATEGORY_LABEL[category as keyof typeof CATEGORY_LABEL] ?? null;
}

/**
 * Panel-local copy of the m/h/d convention in inboxBuckets.ts:190-197, which is
 * module-private there; importing it would mean widening that file's exports.
 */
function formatAgeMs(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatAge(iso: string | null | undefined): string | null {
  const parsed = Date.parse(iso ?? '');
  if (Number.isNaN(parsed)) return null;
  const ms = Date.now() - parsed;
  if (ms < 0) return null;
  return formatAgeMs(ms);
}

/**
 * Same wording as the customer list rows (InboxAgingBadge.tsx:59,:61) — "Us · 8h"
 * / "Them · 23d" — off the same exported derivation (inboxBuckets.ts:136). No
 * bucket and no SLA colour: those need the page-level ClassificationContext
 * (UnifiedInboxPage.tsx:513-514), and the row carries its own band badge.
 * The null-ball fallback is defensive only — every scored row in both live orgs
 * carries at least one directional timestamp (verified 2026-09-10).
 */
function waitingLabelFor(conversation: ScoredConversation, now: number): string | null {
  const ball = deriveBallInCourt(conversation, now);
  if (!ball) return formatAge(conversation.last_message_at);
  return `${ball.side === 'us' ? 'Us' : 'Them'} · ${formatAgeMs(ball.sinceMs)}`;
}

/** What a card click reports: enough to select the customer without the page's list. */
export interface NeedsAttentionTarget {
  conversationId: string;
  personId: string | null;
  channel: InboxChannel;
  /** Raw primary_handle, trimmed — the unlinked timeline exact-matches it. */
  handle: string;
}

export interface NeedsAttentionPanelProps {
  /** The page selects the conversation and closes the panel; this only reports the click. */
  onSelect: (target: NeedsAttentionTarget) => void;
}

export function NeedsAttentionPanel({ onSelect }: NeedsAttentionPanelProps) {
  // The panel's own read: scored open rows, unlinked own-handle rows excluded
  // server-side (ruling 2026-10-13, reversing FR-016 / R-006). Still
  // filter-independent: it never sees the page's search/unread filters.
  const { data: conversations = [], isLoading } = useNeedsAttentionConversations();
  const { data: customers = [] } = useCustomersList();
  // Exclusion inputs (see selectNeedsAttentionAll): the org's own handles (the
  // cache entry the query above waits on), and the muted-sender set the
  // customers view's Hidden filter uses.
  const { organizationId } = useOrganization();
  const { ownHandles } = useOwnHandles();
  const { mutedHandles } = useMutedSenders(organizationId);
  // The panel mounts fresh on every open — Radix unmounts SheetContent's children
  // when closed (ui/sheet.tsx:57-72, no forceMount) — so this hook's
  // once-per-mount sweep IS the sweep-on-open, with no host or page change.
  // k = 25 is the function's K_MAX (inbox-ai-rank/index.ts:21).
  const { run, isRunning, lastOutcome } = useInboxAiSweep({ k: 25 });
  const setDismissed = useSetNeedsAttentionDismissed();
  const { toast } = useToast();
  // Focus targets after a dismiss: the next card's dismiss button, else refresh.
  const dismissButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const refreshButtonRef = useRef<HTMLButtonElement>(null);

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((customer) => {
      const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
      const name = fullName || customer.email || customer.phone;
      if (name) map.set(customer.id, name);
    });
    return map;
  }, [customers]);

  const [pageSize, setPageSize] = useState<NeedsAttentionPageSize>(readStoredPageSize);

  const handlePageSizeChange = (next: NeedsAttentionPageSize) => {
    setPageSize(next);
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next));
    } catch {
      /* storage unavailable (private mode, blocked site data) — the choice just
         doesn't survive a reload. */
    }
  };

  const scored = useMemo(
    () =>
      selectNeedsAttentionAll(conversations, {
        ownHandles,
        mutedHandles,
      }),
    [conversations, ownHandles, mutedHandles],
  );

  const items = useMemo(() => scored.slice(0, pageSize), [scored, pageSize]);

  // Newest claim stamp across the whole scored set. ai_scored_at is written at
  // claim time, before the rank (T22 [A6]), so a scored row always carries one —
  // a null here means nothing scored, and the header omits both controls.
  const updatedAge = useMemo(() => {
    let newest: string | null = null;
    let newestMs = Number.NEGATIVE_INFINITY;
    for (const conversation of scored) {
      const parsed = Date.parse(conversation.ai_scored_at ?? '');
      if (Number.isNaN(parsed) || parsed <= newestMs) continue;
      newestMs = parsed;
      newest = conversation.ai_scored_at ?? null;
    }
    return formatAge(newest);
  }, [scored]);

  const handleDismiss = (conversation: ScoredConversation, nextId: string | null) => {
    const previous = conversation.ai_dismissed_at ?? null;
    const value = conversation.last_message_at ?? new Date().toISOString();
    (nextId ? dismissButtonRefs.current.get(nextId) : refreshButtonRef.current)?.focus();
    setDismissed.mutate(
      { conversationId: conversation.id, value },
      {
        onSuccess: () =>
          toast({
            title: 'Dismissed',
            description: 'It comes back when a new message arrives.',
            action: (
              <ToastAction
                altText="Undo dismiss"
                onClick={() =>
                  setDismissed.mutate(
                    { conversationId: conversation.id, value: previous },
                    { onError: () => toast({ title: 'Undo failed', variant: 'destructive' }) },
                  )
                }
              >
                Undo
              </ToastAction>
            ),
          }),
        onError: () => toast({ title: 'Dismiss failed', variant: 'destructive' }),
      },
    );
  };

  if (isLoading) {
    return <InboxListSkeleton label="Loading conversations that need attention" />;
  }

  if (items.length === 0) {
    return <p className="px-4 py-6 font-body text-sm text-gardens-txs">Nothing scored yet</p>;
  }

  // One clock for every row, so two rows never disagree by a tick
  // (same pattern as UnifiedInboxPage.tsx:513's agingNow).
  const agingNow = Date.now();

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
        <p className="flex-1 min-w-0 font-body text-xs text-gardens-txs">
          Open conversations ranked by AI, most urgent first.
        </p>
        <div className="shrink-0 flex items-center gap-1">
          {NEEDS_ATTENTION_PAGE_SIZES.map((size) => {
            const active = size === pageSize;
            return (
              <button
                key={size}
                type="button"
                onClick={() => handlePageSizeChange(size)}
                aria-pressed={active}
                aria-label={`Show ${size} items`}
                className="text-[11px] font-semibold rounded-full px-2 py-0.5 transition-colors"
                style={{
                  // Selected-chip pattern per PipelinePage.tsx:100-102 (acc-lt bg +
                  // acc border), the same pairing the finance toolbar chips use.
                  background: active ? 'var(--g-acc-lt)' : 'transparent',
                  border: `1px solid ${active ? 'var(--g-acc)' : 'var(--g-bdr)'}`,
                  color: active ? 'var(--g-acc-dk)' : 'var(--g-txm)',
                }}
              >
                {size}
              </button>
            );
          })}
        </div>
        {updatedAge && (
          <div className="shrink-0 flex items-center gap-1">
            <span aria-live="polite" className="font-body text-[11px]">
              {lastOutcome === 'failed' && <span className="text-gardens-red-dk">Refresh failed ·</span>}
              {lastOutcome === 'noop' && <span className="text-gardens-txs">Up to date ·</span>}
            </span>
            <span className="font-body text-[11px] text-gardens-txs">Updated {updatedAge}</span>
            <button
              ref={refreshButtonRef}
              type="button"
              onClick={run}
              disabled={isRunning}
              aria-label="Refresh ranking"
              className="p-1 rounded-full text-gardens-txm hover:bg-gardens-page disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`}
                aria-hidden
              />
            </button>
          </div>
        )}
      </div>
      <ul className="flex flex-col gap-2 px-3 pb-3">
        {items.map((conversation, index) => {
          const band = bandFor(conversation.ai_priority);
          const name =
            (conversation.person_id ? customerNameById.get(conversation.person_id) : undefined) ??
            conversation.primary_handle;
          const category = categoryLabelFor(conversation.ai_category);
          const waiting = waitingLabelFor(conversation, agingNow);
          const nextId = items[index + 1]?.id ?? items[index - 1]?.id ?? null;
          return (
            <li key={conversation.id} className="relative">
              <button
                type="button"
                onClick={() =>
                  onSelect({
                    conversationId: conversation.id,
                    personId: conversation.person_id ?? null,
                    channel: conversation.channel,
                    handle: (conversation.primary_handle ?? '').trim(),
                  })
                }
                className={`w-full text-left rounded-lg border border-l-2 border-gardens-bdr ${
                  band ? BAND_STRIPE_CLASS[band] : 'border-l-gardens-bdr'
                } bg-gardens-surf pl-3 pr-8 py-2.5 hover:bg-gardens-page transition-colors`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    title={name}
                    className="min-w-0 truncate font-body text-sm font-semibold text-gardens-tx"
                  >
                    {name}
                  </span>
                  {category && (
                    <span className="shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold bg-gardens-page text-gardens-txs">
                      {category}
                    </span>
                  )}
                  {band && (
                    <span
                      className={`shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold ${BAND_CLASS[band]}`}
                    >
                      {BAND_LABEL[band]}
                    </span>
                  )}
                  {waiting && (
                    <span className="ml-auto shrink-0 pl-1 text-[11px] tabular-nums text-gardens-txm">
                      {waiting}
                    </span>
                  )}
                </div>
                {conversation.ai_reason && (
                  <p className="mt-1 font-body text-xs text-gardens-txs line-clamp-2">
                    {conversation.ai_reason}
                  </p>
                )}
              </button>
              <button
                type="button"
                ref={(el) => {
                  if (el) dismissButtonRefs.current.set(conversation.id, el);
                  else dismissButtonRefs.current.delete(conversation.id);
                }}
                onClick={() => handleDismiss(conversation, nextId)}
                aria-label={`Dismiss ${name}`}
                title="Dismiss"
                className="absolute top-2 right-2 p-1 rounded-full text-gardens-txm hover:text-gardens-tx hover:bg-gardens-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gardens-acc transition-colors"
              >
                <X className="w-3.5 h-3.5" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
