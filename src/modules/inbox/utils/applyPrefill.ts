import { orderFormSchema } from '@/modules/orders/schemas/order.schema';

/**
 * Apply rules for the AI prefill of the create-order form (spec R-005, FR-017).
 * Pure: decides which extracted fields to apply; the caller does the setValue.
 */

/** The seven prefill fields (R-005) in apply order: `order_type` first. */
export const PREFILL_FIELDS = [
  'order_type',
  'customer_name',
  'location',
  'sku',
  'material',
  'color',
  'inscription_text',
] as const;

export type PrefillField = (typeof PREFILL_FIELDS)[number];

/** One field to apply. `evidence` is the quote the AI mark shows (R-006). */
export interface PrefillEntry {
  name: PrefillField;
  value: string;
  evidence: string;
}

const ORDER_TYPES: readonly string[] = orderFormSchema.shape.order_type.options;

/** The form's Renovation effect clears these, so applying them would only flash a mark. */
const NOT_FOR_RENOVATION: ReadonlySet<PrefillField> = new Set(['material', 'color']);

/** The form's empty defaults differ per field: undefined, null or ''. */
function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/** The response is untyped JSON: accept only `{ value, evidence }` with non-blank strings. */
function readEntry(name: PrefillField, raw: unknown): PrefillEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { value, evidence } = raw as Record<string, unknown>;
  if (typeof value !== 'string' || typeof evidence !== 'string') return null;
  const v = value.trim();
  if (v === '' || evidence.trim() === '') return null;
  if (name === 'order_type' && !ORDER_TYPES.includes(v)) return null;
  return { name, value: v, evidence };
}

/**
 * The entries to apply, `order_type` first: R-005 names only, and only where the
 * current value is empty and the field is not dirty. When the effective `order_type`
 * (the one applied here, else the current value) is 'Renovation', `material` and
 * `color` are omitted.
 */
export function applyPrefill(
  fields: Readonly<Record<string, unknown>> | null | undefined,
  current: Readonly<Partial<Record<PrefillField, unknown>>>,
  isDirty: (name: PrefillField) => boolean,
): PrefillEntry[] {
  if (!fields) return [];
  const out: PrefillEntry[] = [];
  let orderType = current.order_type;
  for (const name of PREFILL_FIELDS) {
    const entry = readEntry(name, fields[name]);
    if (!entry || !isEmpty(current[name]) || isDirty(name)) continue;
    if (orderType === 'Renovation' && NOT_FOR_RENOVATION.has(name)) continue;
    out.push(entry);
    if (name === 'order_type') orderType = entry.value;
  }
  return out;
}
