import { shouldAutoCreatePerson } from './mutedSenderPatterns.ts';

type LinkState = 'linked' | 'unlinked' | 'ambiguous';
type LinkChannel = 'email' | 'sms' | 'whatsapp';

/**
 * Update person_id/link_state/link_meta for an inbox_conversations row.
 * Throws on error.
 */
export async function updateLinkState(
  supabaseAdmin: any,
  conversationId: string,
  linkState: LinkState,
  personId: string | null,
  linkMeta: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('inbox_conversations')
    .update({
      person_id: personId,
      link_state: linkState,
      link_meta: linkMeta,
    })
    .eq('id', conversationId);

  if (error) throw error;
}

/**
 * Attempt to auto-link an inbox conversation to a person record.
 *
 * Rules:
 * - Canonical table is `people`, always scoped by organization_id (service-role
 *   client bypasses RLS, so an unscoped match would cross tenants — fail closed).
 * - person_id already set → no-op (never overwrite manual links).
 * - Match strategy derives from the HANDLE's shape, never the channel (FR-2,
 *   single-authority): handle contains '@' → strict normalized email match
 *   against people.email, equivalent to
 *   lower(trim(inbox_conversations.primary_handle)) = lower(trim(people.email));
 *   otherwise → digit-normalised phone match against people.phone — both
 *   sides stripped to digits, compared on their last 10 digits
 *   (so 07700900123 matches +447700900123).
 * - `channel` is metadata only (kept for callers' logging/link_meta context);
 *   it never selects the match strategy.
 * - 1 match     → linked (person_id set).
 * - 0 matches   → unlinked (person_id null).
 * - >1 matches  → ambiguous (person_id null, candidates stored in link_meta).
 */
