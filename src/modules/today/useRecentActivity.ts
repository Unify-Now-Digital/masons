import { useQuery } from '@tanstack/react-query';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';
import {
  recentActivity,
  type ActivityEvent,
  type ActivityInvoice,
  type ActivityMessage,
  type ActivityOrderEvent,
  type ActivityProof,
  type ActivityQuote,
} from './recentActivity';

export function useRecentActivity(personId: string | null, orderId: string | null, conversationId?: string | null) {
  const { organizationId } = useOrganization();
  const canSeeMoney = useCanSeeMoney();
  const query = useQuery({
    queryKey: ['today-recent', organizationId, personId, orderId, conversationId ?? null, canSeeMoney],
    enabled: !!organizationId && !!(personId || orderId || conversationId),
    queryFn: () => loadRecentActivity({
      organizationId: organizationId!,
      personId,
      orderId,
      conversationId: conversationId ?? null,
      canSeeMoney,
    }),
  });
  return { events: query.data ?? [], isLoading: query.isLoading };
}

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/** Client-side merge of messages, quotes, invoices, order events and proofs already stored. */
export async function loadRecentActivity(args: {
  organizationId: string;
  personId: string | null;
  orderId: string | null;
  conversationId: string | null;
  canSeeMoney: boolean;
  now?: Date;
}): Promise<ActivityEvent[]> {
  const { organizationId, personId, orderId, conversationId, canSeeMoney } = args;
  const convIds = new Set<string>();
  if (conversationId) convIds.add(conversationId);

  const convFilters = [
    personId
      ? supabase.from('inbox_conversations').select('id').eq('organization_id', organizationId).eq('person_id', personId).limit(8)
      : null,
    orderId
      ? supabase.from('inbox_conversations').select('id').eq('organization_id', organizationId).eq('order_id', orderId).limit(8)
      : null,
  ].filter(Boolean) as PromiseLike<{ data: { id: string }[] | null; error: { message?: string } | null }>[];

  const convLists = await Promise.all(convFilters.map((query) => rows(query)));
  for (const list of convLists) for (const row of list) convIds.add(row.id);

  const quoteFilter = [personId ? `customer_id.eq.${personId}` : null, orderId ? `converted_to_order_id.eq.${orderId}` : null]
    .filter(Boolean)
    .join(',');

  const [messages, quotes, invoices, orderEvents, proofs] = await Promise.all([
    convIds.size
      ? rows(supabase
        .from('inbox_messages')
        .select('id, conversation_id, channel, direction, body_text, sent_at, meta')
        .in('conversation_id', [...convIds])
        .order('sent_at', { ascending: false })
        .limit(12))
      : Promise.resolve([]),
    quoteFilter
      ? rows(supabase
        .from('quotes')
        .select('id, quote_number, created_at, sent_at, paid_at')
        .eq('organization_id', organizationId)
        .or(quoteFilter)
        .order('created_at', { ascending: false })
        .limit(8))
      : Promise.resolve([]),
    canSeeMoney && orderId
      ? rows(supabase
        .from('invoices')
        .select('id, invoice_number, created_at, issue_date, paid_at, status')
        .eq('organization_id', organizationId)
        .eq('order_id', orderId)
        .limit(8))
      : Promise.resolve([]),
    // 403 for the owner is a missing GRANT SELECT to authenticated, not a locked
    // column. RLS policy order_events_org_select already allows org members.
    // The grant lives in 20261016120000_order_events_select_grant.sql and is NOT
    // applied from this change. Until it is, this select returns [] and the
    // browser still logs the 403.
    orderId
      ? rows(supabase
        .from('order_events')
        .select('id, created_at, summary, detail')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(8))
      : Promise.resolve([]),
    orderId
      ? rows(supabase
        .from('order_proofs')
        .select('id, sent_at, created_at')
        .eq('organization_id', organizationId)
        .eq('order_id', orderId)
        .limit(4))
      : Promise.resolve([]),
  ]);

  const proofIds = proofs.map((proof) => proof.id).filter(Boolean);
  const versions = proofIds.length
    ? await rows(supabase
      .from('order_proof_versions')
      .select('id, created_at, event, proof_id')
      .eq('organization_id', organizationId)
      .in('proof_id', proofIds)
      .order('created_at', { ascending: false })
      .limit(8))
    : [];

  const messageRows: ActivityMessage[] = messages.flatMap((row) => {
    const at = row.sent_at;
    if (!at) return [];
    return [{
      id: row.id,
      at,
      direction: row.direction ?? 'inbound',
      channel: row.channel ?? 'email',
      body: row.body_text ?? '',
      conversationId: row.conversation_id,
      meta: row.meta,
    }];
  });

  const quoteRows: ActivityQuote[] = quotes.flatMap((row) => {
    if (!row.created_at) return [];
    return [{
      id: row.id,
      at: row.created_at,
      number: row.quote_number,
      sentAt: row.sent_at,
      paidAt: row.paid_at,
    }];
  });

  const invoiceRows: ActivityInvoice[] = invoices.flatMap((row) => {
    if (!row.created_at) return [];
    const sent = (row.status ?? '').toLowerCase() === 'sent' || (row.status ?? '').toLowerCase() === 'open';
    return [{
      id: row.id,
      at: row.created_at,
      number: row.invoice_number || row.id.slice(0, 8),
      sentAt: row.issue_date ?? (sent ? row.created_at : null),
      paidAt: row.paid_at,
    }];
  });

  const eventRows: ActivityOrderEvent[] = orderEvents.flatMap((row) => {
    if (!row.created_at || !orderId) return [];
    const detail = typeof row.detail === 'string' ? row.detail : null;
    return [{
      id: row.id,
      at: row.created_at,
      summary: row.summary || 'Order updated',
      detail,
      orderId,
    }];
  });

  const proofRows: ActivityProof[] = [
    ...proofs.flatMap((proof) => {
      if (!proof.sent_at || !orderId) return [];
      return [{ id: `${proof.id}:sent`, at: proof.sent_at, orderId, label: 'Proof sent' }];
    }),
    ...versions.flatMap((version) => {
      if (!version.created_at || !orderId) return [];
      if (!/sent/i.test(version.event ?? '')) return [];
      return [{ id: version.id, at: version.created_at, orderId, label: 'Proof sent' }];
    }),
  ];

  return recentActivity({
    messages: messageRows,
    quotes: quoteRows,
    invoices: canSeeMoney ? invoiceRows : [],
    orderEvents: eventRows,
    proofs: proofRows,
  }, args.now ?? new Date());
}
