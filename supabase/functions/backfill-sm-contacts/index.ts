import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { attemptAutoLink } from '../_shared/autoLinkConversation.ts';
import { shouldAutoCreatePerson } from '../_shared/mutedSenderPatterns.ts';
import { normalizeHandle } from '../_shared/normalizeHandle.ts';

// One-off backfill for assisted-contact-creation-and-backfill Commit C3.
// Contract: specs/assisted-contact-creation-and-backfill/contracts/backfill-sm-contacts.md
// Reuses the LIVE ingest code path (AC-005): shouldAutoCreatePerson for the
// candidate verdicts, attemptAutoLink (createIfMissing) for execution —
// creation, linking, race safety (23505 → re-query → link) and the
// person_id-already-set no-op all come from the deployed _shared modules,
// UNMODIFIED. JWT verification stays ON (plain deploy); invoked by Giorgi with
// the service-role key as Bearer. The deployment is deleted after evidence is
// recorded; this source stays in the repo as the record of what ran.

type Mode = 'dry-run' | 'execute';

interface ConversationRow {
  id: string;
  channel: string;
  primary_handle: string;
  person_id: string | null;
  link_state: string;
  link_meta: Record<string, unknown> | null;
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  let body: { organization_id?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON body' });
  }

  // The body is the ONLY tenant scope this function will use (AC-001).
  const organizationId = (body.organization_id ?? '').trim();
  if (!organizationId) return json(400, { error: 'organization_id is required' });
  const mode = (body.mode ?? 'dry-run') as Mode;
  if (mode !== 'dry-run' && mode !== 'execute') {
    return json(400, { error: `unknown mode: ${String(body.mode)}` });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // mutedSet: same predicate as the ingest loaders (tombstone semantics).
  const { data: mutedRows, error: mutedErr } = await admin
    .from('inbox_muted_senders')
    .select('normalized_handle')
    .eq('organization_id', organizationId)
    .is('unmuted_at', null);
  if (mutedErr) return json(500, { error: `mutedSet load failed: ${mutedErr.message}` });
  const mutedSet: ReadonlySet<string> = new Set(
    (mutedRows ?? []).map((r: { normalized_handle: string }) => r.normalized_handle),
  );

  // All person-less conversations in the org, classified below. The FR-1 CHECK
  // makes person_id-null equivalent to link_state != 'linked'.
  const { data: convRows, error: convErr } = await admin
    .from('inbox_conversations')
    .select('id, channel, primary_handle, person_id, link_state, link_meta')
    .eq('organization_id', organizationId)
    .is('person_id', null);
  if (convErr) return json(500, { error: `conversations load failed: ${convErr.message}` });

  // Classification precedence for excluded_counts: ambiguous → web stub →
  // phone-shaped → gate. Each row is counted once, in the first bucket it hits.
  // The gate runs FRESH on every invocation (execute included), so a handle
  // muted between dry-run and execute drops out of candidates rather than
  // being replayed from a stale list.
  const excluded = { web_stub: 0, phone_shaped: 0, ambiguous: 0, gate_fail: 0 };
  const candidates: ConversationRow[] = [];
  let unlinkedScanned = 0;
  for (const conv of (convRows ?? []) as ConversationRow[]) {
    if (conv.link_state === 'ambiguous') { excluded.ambiguous += 1; continue; }
    unlinkedScanned += 1;
    if (conv.channel === 'web') { excluded.web_stub += 1; continue; }                 // FR-C2
    if (!conv.primary_handle.includes('@')) { excluded.phone_shaped += 1; continue; } // FR-C1
    if (!shouldAutoCreatePerson(conv.primary_handle, mutedSet)) {
      excluded.gate_fail += 1;
      continue;
    }
    candidates.push(conv);
  }

  // Deterministic order: normalized handle, then id — same-handle groups are
  // contiguous, so in execute mode the first conversation creates the person
  // and the rest hit attemptAutoLink's 1-match path (one person per handle,
  // FR-C3). Serial by design; never parallel.
  candidates.sort((a, b) => {
    const ha = normalizeHandle(a.primary_handle);
    const hb = normalizeHandle(b.primary_handle);
    return ha < hb ? -1 : ha > hb ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  if (mode === 'dry-run') {
    // Existing-person probe: same normalization rule the linker uses.
    const { data: peopleRows, error: peopleErr } = await admin
      .from('people')
      .select('id, email')
      .eq('organization_id', organizationId)
      .not('email', 'is', null);
    if (peopleErr) return json(500, { error: `people load failed: ${peopleErr.message}` });
    const personByEmail = new Map<string, string>();
    for (const p of (peopleRows ?? []) as { id: string; email: string }[]) {
      personByEmail.set(p.email.trim().toLowerCase(), p.id);
    }

    const byHandle = new Map<string, { handle: string; conversation_ids: string[] }>();
    for (const conv of candidates) {
      const key = normalizeHandle(conv.primary_handle);
      const group = byHandle.get(key) ?? { handle: key, conversation_ids: [] };
      group.conversation_ids.push(conv.id);
      byHandle.set(key, group);
    }

    const candidateGroups = [...byHandle.values()].map((g) => ({
      handle: g.handle,
      conversation_ids: g.conversation_ids,
      gate_pass: true, // gate-fail rows were excluded above and counted
      existing_person_id: personByEmail.get(g.handle) ?? null,
    }));

    return json(200, {
      mode,
      organization_id: organizationId,
      candidates: candidateGroups,
      excluded_counts: excluded,
      totals: {
        unlinked_scanned: unlinkedScanned,
        creatable_handles: candidateGroups.length,
        conversations_affected: candidates.length,
      },
    });
  }

  // mode === 'execute'
  const results: Array<{
    conversation_id: string;
    handle: string;
    outcome:
      | 'created_and_linked'
      | 'linked_existing'
      | 'skipped_already_linked'
      | 'error';
    person_id: string | null;
    error: string | null;
  }> = [];
  const totals = { people_created: 0, conversations_linked: 0, skipped: 0, errors: 0 };

  for (const conv of candidates) {
    const handle = normalizeHandle(conv.primary_handle);
    try {
      // Write-time re-check (review→execute race): skip if linked meanwhile.
      const { data: pre, error: preErr } = await admin
        .from('inbox_conversations')
        .select('person_id')
        .eq('id', conv.id)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (preErr) throw preErr;
      if (!pre) throw new Error('conversation not found at write time');
      if (pre.person_id) {
        results.push({
          conversation_id: conv.id,
          handle,
          outcome: 'skipped_already_linked',
          person_id: pre.person_id,
          error: null,
        });
        totals.skipped += 1;
        continue;
      }

      await attemptAutoLink(admin, conv.id, 'email', conv.primary_handle, organizationId, {
        createIfMissing: true,
        mutedSet,
      });

      const { data: post, error: postErr } = await admin
        .from('inbox_conversations')
        .select('person_id, link_state, link_meta')
        .eq('id', conv.id)
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (postErr) throw postErr;

      if (post?.person_id && post.link_state === 'linked') {
        const created = (post.link_meta as { created?: boolean } | null)?.created === true;
        results.push({
          conversation_id: conv.id,
          handle,
          outcome: created ? 'created_and_linked' : 'linked_existing',
          person_id: post.person_id,
          error: null,
        });
        totals.conversations_linked += 1;
        if (created) totals.people_created += 1;
      } else {
        // Gate passed pre-flight, so still-unlinked means attemptAutoLink
        // failed closed internally (insert-error path) — surface as error.
        results.push({
          conversation_id: conv.id,
          handle,
          outcome: 'error',
          person_id: null,
          error: 'attemptAutoLink left conversation unlinked — see function logs',
        });
        totals.errors += 1;
      }
    } catch (e) {
      results.push({
        conversation_id: conv.id,
        handle,
        outcome: 'error',
        person_id: null,
        error: e instanceof Error ? e.message : String(e),
      });
      totals.errors += 1;
    }
  }

  return json(200, { mode, organization_id: organizationId, results, totals });
});