export async function attemptAutoLink(
  supabaseAdmin: any,
  conversationId: string,
  channel: LinkChannel,
  primaryHandleRaw: string,
  organizationId: string,
  opts?: { createIfMissing?: boolean; displayName?: string; mutedSet?: ReadonlySet<string> },
): Promise<void> {
  const { data: conv, error: convErr } = await supabaseAdmin
    .from('inbox_conversations')
    .select('id, person_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (convErr) throw convErr;
  if (!conv) return;
  if (conv.person_id) return; // never overwrite an existing link

  // Fail closed: never match without a tenant scope.
  if (!organizationId || !organizationId.trim()) {
    await updateLinkState(supabaseAdmin, conversationId, 'unlinked', null, {});
    return;
  }

  const rawHandle = (primaryHandleRaw ?? '').trim();
  if (!rawHandle) {
    await updateLinkState(supabaseAdmin, conversationId, 'unlinked', null, {});
    return;
  }

  const strategy = rawHandle.includes('@') ? 'email' : 'phone';

  const normalizedHandle =
    strategy === 'email' ? rawHandle.toLowerCase() : rawHandle;

  if (!normalizedHandle) {
    await updateLinkState(supabaseAdmin, conversationId, 'unlinked', null, {});
    return;
  }

  const matchColumn = strategy === 'email' ? 'email' : 'phone';

  let ids: string[];

  if (strategy === 'email') {
    // Case-insensitive exact match: normalizedHandle is already lowercase and trimmed.
    // ilike (not eq): people.email may be stored mixed-case — only the index
    // lowers it via lower(email), which PostgREST eq cannot target. Escape
    // \ % _ so they match literally instead of as ilike wildcards (FR-3:
    // john_smith@x.com must not match johnasmith@x.com).
    const pattern = normalizedHandle.replace(/[\\%_]/g, (m) => '\\' + m);
    const { data: matches, error: matchErr } = await supabaseAdmin
      .from('people')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike(matchColumn, pattern);
    if (matchErr) throw matchErr;
    ids = (matches ?? []).map((m: any) => m.id);
  } else {
    // Phone: PostgREST can't express regexp_replace on the column, so fetch the
    // org's candidates and compare digit-normalised in TS. Last-10-digit rule so
    // national and E.164 forms of the same number match.
    const { data: candidates, error: matchErr } = await supabaseAdmin
      .from('people')
      .select('id, phone')
      .eq('organization_id', organizationId)
      .not('phone', 'is', null);
    if (matchErr) throw matchErr;

    const digits = (s: string) => s.replace(/\D/g, '');
    const handleDigits = digits(normalizedHandle);
    ids = (candidates ?? [])
      .filter((c: any) => {
        const candidateDigits = digits(String(c.phone ?? ''));
        return (
          handleDigits.length >= 10 &&
          candidateDigits.length >= 10 &&
          handleDigits.slice(-10) === candidateDigits.slice(-10)
        );
      })
      .map((c: any) => c.id);
  }

  if (ids.length === 1) {
    await updateLinkState(supabaseAdmin, conversationId, 'linked', ids[0], {});
    return;
  }

  if (ids.length > 1) {
    await updateLinkState(supabaseAdmin, conversationId, 'ambiguous', null, {
      candidates: ids,
      matched_on: matchColumn,
    });
    return;
  }

  // Zero matches. Creation is opt-in (createIfMissing, default false) and
  // gated by shouldAutoCreatePerson; mutedSet is loaded by the CALLER once
  // per sync run and passed via opts — never a per-conversation SELECT here.
  // Missing mutedSet fails CLOSED (no creation): veto-less creation would
  // override explicit human mute decisions, while no-creation only degrades
  // to the visible unlinked queue FR-6 serves (FR-5's asymmetry, applied to
  // the API). Any gate failure takes the same unlinked write as before
  // (never a partial state; FR-1's CHECK constraint is the DB backstop).
  if (!opts?.createIfMissing) {
    await updateLinkState(supabaseAdmin, conversationId, 'unlinked', null, {});
    return;
  }

  if (!opts.mutedSet) {
    console.error(
      'attemptAutoLink: createIfMissing set without mutedSet — refusing to create; pass the caller-loaded muted set',
    );
    await updateLinkState(supabaseAdmin, conversationId, 'unlinked', null, {});
    return;
  }

  if (!shouldAutoCreatePerson(rawHandle, opts.mutedSet)) {
    await updateLinkState(supabaseAdmin, conversationId, 'unlinked', null, {});
    return;
  }

  // Creation (FR-4): fail closed on junk phone handles — the '@'-less class
  // with <10 digits must never create a person (T002/T016 carry-forward).
  const handleDigits = rawHandle.replace(/\D/g, '');
  if (strategy === 'phone' && handleDigits.length < 10) {
    await updateLinkState(supabaseAdmin, conversationId, 'unlinked', null, {});
    return;
  }

  // Name: From-header display name when the caller has one; fallback to
  // email local-part / phone digits. last_name is REQUIRED non-null (B5).
  const displayName = opts.displayName?.trim() ?? '';
  let firstName = '';
  let lastName = '';
  if (displayName) {
    const lastSpace = displayName.lastIndexOf(' ');
    if (lastSpace > 0) {
      firstName = displayName.slice(0, lastSpace).trim();
      lastName = displayName.slice(lastSpace + 1).trim();
    } else {
      firstName = displayName;
    }
  } else {
    firstName =
      strategy === 'email'
        ? normalizedHandle.slice(0, normalizedHandle.indexOf('@'))
        : handleDigits;
  }

  const { data: created, error: insertErr } = await supabaseAdmin
    .from('people')
    .insert({
      organization_id: organizationId,
      ...(strategy === 'email'
        ? { email: normalizedHandle }
        : { phone: rawHandle }),
      first_name: firstName,
      last_name: lastName,
      created_via: 'inbox_ingest',
      is_test: false,
    })
    .select('id')
    .single();

  if (insertErr || !created) {
    // Unique violation on (organization_id, lower(email)): a concurrent sync
    // created the same person between our match and insert. Recover by
    // re-querying (T003-escaped) and linking that row — upsert semantics.
    // Only the email index can raise this; phone has no unique index.
    if (insertErr?.code === '23505' && strategy === 'email') {
      const emailPattern = normalizedHandle.replace(/[\\%_]/g, (m) => '\\' + m);
      const { data: existing, error: requeryErr } = await supabaseAdmin
        .from('people')
        .select('id')
        .eq('organization_id', organizationId)
        .ilike('email', emailPattern)
        .maybeSingle();
      if (!requeryErr && existing) {
        await updateLinkState(supabaseAdmin, conversationId, 'linked', existing.id, {});
        return;
      }
      console.error('attemptAutoLink: 23505 re-query failed', requeryErr);
      await updateLinkState(supabaseAdmin, conversationId, 'unlinked', null, {});
      return;
    }
    // Any other insert failure fails closed to unlinked (never a partial state).
    console.error('attemptAutoLink: person auto-create failed', insertErr);
    await updateLinkState(supabaseAdmin, conversationId, 'unlinked', null, {});
    return;
  }

  await updateLinkState(supabaseAdmin, conversationId, 'linked', created.id, {
    created: true,
  });
}

