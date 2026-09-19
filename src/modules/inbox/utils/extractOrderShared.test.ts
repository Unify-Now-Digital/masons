import { describe, expect, it } from 'vitest';
import {
  buildTaggedTranscript,
  type MsgRow,
} from '../../../../supabase/functions/_shared/conversationTranscript';
import {
  EVIDENCE_CAPS,
  FIELD_NAMES,
  VALUE_CAPS,
  dropLinkedPersonName,
  filterByEvidence,
  type ExtractedFields,
  type FieldName,
} from '../../../../supabase/functions/_shared/evidenceFilter';

// Pure helpers of the inbox-ai-extract-order edge function. Both modules are import-free
// (D-9), so this src/ test can load them. Fixtures use example.com and invented names only.

const msg = (id: string, over: Partial<MsgRow>): MsgRow => ({
  id,
  conversation_id: 'c1',
  sent_at: null,
  created_at: '2026-01-01T00:00:00Z',
  channel: 'sms',
  direction: 'inbound',
  body_text: null,
  from_handle: 'a@example.com',
  to_handle: 'shop@example.com',
  ...over,
});

/** n sms messages with texts m0..m(n-1), oldest first. */
const thread = (n: number): MsgRow[] =>
  Array.from({ length: n }, (_, i) =>
    msg(`t${i}`, { sent_at: `2026-02-01T09:00:${String(i).padStart(2, '0')}Z`, body_text: `m${i}` }),
  );

/** Each line's message text, in order; the gap line stays '[…]'. */
const texts = (s: string) =>
  s.split('\n').map((l) => (l === '[…]' ? l : l.slice(l.lastIndexOf(': ') + 2)));

describe('buildTaggedTranscript, keepHead 0 (AC-008 guard)', () => {
  // GOLDEN_A and GOLDEN_B were produced by the pre-keepHead implementation (before T034) on
  // these exact fixtures. If either fails, inbox-ai-rank's prompts have changed.
  const FIXTURE: MsgRow[] = [
    msg('1', { sent_at: '2026-01-01T09:00:00Z', body_text: 'first' }),
    msg('2', { sent_at: '2026-01-02T09:00:00Z', channel: 'whatsapp', body_text: '  Grave B/12  ' }),
    msg('3', {
      sent_at: '2026-01-03T09:00:00Z',
      channel: 'email',
      body_text: '<p>Hello <b>there</b></p><style>p{}</style>',
    }),
    msg('4', { created_at: '2026-01-04T09:00:01Z', channel: 'email', direction: 'outbound' }),
    msg('5', { sent_at: '2026-01-05T09:00:00Z', channel: 'web', body_text: 'Quote request\nFrom: Jane Doe' }),
  ];
  const GOLDEN_A = [
    '[email] [inbound] 2026-01-03T09:00:00Z from=a@example.com to=shop@example.com: Hello there',
    '[email] [outbound] 2026-01-04T09:00:01Z from=a@example.com to=shop@example.com: (No message body)',
    '[web] [inbound] 2026-01-05T09:00:00Z from=a@example.com to=shop@example.com: Quote request',
    'From: Jane Doe',
  ].join('\n');
  const GOLDEN_B = '[sms] [inbound] 2026-01-09T09:00:00Z fro';

  it('window drops the oldest, trim drops the next, line format unchanged', () => {
    expect(buildTaggedTranscript(FIXTURE, { maxMessages: 4, charCap: 304 })).toBe(GOLDEN_A);
  });

  it('explicit keepHead 0 takes the same path', () => {
    expect(buildTaggedTranscript(FIXTURE, { maxMessages: 4, charCap: 304, keepHead: 0 })).toBe(GOLDEN_A);
  });

  it('a lone line over charCap is cut, not dropped', () => {
    const long = [msg('9', { sent_at: '2026-01-09T09:00:00Z', body_text: 'x'.repeat(60) })];
    expect(buildTaggedTranscript(long, { maxMessages: 4, charCap: 40 })).toBe(GOLDEN_B);
  });
});

