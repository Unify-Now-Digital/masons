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
