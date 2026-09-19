/**
 * Server-side guards for inbox-ai-extract-order: whitelist, caps, evidence
 * check and the name guards (spec R-006, FR-013, FR-014, FR-014a; caps per D-10).
 * Pure, no imports and no Deno globals — a src/ vitest file imports this module,
 * so both `deno check` and app tsc type-check it (D-9).
 *
 * Model output is untrusted. Every guard fails safe: a field that cannot be shown
 * to come from the transcript is returned as null, never repaired.
 */

/** The seven prefill fields (R-005), in spec order. Any other key is ignored. */
export const FIELD_NAMES = [
  'customer_name',
  'location',
  'sku',
  'order_type',
  'material',
  'color',
  'inscription_text',
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];

export interface ExtractedField {
  value: string;
  evidence: string;
}

export type ExtractedFields = Record<FieldName, ExtractedField | null>;

/** `orders.order_type` literals (order.schema.ts:40). Anything else nulls the field. */
export const ORDER_TYPES = ['New Memorial', 'Renovation'] as const;

/** D-10: a value over its cap nulls the field. A value is never truncated. */
export const VALUE_CAPS: Record<FieldName, number> = {
  customer_name: 80,
  location: 120,
  sku: 40,
  order_type: 12,
  material: 60,
  color: 40,
  inscription_text: 600,
};

/** D-10: evidence is checked in full, then the returned copy is cut to its cap. */
export const EVIDENCE_CAPS: Record<FieldName, number> = {
  customer_name: 200,
  location: 200,
  sku: 200,
  order_type: 200,
  material: 200,
  color: 200,
  inscription_text: 600,
};

/** Lowercase, whitespace runs collapsed to one space, trimmed. */
export function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * [OPT] True when the evidence sits on a line beginning `From:`. In a web-enquiry
 * message that line names the customer (create_inbox_from_enquiry), not the
 * deceased. Reads the un-normalised transcript, because `normalise` collapses
 * newlines. Hit = the line contains the evidence, or the evidence contains the
 * line's name.
 */
function evidenceOnFromLine(evidence: string, transcript: string): boolean {
  const ev = normalise(evidence);
  for (const line of transcript.split('\n')) {
    if (!/^\s*from:/i.test(line)) continue;
    const name = normalise(line.replace(/^\s*from:/i, ''));
    if (normalise(line).includes(ev) || (name !== '' && ev.includes(name))) return true;
  }
  return false;
}

function checkField(
  name: FieldName,
  entry: unknown,
  normalisedTranscript: string,
  transcript: string,
): ExtractedField | null {
  if (!isRecord(entry)) return null;
  const { value: rawValue, evidence: rawEvidence } = entry;
  if (typeof rawValue !== 'string' || typeof rawEvidence !== 'string') return null;
  const value = rawValue.trim();
  const evidence = rawEvidence.trim();
  if (value === '' || value.length > VALUE_CAPS[name]) return null;
  if (name === 'order_type' && !(ORDER_TYPES as readonly string[]).includes(value)) return null;

  const ev = normalise(evidence);
  if (ev === '' || !normalisedTranscript.includes(ev)) return null;
  // [OPT] The quote must contain the value itself, not merely exist.
  if ((name === 'sku' || name === 'customer_name') && !ev.includes(normalise(value))) return null;
  if (name === 'customer_name' && evidenceOnFromLine(evidence, transcript)) return null;

  const cap = EVIDENCE_CAPS[name];
  return { value, evidence: evidence.length > cap ? evidence.slice(0, cap) : evidence };
}

/**
 * FR-014 / R-006. Whitelists the seven names and nulls any field whose value or
 * evidence is not a string, whose value is empty or over its cap, whose
 * `order_type` is not a known literal, or whose normalised evidence is empty or
 * not a substring of the normalised transcript; then the two [OPT] guards.
 * Always returns all seven keys.
 */
export function filterByEvidence(raw: unknown, transcript: string): ExtractedFields {
  const source: Record<string, unknown> = isRecord(raw) ? raw : {};
  const normalisedTranscript = normalise(transcript);
  const out = {} as ExtractedFields;
  for (const name of FIELD_NAMES) {
    out[name] = checkField(name, source[name], normalisedTranscript, transcript);
  }
  return out;
}

/**
 * FR-014a. Runs after filterByEvidence: nulls `customer_name` when its normalised
 * value equals the normalised full name of any person linked to the conversations
 * read. The customer is never the deceased by default. Other fields untouched.
 */
export function dropLinkedPersonName(fields: ExtractedFields, names: string[]): ExtractedFields {
  const current = fields.customer_name;
  if (!current) return fields;
  const value = normalise(current.value);
  return names.some((n) => normalise(n) === value) ? { ...fields, customer_name: null } : fields;
}
