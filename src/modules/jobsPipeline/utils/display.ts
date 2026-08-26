import { detailsNumber } from '@/modules/inquiries/utils/display';
import type { JobSource, PipelineJob } from '../types/jobsPipeline.types';

export const normalizeEmail = (value?: string | null) => (value ?? '').trim().toLowerCase();

// Mirrors autoLinkConversation's phone matching: compare on the last 10 digits.
export const phoneLast10 = (value?: string | null) => (value ?? '').replace(/\D/g, '').slice(-10);

/** Display name chain: person first/last → email → phone → conversation handle → em dash. */
export function getJobDisplayName(job: PipelineJob): string {
  const person = job.person;
  const personName = person
    ? [person.first_name, person.last_name].filter(Boolean).join(' ').trim() ||
      person.email ||
      person.phone ||
      null
    : null;
  return personName ?? job.conversation?.primary_handle ?? '—';
}

/**
 * Conversation channel → jobs.source. 'web'-channel conversations are the
 * trigger-created website enquiries; anything unrecognized records as a manual add.
 */
export function mapChannelToSource(channel: string): JobSource {
  switch (channel) {
    case 'email':
      return 'email';
    case 'whatsapp':
      return 'whatsapp';
    case 'ghl':
      return 'ghl';
    case 'web':
      return 'website';
    case 'sms':
      return 'sms';
    default:
      return 'manual';
  }
}

/**
 * Same semantics as fetchDueDormantCount's SQL (`wake_at <= now()`): dormant
 * and the wake instant has passed. Single source of truth for "due to wake" —
 * badge count and list treatment must never disagree.
 */
export function isDueToWake(job: Pick<PipelineJob, 'exit_reason' | 'wake_at'>): boolean {
  return (
    job.exit_reason === 'dormant' && !!job.wake_at && new Date(job.wake_at).getTime() <= Date.now()
  );
}

/** Human label for a job stage, e.g. 'in_production' → 'In production'. */
export function formatStageLabel(stage: string): string {
  const words = stage.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Short date for cards/lists, e.g. "2 Aug 2026". */
export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Enquiry-quoted price in GBP pounds: details.price + details.permit_fee.
 * details.price ALREADY includes add-ons (verified 47/47 live SM rows,
 * 26 Aug 2026) — never add addonLineItems, it double-counts.
 * Null unless the enquiry is 'quote'-channel with a numeric price.
 * permit_fee is best-effort by design: missing OR present-but-non-numeric
 * degrades to 0 and the price still renders — deliberate, not an oversight.
 */
export function getJobEnquiryPrice(job: Pick<PipelineJob, 'enquiry'>): number | null {
  const enquiry = job.enquiry;
  if (!enquiry || enquiry.channel !== 'quote') return null;
  const price = detailsNumber(enquiry, 'price');
  if (price === null) return null;
  return price + (detailsNumber(enquiry, 'permit_fee') ?? 0);
}

const DAY_MS = 86_400_000;

/**
 * Compact age token for cards: 'today' | '3d' | '6w' | '4mo' | '1y 3mo'.
 * Bands: <7 days → days; <70 days → weeks; <12 months → calendar months;
 * else years, plus remaining months when non-zero. '—' for missing/invalid.
 */
export function formatAge(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return '—';
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return '—';
  const days = Math.floor((now.getTime() - then.getTime()) / DAY_MS);
  if (days < 1) return 'today';
  if (days < 7) return `${days}d`;
  if (days < 70) return `${Math.floor(days / 7)}w`;
  const months =
    (now.getFullYear() - then.getFullYear()) * 12 +
    (now.getMonth() - then.getMonth()) -
    (now.getDate() < then.getDate() ? 1 : 0);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years}y ${rest}mo` : `${years}y`;
}

export type ClassifiedHandle =
  | { kind: 'email'; value: string }
  | { kind: 'phone'; last10: string; value: string }
  | { kind: 'unknown' };

/** Classify a conversation handle for person dedupe/creation. */
export function classifyHandle(handle: string): ClassifiedHandle {
  const trimmed = handle.trim();
  if (trimmed.includes('@')) {
    return { kind: 'email', value: normalizeEmail(trimmed) };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 7) {
    return { kind: 'phone', last10: digits.slice(-10), value: trimmed };
  }
  return { kind: 'unknown' };
}
