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
 * Attempt to auto-link an inbox conversation to a customer record.
 *
 * Rules:
 * - Canonical table is `customers`.
 * - person_id already set → no-op (never overwrite manual links).
 * - channel='email': strict normalized email match against customers.email,
 *   equivalent to lower(trim(inbox_conversations.primary_handle)) = lower(trim(customers.email)).
 * - channel in ('sms','whatsapp'): strict phone match against customers.phone.
 * - 1 match     → linked (person_id set).
 * - 0 matches   → unlinked (person_id null).
 * - >1 matches  → ambiguous (person_id null, candidates stored in link_meta).
 */
export async function attemptAutoLink(
  supabaseAdmin: any,
  conversationId: string,
  channel: LinkChannel,
  primaryHandleRaw: string,
): Promise<void> {
  const { data: conv, error: convErr } = await supabaseAdmin
    .from('inbox_conversations')
    .select('id, person_id')
    .eq('id', conversationId)
    .maybeSingle();

  if (convErr) throw convErr;
  if (!conv) return;
  if (conv.person_id) return; // never overwrite an existing link

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

  // We intentionally keep matching deterministic and strict:
  // - For email: case-insensitive equality, no wildcards.
  // - For phone: exact equality.
  let query = supabaseAdmin.from('customers').select('id');

  if (channel === 'email') {
    // Case-insensitive exact match: normalizedHandle is already lowercase and trimmed.
    // Using ilike without wildcards behaves as equality but allows leveraging indexes.
    query = query.ilike(matchColumn, normalizedHandle);
  } else {
    query = query.eq(matchColumn, normalizedHandle);
  }

  const { data: matches, error: matchErr } = await query;
  if (matchErr) throw matchErr;

  const ids = (matches ?? []).map((m: any) => m.id);

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

