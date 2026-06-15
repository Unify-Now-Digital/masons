import { supabase } from '@/shared/lib/supabase';
import type { ConversationFilters, InboxConversation } from '../types/inbox.types';

export type EnquiryPipelineStage = 'new' | 'in_progress';

export interface EnquiryPipelinePerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

export interface EnquiryPipelineItem {
  conversation: InboxConversation;
  /** Resolved like operational inbox: linked person name, else primary_handle. */
  displayName: string;
  person: EnquiryPipelinePerson | null;
}

export interface EnquiryPipelineBuckets {
  new: EnquiryPipelineItem[];
  in_progress: EnquiryPipelineItem[];
}

function formatPersonDisplayName(person: EnquiryPipelinePerson): string {
  const name = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
  return name || person.email || person.phone || '—';
}

function buildPersonNameMap(people: EnquiryPipelinePerson[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const person of people) {
    map.set(person.id, formatPersonDisplayName(person));
  }
  return map;
}

async function fetchPeopleByIds(
  organizationId: string,
  personIds: string[],
): Promise<EnquiryPipelinePerson[]> {
  if (personIds.length === 0) return [];

  const { data, error } = await supabase
    .from('people')
    .select('id, first_name, last_name, email, phone')
    .eq('organization_id', organizationId)
    .in('id', personIds);

  if (error) throw error;
  return (data ?? []) as EnquiryPipelinePerson[];
}

function resolveDisplayName(
  conversation: InboxConversation,
  personNameMap: Map<string, string>,
): string {
  if (conversation.person_id) {
    return personNameMap.get(conversation.person_id) ?? conversation.primary_handle;
  }
  return conversation.primary_handle;
}

export async function fetchEnquiryPipeline(
  organizationId: string,
  filters?: Pick<ConversationFilters, 'channel'>,
): Promise<EnquiryPipelineBuckets> {
  let query = supabase
    .from('inbox_conversations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'open')
    .is('order_id', null)
    .in('enquiry_stage', ['new', 'in_progress'])
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (filters?.channel) {
    query = query.eq('channel', filters.channel);
  }

  const { data, error } = await query;
  if (error) throw error;

  const conversations = (data ?? []) as InboxConversation[];
  const personIds = [
    ...new Set(conversations.map((c) => c.person_id).filter((id): id is string => !!id)),
  ];
  const people = await fetchPeopleByIds(organizationId, personIds);
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const personNameMap = buildPersonNameMap(people);

  const buckets: EnquiryPipelineBuckets = { new: [], in_progress: [] };

  for (const conversation of conversations) {
    const stage = conversation.enquiry_stage ?? 'new';
    const item: EnquiryPipelineItem = {
      conversation,
      displayName: resolveDisplayName(conversation, personNameMap),
      person: conversation.person_id ? peopleById.get(conversation.person_id) ?? null : null,
    };
    if (stage === 'in_progress') {
      buckets.in_progress.push(item);
    } else {
      buckets.new.push(item);
    }
  }

  return buckets;
}
