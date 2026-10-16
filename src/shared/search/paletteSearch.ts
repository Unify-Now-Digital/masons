import { formatOrderNumber } from '@/modules/orders/utils/orderDisplayId';
import { displayPersonName } from '@/shared/lib/personName';

export interface PalettePerson {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface PaletteOrder {
  order_number?: number | null;
  customer_name?: string | null;
  person_name?: string | null;
  sku?: string | null;
  inscription_text?: string | null;
}

/** UK numbers compare without a leading 0 or 44, so 07… and +44… are the same key. */
export function ukPhoneKey(raw?: string | null): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('44')) return digits.slice(2);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/** Cmd-K people match: "First Last", email, or a phone in either 07 or +44 form. */
export function personMatchesQuery(person: PalettePerson, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const joined = [person.first_name, person.last_name].filter(Boolean).join(' ').trim().toLowerCase();
  if (joined.includes(q)) return true;
  const email = (person.email ?? '').trim().toLowerCase();
  if (email && email.includes(q)) return true;
  if (/[a-z]/i.test(q)) return false;
  const qKey = ukPhoneKey(q);
  const pKey = ukPhoneKey(person.phone);
  return qKey.length >= 4 && !!pKey && (pKey.includes(qKey) || qKey.includes(pKey));
}

export function personResultName(person: PalettePerson): string {
  return displayPersonName(person.first_name, person.last_name)
    || (person.email ?? '').trim()
    || (person.phone ?? '').trim()
    || 'Person';
}

/** ORD-000123. Empty when the order has no number. */
export function orderRefLabel(orderNumber?: number | null): string {
  if (orderNumber == null || !Number.isFinite(Number(orderNumber))) return '';
  return formatOrderNumber(Number(orderNumber));
}

export function orderMatchesQuery(order: PaletteOrder, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const ref = orderRefLabel(order.order_number).toLowerCase();
  const fields = [
    ref,
    order.order_number != null ? String(order.order_number) : '',
    order.customer_name,
    order.person_name,
    order.sku,
    order.inscription_text,
  ];
  return fields.some((value) => (value ?? '').toLowerCase().includes(q));
}
