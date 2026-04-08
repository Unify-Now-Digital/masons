import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { inboxKeys } from '@/modules/inbox/hooks/useInboxConversations';
import { invalidateInboxThreadSummaries } from '@/modules/inbox/hooks/useThreadSummary';

export type LinkedContact = {
  id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  value: string;
};

export const linkedContactsKeys = {
  byCustomer: (customerId: string | null | undefined) =>
    ['linked-contacts', customerId ?? null] as const,
};

function dedupeValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

async function fetchLinkedContacts(customerId: string): Promise<LinkedContact[]> {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .select('id, channel, primary_handle, created_at')
    .eq('person_id', customerId)
    .eq('link_state', 'linked')
    .not('primary_handle', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = (data ?? [])
    .map((row) => {
      const id = typeof row.id === 'string' ? row.id : '';
      const channel = row.channel;
      const raw = typeof row.primary_handle === 'string' ? row.primary_handle.trim() : '';
      if (!raw || !id) return null;
      if (channel !== 'email' && channel !== 'sms' && channel !== 'whatsapp') return null;
      return {
        id,
        channel,
        value: raw,
      } satisfies LinkedContact;
    })
    .filter((row): row is LinkedContact => row !== null);

  // Most recent first (query order) — keep one row per (channel, primary_handle) with newest id
  const seen = new Set<string>();
  const deduped: LinkedContact[] = [];
  for (const contact of rows) {
    const key = `${contact.channel}:${contact.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(contact);
  }

  return deduped;
}

export function buildEmailOptions(
  linkedEmails: string[],
  staticEmail: string | null | undefined,
): string[] {
  return dedupeValues([
    ...(staticEmail?.trim() ? [staticEmail] : []),
    ...linkedEmails,
  ]);
}

export function buildPhoneOptions(
  linkedPhones: string[],
  staticPhone: string | null | undefined,
): string[] {
  return dedupeValues([
    ...(staticPhone?.trim() ? [staticPhone] : []),
    ...linkedPhones,
  ]);
}

export function useLinkedContactsByCustomer(customerId: string | null | undefined): {
  contacts: LinkedContact[];
  emails: string[];
  phones: string[];
  whatsapp: string[];
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: linkedContactsKeys.byCustomer(customerId),
    queryFn: () => fetchLinkedContacts(customerId!),
    enabled: !!customerId,
    staleTime: 30_000,
  });

  const contacts = query.data ?? [];
  const emails = dedupeValues(contacts.filter((c) => c.channel === 'email').map((c) => c.value));
  const phones = dedupeValues(
    contacts
      .filter((c) => c.channel === 'sms' || c.channel === 'whatsapp')
      .map((c) => c.value),
  );
  const whatsapp = dedupeValues(
    contacts.filter((c) => c.channel === 'whatsapp').map((c) => c.value),
  );

  return {
    contacts,
    emails,
    phones,
    whatsapp,
    isLoading: !!customerId && query.isLoading,
  };
}

export function useUnlinkContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      channel,
      value,
    }: {
      customerId: string;
      channel: LinkedContact['channel'];
      value: string;
    }) => {
      const { error } = await supabase
        .from('inbox_conversations')
        .update({
          person_id: null,
          link_state: 'unlinked',
          link_meta: {},
        })
        .eq('person_id', customerId)
        .eq('link_state', 'linked')
        .eq('channel', channel)
        .eq('primary_handle', value)
        .select('id');

      if (error) throw error;
      return true;
    },
    onMutate: async ({ customerId, channel, value }) => {
      await queryClient.cancelQueries({ queryKey: linkedContactsKeys.byCustomer(customerId) });

      const prev = queryClient.getQueryData<LinkedContact[]>(
        linkedContactsKeys.byCustomer(customerId),
      );

      if (prev) {
        queryClient.setQueryData<LinkedContact[]>(
          linkedContactsKeys.byCustomer(customerId),
          prev.filter((c) => !(c.channel === channel && c.value.toLowerCase() === value.toLowerCase())),
        );
      }

      return { prev, customerId };
    },
    onError: (_err, _vars, ctx) => {
      // Surface unlink problems so multi-click failures can be debugged.
      console.error('[useUnlinkContact] error:', _err);
      if (ctx?.prev) {
        queryClient.setQueryData(linkedContactsKeys.byCustomer(ctx.customerId), ctx.prev);
      }
    },
    onSuccess: (_, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: linkedContactsKeys.byCustomer(customerId) });
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}
