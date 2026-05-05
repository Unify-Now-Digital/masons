import type { Json } from '@/shared/types/database.types';
import type { InquiryPipelineRow } from '../types/inquiries';

export function truncate(text: string | null | undefined, max: number): string {
  const s = (text ?? '').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

export function personDisplayName(row: InquiryPipelineRow): string {
  const parts = [row.person_first_name?.trim(), row.person_last_name?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return 'Unknown person';
}

export function formatGbp(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function detailsRecord(details: Json | null | undefined): Record<string, unknown> {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};
  return details as Record<string, unknown>;
}

export function detailsString(details: Json | null | undefined, key: string): string | null {
  const rec = detailsRecord(details);
  const v = rec[key];
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

export function detailsNumber(details: Json | null | undefined, key: string): number | null {
  const rec = detailsRecord(details);
  const v = rec[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function shortlistSummary(details: Json | null | undefined): string {
  const rec = detailsRecord(details);
  const keys = Object.keys(rec).slice(0, 8);
  if (keys.length === 0) return '—';
  const parts = keys.map((k) => {
    const v = rec[k];
    const text =
      v === null || v === undefined
        ? ''
        : typeof v === 'object'
          ? JSON.stringify(v)
          : String(v);
    return `${k}: ${truncate(text, 40)}`;
  });
  return truncate(parts.join(' · '), 160);
}
