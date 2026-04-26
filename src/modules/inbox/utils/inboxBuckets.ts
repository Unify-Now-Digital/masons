import type { InboxConversation } from '@/modules/inbox/types/inbox.types';

/**
 * Workflow bucket a conversation belongs to.
 * - `enquiry`: incoming lead, no order yet (or unlinked).
 * - `order`: linked customer who already has at least one order in flight.
 * - `cemetery`: cemetery / council / authority correspondence (paperwork side).
 */
export type InboxBucket = 'enquiry' | 'order' | 'cemetery';

export const BUCKET_LABEL: Record<InboxBucket, string> = {
  enquiry: 'New enquiry',
  order: 'Existing order',
  cemetery: 'Cemetery',
};

/** Hours after which a thread is considered stuck (ball-in-court > SLA). */
export const BUCKET_SLA_HOURS: Record<InboxBucket, number> = {
  enquiry: 24,
  order: 120, // 5 days
  cemetery: 336, // 14 days
};

const CEMETERY_HANDLE_HINTS = [
  'cemetery',
  'cemeteries',
  'graveyard',
  'burial',
  'council',
  'crematorium',
  'parks',
];

/** Quick string-match heuristic against the conversation's primary handle. */
function looksLikeAuthorityHandle(handle: string): boolean {
  const h = handle.toLowerCase();
  return CEMETERY_HANDLE_HINTS.some((hint) => h.includes(hint));
}

/**
 * Classify a conversation into one of the three workflow buckets.
 * `personHasOrders` is provided by the caller (already-fetched orders-by-person map);
 * we don't refetch here so the list view stays render-cheap.
 */
export function classifyConversation(
  conversation: Pick<InboxConversation, 'primary_handle' | 'person_id' | 'subject' | 'last_message_preview'>,
  personHasOrders: boolean
): InboxBucket {
  if (looksLikeAuthorityHandle(conversation.primary_handle ?? '')) return 'cemetery';
  const subject = (conversation.subject ?? '') + ' ' + (conversation.last_message_preview ?? '');
  if (CEMETERY_HANDLE_HINTS.some((hint) => subject.toLowerCase().includes(hint))) {
    // e.g. customer forwarding a permit reply: still cemetery-flavoured.
    return 'cemetery';
  }
  if (conversation.person_id && personHasOrders) return 'order';
  return 'enquiry';
}

export type AgingLevel = 'fresh' | 'amber' | 'red';

export interface AgingInfo {
  ageMs: number;
  level: AgingLevel;
  /** True when ageMs >= bucket SLA (the "stuck" threshold). */
  isStuck: boolean;
  /** Short label like "3d" / "18h" / "42m". */
  shortLabel: string;
}

/**
 * Aging is derived from `last_message_at`. Without a direction-aware timestamp
 * this can't perfectly distinguish "we owe them" from "they owe us"; treat it
 * as a proxy for thread staleness and refine when we add `last_inbound_at`.
 */
export function computeAging(
  lastMessageAt: string | null,
  bucket: InboxBucket,
  now: number = Date.now()
): AgingInfo | null {
  if (!lastMessageAt) return null;
  const last = Date.parse(lastMessageAt);
  if (Number.isNaN(last)) return null;
  const ageMs = Math.max(0, now - last);
  const slaMs = BUCKET_SLA_HOURS[bucket] * 3600 * 1000;
  let level: AgingLevel = 'fresh';
  if (ageMs >= slaMs) level = 'red';
  else if (ageMs >= slaMs * 0.5) level = 'amber';
  return {
    ageMs,
    level,
    isStuck: level === 'red',
    shortLabel: formatShortAge(ageMs),
  };
}

function formatShortAge(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export interface AgingBadgeStyle {
  /** Tailwind classes for badge container. */
  container: string;
  /** Tailwind classes for the bucket-label tail (muted variant of same hue). */
  tail: string;
}

export const AGING_LEVEL_STYLES: Record<AgingLevel, AgingBadgeStyle> = {
  fresh: {
    container: 'bg-gardens-grn-lt text-gardens-grn-dk border-gardens-grn-lt',
    tail: 'text-gardens-grn-dk/70',
  },
  amber: {
    container: 'bg-gardens-amb-lt text-gardens-amb-dk border-gardens-amb-lt',
    tail: 'text-gardens-amb-dk/70',
  },
  red: {
    container: 'bg-gardens-red-lt text-gardens-red-dk border-gardens-red-lt',
    tail: 'text-gardens-red-dk/70',
  },
};

/** One-click chase templates per bucket. The first entry is the default. */
export interface ChaseTemplate {
  id: string;
  label: string;
  body: (ctx: { participantName: string | null }) => string;
}

const firstName = (name: string | null): string => {
  if (!name) return 'there';
  const trimmed = name.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
};

export const BUCKET_CHASE_TEMPLATES: Record<InboxBucket, ChaseTemplate[]> = {
  enquiry: [
    {
      id: 'enquiry-followup',
      label: 'Quote follow-up',
      body: ({ participantName }) =>
        `Hi ${firstName(participantName)},\n\nJust checking in on the quote we sent through — happy to answer any questions or tweak anything if it would help.\n\nKind regards,`,
    },
    {
      id: 'enquiry-info-needed',
      label: 'Ask for details',
      body: ({ participantName }) =>
        `Hi ${firstName(participantName)},\n\nThanks for getting in touch. To put a quote together, could you let me know the cemetery, the inscription wording, and your preferred stone if you have one in mind?\n\nKind regards,`,
    },
  ],
  order: [
    {
      id: 'order-status-update',
      label: 'Status update',
      body: ({ participantName }) =>
        `Hi ${firstName(participantName)},\n\nQuick update on your order — wanted to keep you in the loop on where things are at. Happy to jump on a call if easier.\n\nKind regards,`,
    },
    {
      id: 'order-deposit-reminder',
      label: 'Deposit reminder',
      body: ({ participantName }) =>
        `Hi ${firstName(participantName)},\n\nJust a gentle reminder that the deposit is needed before we can move the order forward. Let me know if you'd like the bank details resent.\n\nKind regards,`,
    },
    {
      id: 'order-proof-chase',
      label: 'Proof approval chase',
      body: ({ participantName }) =>
        `Hi ${firstName(participantName)},\n\nChasing up the inscription proof we sent over — once you're happy with it we can get the lettering booked in.\n\nKind regards,`,
    },
  ],
  cemetery: [
    {
      id: 'cemetery-permit-chase',
      label: 'Permit status chase',
      body: ({ participantName }) =>
        `Hello,\n\nCould I please get an update on the permit application we submitted? Happy to resend any paperwork if it would help speed things along.\n\nMany thanks,`,
    },
    {
      id: 'cemetery-resubmit',
      label: 'Resubmit / clarification',
      body: () =>
        `Hello,\n\nFollowing your note, please find the requested information attached. Let me know if anything else is needed to progress the application.\n\nMany thanks,`,
    },
  ],
};

export function getDefaultChaseTemplate(bucket: InboxBucket): ChaseTemplate {
  return BUCKET_CHASE_TEMPLATES[bucket][0];
}
