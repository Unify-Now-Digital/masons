import { displayPersonName, tidyStoredName } from '@/shared/lib/personName';
import { normalizeHandle } from './conversationGroupKey';

export interface PhonePerson {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
}

export interface PhoneOrder {
  person_name?: string | null;
  customer_phone?: string | null;
}

export function looksLikePhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('@')) return false;
  // A contact number, not a sentence or a name that happens to contain digits.
  if (/[a-z]/i.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/** UK display: +44 7903 145910. Non-phones are returned unchanged. */
export function formatPhoneDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!looksLikePhone(trimmed)) return trimmed;
  let national = trimmed.replace(/\D/g, '');
  if (national.startsWith('44') && national.length > 10) national = national.slice(2);
  else if (national.startsWith('0')) national = national.slice(1);
  if (national.length === 10) return `+44 ${national.slice(0, 4)} ${national.slice(4)}`;
  if (national.length === 9) return `+44 ${national.slice(0, 3)} ${national.slice(3)}`;
  const intl = trimmed.replace(/\D/g, '');
  return intl ? `+${intl}` : trimmed;
}

/** Last-10-digit key → living contact name. People win over an order's person name. */
export function contactNamesByPhone(people: readonly PhonePerson[], orders: readonly PhoneOrder[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const order of orders) {
    const key = normalizeHandle(order.customer_phone ?? '');
    if (!key || key.includes('@')) continue;
    const name = tidyStoredName(order.person_name);
    if (name) map.set(key, looksLikePhone(name) ? formatPhoneDisplay(name) : name);
  }
  for (const person of people) {
    const key = normalizeHandle(person.phone ?? '');
    if (!key || key.includes('@')) continue;
    const name = displayPersonName(person.first_name, person.last_name) ?? '';
    if (name) map.set(key, looksLikePhone(name) ? formatPhoneDisplay(name) : name);
  }
  return map;
}

export function resolveContactTitle(raw: string, directory: ReadonlyMap<string, string>): string {
  const trimmed = raw.trim();
  if (!looksLikePhone(trimmed)) return trimmed;
  const key = normalizeHandle(trimmed);
  const named = key ? directory.get(key) : undefined;
  if (named && !looksLikePhone(named)) return named;
  return formatPhoneDisplay(named && looksLikePhone(named) ? named : trimmed);
}