describe('buildTaggedTranscript, keepHead > 0', () => {
  it('keeps every message once, with no gap line, when the thread fits', () => {
    const out = buildTaggedTranscript(thread(4), { maxMessages: 5, charCap: 10_000, keepHead: 2 });
    expect(texts(out)).toEqual(['m0', 'm1', 'm2', 'm3']);
  });

  it('keeps the head, a gap line, then the newest maxMessages - keepHead', () => {
    const out = buildTaggedTranscript(thread(8), { maxMessages: 5, charCap: 10_000, keepHead: 2 });
    expect(texts(out)).toEqual(['m0', 'm1', '[…]', 'm5', 'm6', 'm7']);
  });

  it('trim drops the oldest of the newest block, never the head, and adds the gap line', () => {
    const lineLength = buildTaggedTranscript(thread(1), { maxMessages: 1, charCap: Infinity }).length;
    const charCap = 4 * lineLength + '[…]'.length + 4; // head 2 + gap + newest 2, newline-joined
    const out = buildTaggedTranscript(thread(5), { maxMessages: 10, charCap, keepHead: 2 });
    expect(texts(out)).toEqual(['m0', 'm1', '[…]', 'm3', 'm4']);
  });

  it('D-6: keepHead >= maxMessages takes the first maxMessages and no tail', () => {
    const over = buildTaggedTranscript(thread(5), { maxMessages: 3, charCap: 10_000, keepHead: 3 });
    expect(texts(over)).toEqual(['m0', 'm1', 'm2', '[…]']);
    const fits = buildTaggedTranscript(thread(3), { maxMessages: 3, charCap: 10_000, keepHead: 5 });
    expect(texts(fits)).toEqual(['m0', 'm1', 'm2']);
  });

  it('D-7: a head alone over charCap is cut at charCap', () => {
    const head = msg('h', { sent_at: '2026-01-31T09:00:00Z', body_text: 'x'.repeat(500) });
    const out = buildTaggedTranscript([head, ...thread(3)], { maxMessages: 10, charCap: 200, keepHead: 1 });
    expect(out).toHaveLength(200);
    expect(out).toBe(buildTaggedTranscript([head], { maxMessages: 1, charCap: 200 }));
  });

  it('returns an empty string for an empty thread', () => {
    expect(buildTaggedTranscript([], { maxMessages: 5, charCap: 10_000, keepHead: 2 })).toBe('');
  });
});

const TRANSCRIPT = [
  '[web] [inbound] 2026-01-05T09:00:00Z from=a@example.com to=inbox: Quote request',
  'From: Jane Doe',
  'Email: a@example.com',
  'Location: St Example Churchyard, Exampleton',
  '',
  'Headstone for my father Arthur   Doe, grave B/123, black granite.',
  '[email] [outbound] 2026-01-06T09:00:00Z from=shop@example.com to=a@example.com: New Memorial noted.',
].join('\n');

/** One field through the filter against TRANSCRIPT. */
const pick = (name: FieldName, entry: unknown) => filterByEvidence({ [name]: entry }, TRANSCRIPT)[name];

