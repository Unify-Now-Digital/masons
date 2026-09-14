/**
 * Helpers for order deceased names (order_deceased + legacy orders.customer_name).
 *
 * Equal-name rule: trim+casefold(customer_name) === person_name ⇒ deceased MISSING (never invent).
 * Prefer order_deceased rows when present; otherwise fall back to legacy customer_name only when distinct.
 */

export type OrderDeceasedInput = {
  full_name: string;
  is_primary: boolean;
  sort_order?: number;
  date_of_birth?: string | null;
  date_of_death?: string | null;
};

export type OrderDeceasedLike = {
  full_name: string;
  is_primary?: boolean;
  sort_order?: number | null;
};

export function normalizeNameKey(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

/** True when legacy customer_name should be treated as deceased missing (empty or equal to living person). */
export function isLegacyDeceasedMissing(
  customerName: string | null | undefined,
  personName: string | null | undefined,
): boolean {
  const customer = (customerName ?? '').trim();
  if (!customer) return true;
  const person = (personName ?? '').trim();
  if (!person) return false;
  return normalizeNameKey(customer) === normalizeNameKey(person);
}

/** Warn UI: deceased input would equal the living person name (nonempty). */
export function wouldDeceasedEqualLiving(
  deceasedName: string | null | undefined,
  livingName: string | null | undefined,
): boolean {
  const deceased = (deceasedName ?? '').trim();
  const living = (livingName ?? '').trim();
  if (!deceased || !living) return false;
  return normalizeNameKey(deceased) === normalizeNameKey(living);
}

/**
 * Resolve deceased display names for an order.
 * Prefer order_deceased rows; else legacy customer_name when not equal-name/empty.
 */
export function getDeceasedNames(input: {
  order_deceased?: OrderDeceasedLike[] | null;
  customer_name?: string | null;
  person_name?: string | null;
}): string[] {
  const rows = input.order_deceased;
  if (rows && rows.length > 0) {
    const sorted = [...rows].sort((a, b) => {
      const ap = a.is_primary ? 1 : 0;
      const bp = b.is_primary ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    return sorted.map((r) => r.full_name.trim()).filter(Boolean);
  }
  if (isLegacyDeceasedMissing(input.customer_name, input.person_name)) return [];
  const legacy = (input.customer_name ?? '').trim();
  return legacy ? [legacy] : [];
}

/** Single-line display label, or null when deceased is missing. */
export function getDeceasedDisplayName(input: {
  order_deceased?: OrderDeceasedLike[] | null;
  customer_name?: string | null;
  person_name?: string | null;
}): string | null {
  const names = getDeceasedNames(input);
  if (names.length === 0) return null;
  return names.join(' & ');
}

/** Dual-write value for orders.customer_name — never null; '' when no primary deceased. */
export function customerNameFromDeceased(deceased: OrderDeceasedInput[]): string {
  if (deceased.length === 0) return '';
  const primary = deceased.find((d) => d.is_primary) ?? deceased[0];
  return primary.full_name.trim();
}

/**
 * Build upsert payload from a single UI deceased name + living person snapshot.
 * Equal-name / empty ⇒ [] (missing).
 */
export function deceasedInputFromLegacyName(
  customerName: string | null | undefined,
  personName: string | null | undefined,
): OrderDeceasedInput[] {
  if (isLegacyDeceasedMissing(customerName, personName)) return [];
  const fullName = (customerName ?? '').trim();
  if (!fullName) return [];
  return [{ full_name: fullName, is_primary: true, sort_order: 0 }];
}

/** Value to send on order insert for NOT NULL customer_name before/alongside upsertOrderDeceased. */
export function customerNameForOrderWrite(
  customerName: string | null | undefined,
  personName: string | null | undefined,
): string {
  return customerNameFromDeceased(deceasedInputFromLegacyName(customerName, personName));
}
