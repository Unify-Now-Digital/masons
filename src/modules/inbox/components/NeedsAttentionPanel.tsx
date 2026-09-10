import { useMemo } from 'react';
import { useCustomersList } from '@/modules/customers/hooks/useCustomers';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useConversationsList } from '../hooks/useInboxConversations';
import { useGmailConnection } from '../hooks/useGmailConnection';
import { useMutedSenders } from '../hooks/useMutedSenders';
import { NEEDS_ATTENTION_HIGH_PRIORITY, selectNeedsAttention } from '../utils/needsAttention';

const MEDIUM_THRESHOLD = 40;

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

function bandFor(priority: number): PriorityBand | null {
  if (priority >= NEEDS_ATTENTION_HIGH_PRIORITY) return 'high';
  if (priority >= MEDIUM_THRESHOLD) return 'medium';
  return null;
}

/**
 * Panel-local copy of the m/h/d convention in inboxBuckets.ts:190-197, which is
 * module-private there; importing it would mean widening that file's exports.
 */
function formatAge(iso: string | null): string | null {
  const parsed = Date.parse(iso ?? '');
  if (Number.isNaN(parsed)) return null;
  const ms = Date.now() - parsed;
  if (ms < 0) return null;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export interface NeedsAttentionPanelProps {
  /** The page selects the conversation and closes the panel; this only reports the click. */
  onSelect: (conversationId: string) => void;
}

export function NeedsAttentionPanel({ onSelect }: NeedsAttentionPanelProps) {
  // Same hook and filter object the inbox page already uses, so this shares its
  // cache entry and adds no query or endpoint (FR-016 / R-006). Filter-independent
  // by construction: it never sees the page's search/unread filters.
  const { data: conversations = [], isLoading } = useConversationsList({ status: 'open' });
  const { data: customers = [] } = useCustomersList();
  // Exclusion inputs (see selectNeedsAttention): the org's own mailbox, and the
  // muted-sender set the customers view's Hidden filter uses.
  const { organizationId } = useOrganization();
  const { data: gmailConnection } = useGmailConnection();
  const { mutedHandles } = useMutedSenders(organizationId);

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((customer) => {
      const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
      const name = fullName || customer.email || customer.phone;
      if (name) map.set(customer.id, name);
    });
    return map;
  }, [customers]);

  const items = useMemo(
    () =>
      selectNeedsAttention(conversations, {
        orgMailbox: gmailConnection?.email_address ?? null,
        mutedHandles,
      }),
    [conversations, gmailConnection, mutedHandles],
  );

  if (isLoading) {
    return <p className="px-4 py-6 font-body text-sm text-gardens-txs">Loading…</p>;
  }

  if (items.length === 0) {
    return <p className="px-4 py-6 font-body text-sm text-gardens-txs">Nothing scored yet</p>;
  }

  return (
    <div className="flex flex-col">
      <p className="px-4 pt-3 pb-2 font-body text-xs text-gardens-txs">
        Open conversations ranked by AI, most urgent first.
      </p>
      <ul className="flex flex-col">
        {items.map((conversation) => {
          const band = bandFor(conversation.ai_priority);
          const name =
            (conversation.person_id ? customerNameById.get(conversation.person_id) : undefined) ??
            conversation.primary_handle;
          const age = formatAge(conversation.last_message_at);
          return (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                className="w-full text-left px-4 py-3 border-b border-gardens-bdr hover:bg-gardens-page transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 truncate font-body text-sm font-semibold text-gardens-tx">
                    {name}
                  </span>
                  {band && (
                    <span
                      className={`shrink-0 px-1.5 py-px rounded-full text-[10px] font-semibold ${BAND_CLASS[band]}`}
                    >
                      {BAND_LABEL[band]}
                    </span>
                  )}
                  {age && <span className="shrink-0 text-[11px] text-gardens-txm">{age}</span>}
                </div>
                {conversation.ai_reason && (
                  <p className="mt-1 font-body text-xs text-gardens-txs line-clamp-2">
                    {conversation.ai_reason}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
