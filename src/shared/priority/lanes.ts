/**
 * ONE list per scope, consumed verbatim by the Inbox Priority view and the Hub lanes
 * (Sales = Enquiries, CS = Customers): same membership, same order, same reason text,
 * same pill label, same cap. Pure; no React, no Supabase.
 */
import type { Opportunity } from '@/modules/jobsPipeline/utils/opportunities';
import type { NextActionKind, NextActionTone } from '@/shared/lib/nextAction';
import type { PriorityItem } from './customerPriority';

export const SHARED_CAP = 15;

export interface SharedPriorityRow {
  key: string;
  personId: string;
  conversationId: string | null;
  orderId?: string | null;
  name: string;
  value: number | null;
  valueIsGuess?: boolean;
  stage: string;
  action: { kind: Exclude<NextActionKind, 'none'>; label: string; tone: NextActionTone };
  why: string;
  since: string | null;
  lastInAt?: string | null;
  lastOutAt?: string | null;
}

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const tone = (c: string): NextActionTone => (c === 'red' ? 'red' : c === 'amber' ? 'amber' : 'neutral');

/** Enquiries: the jobsPipeline todayList (already ranked + test/staff excluded), as rows. */
export function enquiryPriorityRows(today: Opportunity[], cap = SHARED_CAP): SharedPriorityRow[] {
  return today.filter((o) => o.job.person_id).slice(0, cap).map((o) => {
    const p = o.job.person;
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ').replace(/\s+-$/, '') || o.job.conversation?.primary_handle || 'Enquiry';
    return {
      key: `job:${o.job.id}`, personId: o.job.person_id!, conversationId: o.job.conversation_id ?? null,
      name, value: o.value, valueIsGuess: o.valueSource === 'median',
      stage: o.job.stage.charAt(0).toUpperCase() + o.job.stage.slice(1),
      action: { kind: o.action.kind, label: o.action.label, tone: tone(o.action.colour) },
      why: o.action.why + (o.valueSource === 'gmail_quote' ? ` · ${gbp(o.value)} quote` : ''),
      since: o.waitingOnUs ? o.lastIn : (o.lastOut ?? o.lastIn ?? o.job.created_at),
      lastInAt: o.lastIn, lastOutAt: o.lastOut,
    };
  });
}

/** Customers: the ranked customerPriorityList output, as rows. */
export function customerPriorityRows(items: (PriorityItem & { conversationId?: string | null })[], cap = SHARED_CAP): SharedPriorityRow[] {
  return items.slice(0, cap).map((it) => ({
    key: it.key, personId: it.personId, conversationId: it.conversationId ?? null,
    orderId: it.key.startsWith('order:') ? it.key.slice(6) : null,
    name: it.name, value: it.value, stage: it.stage,
    action: { kind: it.action.kind, label: it.action.label, tone: it.action.tone },
    why: it.why, since: it.since,
  }));
}

/** Group CONSECUTIVE rows with the same reason (order never changes). */
export function groupConsecutive<T extends { why: string }>(rows: T[]): { why: string; items: T[] }[] {
  const out: { why: string; items: T[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.why === r.why) last.items.push(r); else out.push({ why: r.why, items: [r] });
  }
  return out;
}