describe('filterByEvidence', () => {
  it('caps are D-10 as ruled', () => {
    expect(VALUE_CAPS).toEqual({
      customer_name: 80,
      location: 120,
      sku: 40,
      order_type: 12,
      material: 60,
      color: 40,
      inscription_text: 600,
    });
    expect(EVIDENCE_CAPS).toEqual({
      customer_name: 200,
      location: 200,
      sku: 200,
      order_type: 200,
      material: 200,
      color: 200,
      inscription_text: 600,
    });
  });

  it('keeps a field whose quote is verbatim', () => {
    expect(pick('material', { value: 'black granite', evidence: 'black granite' })).toEqual({
      value: 'black granite',
      evidence: 'black granite',
    });
  });

  it('accepts case and whitespace variants of the quote', () => {
    const entry = { value: 'St Example Churchyard', evidence: 'LOCATION:  st example   churchyard' };
    expect(pick('location', entry)).not.toBeNull();
  });

  it('drops a fabricated quote', () => {
    expect(pick('material', { value: 'marble', evidence: 'white marble please' })).toBeNull();
  });

  it('drops an empty or whitespace-only quote', () => {
    expect(pick('location', { value: 'St Example', evidence: '' })).toBeNull();
    expect(pick('location', { value: 'St Example', evidence: '   ' })).toBeNull();
  });

  it('drops an order_type outside the two literals', () => {
    expect(pick('order_type', { value: 'new memorial', evidence: 'New Memorial noted' })).toBeNull();
    expect(pick('order_type', { value: 'New Memorial', evidence: 'New Memorial noted' })).not.toBeNull();
  });

  it('returns exactly the seven keys; extra keys and non-object input are ignored', () => {
    const out = filterByEvidence({ price: { value: '1', evidence: 'Quote request' } }, TRANSCRIPT);
    expect(Object.keys(out)).toEqual([...FIELD_NAMES]);
    expect(Object.values(out).every((v) => v === null)).toBe(true);
    expect(Object.values(filterByEvidence('not an object', TRANSCRIPT)).every((v) => v === null)).toBe(true);
    expect(Object.values(filterByEvidence(null, TRANSCRIPT)).every((v) => v === null)).toBe(true);
  });

  it('nulls a non-string value or evidence', () => {
    expect(pick('sku', { value: 123, evidence: 'grave B/123' })).toBeNull();
    expect(pick('sku', { value: 'B/123', evidence: 5 })).toBeNull();
    expect(pick('sku', 'B/123')).toBeNull();
  });

  it('nulls a value over its cap and never truncates it', () => {
    const over = 'x'.repeat(VALUE_CAPS.color + 1);
    expect(pick('color', { value: over, evidence: 'black granite' })).toBeNull();
    const atCap = 'x'.repeat(VALUE_CAPS.color);
    expect(pick('color', { value: atCap, evidence: 'black granite' })?.value).toBe(atCap);
  });

  it('checks evidence in full, then truncates the returned copy to its cap', () => {
    const quote = `Location: ${'a'.repeat(300)}`;
    const kept = filterByEvidence({ location: { value: 'St Example', evidence: quote } }, quote).location;
    expect(kept?.evidence).toBe(quote.slice(0, EVIDENCE_CAPS.location));
    const padded = { location: { value: 'St Example', evidence: `${quote} extra` } };
    expect(filterByEvidence(padded, quote).location).toBeNull();

    const inscription = 'In loving memory '.repeat(40); // 680 chars
    const entry = { value: inscription.slice(0, 600), evidence: inscription };
    const insc = filterByEvidence({ inscription_text: entry }, inscription).inscription_text;
    expect(insc?.evidence).toHaveLength(EVIDENCE_CAPS.inscription_text);
  });

  it('[OPT] sku and customer_name must sit inside their own quote', () => {
    expect(pick('sku', { value: 'B/999', evidence: 'grave B/123' })).toBeNull();
    expect(pick('sku', { value: 'B/123', evidence: 'grave B/123' })).not.toBeNull();
    expect(pick('customer_name', { value: 'Arthur Doe', evidence: 'Headstone for my father' })).toBeNull();
  });

  it('[OPT] drops customer_name quoted from a From: line', () => {
    expect(pick('customer_name', { value: 'Jane Doe', evidence: 'From: Jane Doe' })).toBeNull();
    expect(pick('customer_name', { value: 'Jane Doe', evidence: 'Jane Doe' })).toBeNull();
  });

  it('keeps a deceased name quoted from the message body', () => {
    expect(pick('customer_name', { value: 'Arthur Doe', evidence: 'my father Arthur Doe' })).toEqual({
      value: 'Arthur Doe',
      evidence: 'my father Arthur Doe',
    });
  });
});

describe('dropLinkedPersonName', () => {
  const kept: ExtractedFields = filterByEvidence(
    {
      customer_name: { value: 'Arthur Doe', evidence: 'my father Arthur Doe' },
      sku: { value: 'B/123', evidence: 'grave B/123' },
      material: { value: 'black granite', evidence: 'black granite' },
    },
    TRANSCRIPT,
  );

  it('drops customer_name on an exact or case/whitespace-variant linked name', () => {
    expect(kept.customer_name).not.toBeNull();
    expect(dropLinkedPersonName(kept, ['Arthur Doe']).customer_name).toBeNull();
    expect(dropLinkedPersonName(kept, ['  arthur   DOE ']).customer_name).toBeNull();
  });

  it('keeps customer_name when the linked name differs', () => {
    expect(dropLinkedPersonName(kept, ['Jane Doe']).customer_name).toEqual(kept.customer_name);
  });

  it('is a no-op for an empty names list', () => {
    expect(dropLinkedPersonName(kept, [])).toBe(kept);
  });

  it('leaves the other six fields untouched', () => {
    const out = dropLinkedPersonName(kept, ['Arthur Doe']);
    for (const name of FIELD_NAMES.filter((n) => n !== 'customer_name')) {
      expect(out[name]).toBe(kept[name]);
    }
  });
});
