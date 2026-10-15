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
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/** UK-friendly display. Non-phones are returned unchanged. */
export function formatPhoneDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!looksLikePhone(trimmed)) return trimmed;
  let national = trimmed.replace(/\D/g, '');
  if (national.startsWith('44') && national.length >= 12) national = `0${national.slice(2)}`;
  else if (!national.startsWith('0') && national.length === 10) national = `0${national}`;
  if (national.startsWith('07') && national.length === 11) {
    return `${national.slice(0, 5)} ${national.slice(5)}`;
  }
  if (national.startsWith('0') && national.length === 11) {
    return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
  }
  if (national.startsWith('0') && national.length === 10) {
    return `${national.slice(0, 4)} ${national.slice(4)}`;
  }
  return trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/\D/g, '')}`;
}

/** Last-10-digit key → living contact name. People win over an order's person name. */
export function contactNamesByPhone(people: readonly PhonePerson[], orders: readonly PhoneOrder[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const order of orders) {
    const key = normalizeHandle(order.customer_phone ?? '');
    if (!key || key.includes('@')) continue;
    const name = (order.person_name ?? '').trim();
    if (name) map.set(key, name);
  }
  for (const person of people) {
    const key = normalizeHandle(person.phone ?? '');
    if (!key || key.includes('@')) continue;
    const name = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
    if (name) map.set(key, name);
  }
  return map;
}

export function resolveContactTitle(raw: string, directory: ReadonlyMap<string, string>): string {
  const trimmed = raw.trim();
  if (!looksLikePhone(trimmed)) return trimmed;
  const key = normalizeHandle(trimmed);
  return (key && directory.get(key)) || formatPhoneDisplay(trimmed);
}
