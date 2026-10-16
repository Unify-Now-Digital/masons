import type { PipelineJob } from '../types/jobsPipeline.types';
import { extractQuoteAmount, type Contact, type QuoteMatch } from './opportunities';

export interface PipelineSignals {
  contacts: Map<string, Contact>;
  quotes: Map<string, QuoteMatch>;
}

export interface ConvRow { id: string; person_id: string | null; channel: string; last_inbound_at: string | null; last_outbound_at: string | null }
const maxIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

export interface MsgRow { conversation_id: string; sent_at: string; body_text: string | null }

/** Pure: per-job last in/out across the family's conversations + latest Gmail quote. */
export function combineSignals(jobs: PipelineJob[], convList: ConvRow[], msgs: MsgRow[]): PipelineSignals {
  const latestQuoteByConv = new Map<string, QuoteMatch>();
  for (const m of [...msgs].sort((x, y) => (x.sent_at < y.sent_at ? 1 : -1))) {
    if (latestQuoteByConv.has(m.conversation_id)) continue;
    const amount = extractQuoteAmount(m.body_text);
    if (amount != null) latestQuoteByConv.set(m.conversation_id, { amount, sentAt: m.sent_at });
  }
  const convsOf = (j: PipelineJob) =>
    convList.filter((c) => c.id === j.conversation_id || (j.person_id && c.person_id === j.person_id));
  const contacts = new Map<string, Contact>();
  const quotes = new Map<string, QuoteMatch>();
  for (const j of jobs) {
    let lastIn: string | null = null, lastOut: string | null = null, q: QuoteMatch | null = null;
    for (const c of convsOf(j)) {
      lastIn = maxIso(lastIn, c.last_inbound_at);
      lastOut = maxIso(lastOut, c.last_outbound_at);
      const cq = latestQuoteByConv.get(c.id);
      if (cq && (!q || cq.sentAt > q.sentAt)) q = cq;
    }
    contacts.set(j.id, { lastIn, lastOut });
    if (q) quotes.set(j.id, q);
  }
  return { contacts, quotes };
}
