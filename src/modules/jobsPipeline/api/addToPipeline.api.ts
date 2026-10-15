import { normalizeLeadSource, suggestLeadChannel } from '@/shared/lib/leadSource';
import { supabase } from '@/shared/lib/supabase';
import { classifyHandle, mapChannelToSource, normalizeEmail, phoneLast10 } from '../utils/display';
import { fetchConversationJob } from './jobsPipeline.api';

/** Thrown by the concurrency re-check — informational, not a failure. */
export class AlreadyInPipelineError extends Error {
  constructor() {
    super('This conversation is already in the pipeline');
    this.name = 'AlreadyInPipelineError';
  }
}

/** Job was created but the conversation link write failed (partial progress, retryable via "Link person"). */
export class ConversationLinkError extends Error {
  jobId: string;
  cause: unknown;
  constructor(jobId: string, cause: unknown) {
    super(
      'Job created, but linking the conversation failed — use "Link person" on the conversation to finish.',
    );
    this.name = 'ConversationLinkError';
    this.jobId = jobId;
    this.cause = cause;
  }
}

export interface AddToPipelineResult {
  jobId: string;
  personId: string;
  personCreated: boolean;
  conversationLinked: boolean;
}

interface PersonMatchRow {
  id: string;
  email: string | null;
  phone: string | null;
}

/**
 * Resolve a person for the conversation handle. Dedupe is ORG-SCOPED ONLY —
 * matching a same-handle person in another org must never link or leak
 * (spec FR-010). Matchers mirror AddToCustomersDialog: normalized email
 * equality, or last-10-digits phone equality.
 */
export async function resolvePersonId(
  organizationId: string,
  handle: string,
): Promise<{ personId: string; created: boolean }> {
  const classified = classifyHandle(handle);

  if (classified.kind !== 'unknown') {
    const { data, error } = await supabase
      .from('people')
      .select('id, email, phone')
      .eq('organization_id', organizationId);
    if (error) throw error;

    const match = (data as PersonMatchRow[] | null)?.find((person) => {
      if (classified.kind === 'email') return normalizeEmail(person.email) === classified.value;
      return phoneLast10(person.phone) === classified.last10;
    });
    if (match) return { personId: match.id, created: false };
  }

  const firstName =
    classified.kind === 'email' ? classified.value.split('@')[0] : handle.trim() || 'Unknown';
  const { data: created, error: insertError } = await supabase
    .from('people')
    .insert({
      organization_id: organizationId,
      first_name: firstName,
      last_name: '',
      email: classified.kind === 'email' ? classified.value : null,
      phone: classified.kind === 'phone' ? classified.value : null,
      created_via: 'manual',
      is_test: false,
    })
    .select('id')
    .single();
  if (insertError) throw insertError;
  return { personId: created.id, created: true };
}

export async function addConversationToPipeline(args: {
  organizationId: string;
  conversationId: string;
  /** Intentional additional job (repeat customer) — skips the already-in-pipeline guard. */
  allowAdditional?: boolean;
  /** Where the enquiry came from (Phone/YOPA, FD referral, …); null = not recorded. */
  leadSource?: string | null;
}): Promise<AddToPipelineResult> {
  const { organizationId, conversationId, allowAdditional, leadSource } = args;

  // Resolve the conversation server-side (org-scoped) so callers only pass an id.
  const { data: conversation, error: convError } = await supabase
    .from('inbox_conversations')
    .select('id, channel, primary_handle, person_id')
    .eq('id', conversationId)
    .eq('organization_id', organizationId)
    .single();
  if (convError) throw convError;

  // Step 1: concurrency re-check (best-effort V1 — no DB uniqueness on
  // conversation_id). Guards accidental duplicates only; an explicit "New job"
  // (allowAdditional) is allowed to create a second job on the conversation.
  if (!allowAdditional) {
    const existing = await fetchConversationJob(conversation.id);
    if (existing) throw new AlreadyInPipelineError();
  }

  // Step 2: resolve or create the person.
  const hadPerson = !!conversation.person_id;
  const { personId, created: personCreated } = hadPerson
    ? { personId: conversation.person_id!, created: false }
    : await resolvePersonId(organizationId, conversation.primary_handle);

  // Step 3: create the job. No source picked → inherit the person's latest website enquiry
  // source (enquiries.lead_source), so "Add to pipeline" doesn't leave it blank.
  const resolvedLeadSource = pickLeadSource(leadSource, personId ? await latestEnquiryLeadSource(organizationId, personId) : null);
  const jobRow = {
    organization_id: organizationId,
    person_id: personId,
    conversation_id: conversation.id,
    source: mapChannelToSource(conversation.channel),
    lead_source: resolvedLeadSource,
    lead_channel: suggestLeadChannel(conversation.channel),
    stage: 'enquired',
    stage_status: 'uncontacted',
  };
  let { data: job, error: jobError } = await supabase.from('jobs').insert(jobRow).select('id').single();
  // Until migration 20261015095256 is applied jobs.lead_channel does not exist (PGRST204): retry without it.
  if (jobError && (jobError as { code?: string }).code === 'PGRST204') {
    const { lead_channel: _drop, ...legacy } = jobRow; // eslint-disable-line @typescript-eslint/no-unused-vars
    ({ data: job, error: jobError } = await supabase.from('jobs').insert(legacy).select('id').single());
  }
  if (jobError) throw jobError;

  // Step 4: link the conversation (only when it was unlinked at entry).
  // Payload must NOT include updated_at (PostgREST silent-reject — commit 53e8eb1).
  let conversationLinked = false;
  if (!hadPerson) {
    const { error: linkError } = await supabase
      .from('inbox_conversations')
      .update({ person_id: personId, link_state: 'linked', link_meta: {} })
      .eq('id', conversation.id)
      .eq('organization_id', organizationId);
    if (linkError) throw new ConversationLinkError(job.id, linkError);
    conversationLinked = true;
  }

  return { jobId: job.id, personId, personCreated, conversationLinked };
}

/** Explicit choice wins; otherwise the person's latest enquiry source; otherwise null. */
export function pickLeadSource(chosen: string | null | undefined, fromEnquiry: string | null | undefined) {
  return normalizeLeadSource(chosen) ?? normalizeLeadSource(fromEnquiry);
}

async function latestEnquiryLeadSource(organizationId: string, personId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('enquiries')
    .select('lead_source')
    .eq('organization_id', organizationId)
    .eq('person_id', personId)
    .not('lead_source', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null; // best effort: never block the add on this lookup
  return data?.lead_source ?? null;
}
