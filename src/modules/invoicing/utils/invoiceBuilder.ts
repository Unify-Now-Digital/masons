import { formatPhoneDisplay, looksLikePhone } from '@/modules/inbox/utils/contactTitle';
import type { OrderFormData } from '@/modules/orders/schemas/order.schema';
import { toMoneyNumber } from '@/modules/orders/utils/numberParsing';
import type { Order, OrderAdditionalOption } from '@/modules/orders/types/orders.types';
import { displayPersonName } from '@/shared/lib/personName';
import { ukPhoneKey } from '@/shared/search/paletteSearch';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function positiveQty(quantity: number | null | undefined): number {
  return quantity != null && Number.isFinite(quantity) && quantity >= 1 ? quantity : 1;
}

/** Unit price times quantity. A blank unit is 0; a blank quantity is 1. */
export function extendedMoney(unit: number | null | undefined, quantity: number | null | undefined): number {
  const n = toMoneyNumber(unit);
  return round2((Number.isFinite(n) ? n : 0) * positiveQty(quantity));
}

/** Order total from the invoice builder form, including product and add-on quantities. */
export function formOrderGross(data: Partial<OrderFormData>): number {
  const qty = positiveQty(data.product_quantity);
  const options = (data.additional_options ?? []).reduce((sum, opt) => {
    if (!opt?.name?.trim()) return sum;
    return sum + extendedMoney(opt.cost, opt.quantity);
  }, 0);
  const base = data.order_type === 'Renovation'
    ? extendedMoney(data.renovation_service_cost, qty)
    : extendedMoney(data.value, qty);
  const permit = toMoneyNumber(data.permit_cost);
  return round2(base + (Number.isFinite(permit) ? permit : 0) + options);
}

/**
 * Balance invoice: outstanding = order total − payments already received.
 * Never negative. Deposit invoices pass 0 so the full total is kept.
 */
export function balanceInvoiceAmount(orderTotal: number, paymentsReceived: number): number {
  const total = Number.isFinite(orderTotal) ? orderTotal : 0;
  const paid = Number.isFinite(paymentsReceived) ? Math.max(0, paymentsReceived) : 0;
  return Math.max(0, round2(total - paid));
}

export function orderToInvoiceForm(
  order: Order,
  options: Pick<OrderAdditionalOption, 'id' | 'name' | 'cost' | 'description'>[],
): Partial<OrderFormData> {
  return {
    customer_name: order.customer_name ?? '',
    order_type: order.order_type === 'Renovation' ? 'Renovation' : 'New Memorial',
    sku: order.sku ?? '',
    location: order.location ?? '',
    material: order.material ?? '',
    color: order.color ?? '',
    value: order.value,
    permit_cost: order.permit_cost,
    custom_product_name: order.custom_product_name || order.quote_product_name || '',
    renovation_service_description: order.renovation_service_description ?? null,
    renovation_service_cost: order.renovation_service_cost ?? null,
    notes: order.notes ?? '',
    inscription_text: order.inscription_text ?? null,
    productPhotoUrl: order.product_photo_url ?? null,
    product_quantity: 1,
    additional_options: options.map((option) => ({
      id: option.id,
      name: option.name,
      cost: option.cost,
      description: option.description,
      quantity: 1,
    })),
  };
}

export interface PersonLike {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface PersonSelectOption {
  id: string;
  label: string;
  /** Name, email and phone, so the combobox can find "Anne" or "07903". */
  search: string;
}

/** A social handle or generated username, not a person's name. */
export function looksLikeUsername(name: string): boolean {
  const t = name.trim();
  if (!t || /\s/.test(t)) return false;
  if (t.startsWith('@')) return true;
  if (t.includes('_')) return true;
  return /\d/.test(t) && /[a-z]/i.test(t);
}

function realName(person: PersonLike): string | null {
  const tokens = [person.first_name, person.last_name].map((part) => (part ?? '').trim()).filter(Boolean);
  if (tokens.length === 0) return null;
  // A username or a bare number is not a name, even when the display helper
  // appends "(no surname)".
  if (tokens.every((token) => looksLikePhone(token) || looksLikeUsername(token))) return null;
  const name = displayPersonName(person.first_name, person.last_name);
  if (!name || looksLikePhone(name) || looksLikeUsername(name)) return null;
  return name;
}

function phoneLabel(person: PersonLike): string | null {
  const phone = (person.phone ?? '').trim();
  if (looksLikePhone(phone)) return formatPhoneDisplay(phone);
  const stored = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
  if (looksLikePhone(stored)) return formatPhoneDisplay(stored);
  return null;
}

function phoneKey(person: PersonLike): string {
  return ukPhoneKey(person.phone) || ukPhoneKey([person.first_name, person.last_name].filter(Boolean).join(' '));
}

/**
 * People for the invoice Person field. Real names are shown as names.
 * A row with no real name is a formatted phone when we have one, otherwise
 * an email. Empty rows are hidden. The same phone is listed once, preferring
 * the record that has a real name.
 */
export function personSelectOptions(people: readonly PersonLike[]): PersonSelectOption[] {
  type Ranked = PersonSelectOption & { rank: number };
  const byPhone = new Map<string, Ranked>();
  const rest: Ranked[] = [];

  for (const person of people) {
    const name = realName(person);
    const phone = phoneLabel(person);
    const email = (person.email ?? '').trim();
    const label = name || phone || email;
    if (!label) continue;
    const rank = name ? 2 : phone ? 1 : 0;
    const search = [label, name, email, person.phone, person.first_name, person.last_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const row: Ranked = { id: person.id, label, search, rank };
    const key = phoneKey(person);
    if (!key) {
      rest.push(row);
      continue;
    }
    const prev = byPhone.get(key);
    if (!prev || row.rank > prev.rank) {
      byPhone.set(key, row);
    } else if (row.rank === prev.rank && row.rank >= 2 && row.label !== prev.label) {
      rest.push(row);
    }
  }

  return [...byPhone.values(), ...rest]
    .map(({ id, label, search }) => ({ id, label, search }))
    .sort((a, b) => {
      const aPhone = looksLikePhone(a.label) || a.label.startsWith('+');
      const bPhone = looksLikePhone(b.label) || b.label.startsWith('+');
      if (aPhone !== bPhone) return aPhone ? 1 : -1;
      return a.label.localeCompare(b.label, 'en');
    });
}
