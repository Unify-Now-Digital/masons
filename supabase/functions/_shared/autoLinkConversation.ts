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
 * - channel='email': strict normalized email match against people.email,
 *   equivalent to lower(trim(inbox_conversations.primary_handle)) = lower(trim(people.email)).
 * - channel in ('sms','whatsapp'): digit-normalised phone match against people.phone —
 *   both sides stripped to digits, compared on their last 10 digits
 *   (so 07700900123 matches +447700900123).
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

  const normalizedHandle =
    channel === 'email' ? rawHandle.toLowerCase() : rawHandle;

  if (!normalizedHandle) {
    await updateLinkState(supabaseAdmin, conversationId, 'unlinked', null, {});
    return;
  }

  const matchColumn = channel === 'email' ? 'email' : 'phone';

  let ids: string[];

  if (channel === 'email') {
    // Case-insensitive exact match: normalizedHandle is already lowercase and trimmed.
    // Using ilike without wildcards behaves as equality but allows leveraging indexes.
    const { data: matches, error: matchErr } = await supabaseAdmin
      .from('people')
      .select('id')
      .eq('organization_id', organizationId)
      .ilike(matchColumn, normalizedHandle);
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

  await updateLinkState(supabaseAdmin, conversationId, 'unlinked', null, {});
}

