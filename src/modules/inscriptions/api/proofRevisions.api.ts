import { supabase } from '@/shared/lib/supabase';

export interface ProofLine {
  text: string;
  y: number;
  fontSize: number;
}

export type ProofRevisionStatus =
  | 'draft'
  | 'sent'
  | 'changes_requested'
  | 'approved'
  | 'superseded';

export interface ProofRevision {
  id: string;
  inscription_id: string;
  order_id: string | null;
  revision_number: number;
  lines: ProofLine[];
  material_color: string | null;
  lettering_color: string | null;
  shape: string | null;
  status: ProofRevisionStatus;
  public_token: string | null;
  sent_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  customer_feedback: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ProofRevisionInsert = Partial<ProofRevision> & {
  inscription_id: string;
};

export type ProofRevisionUpdate = Partial<
  Omit<ProofRevision, 'id' | 'created_at' | 'updated_at'>
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a URL-safe ~22-char token for public proof links. */
function generatePublicToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // base64url
  const bin = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join('');
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function fetchRevisionsByInscription(inscriptionId: string): Promise<ProofRevision[]> {
  const { data, error } = await supabase
    // @ts-expect-error - proof_revisions not yet in generated Database types
    .from('proof_revisions')
    .select('*')
    .eq('inscription_id', inscriptionId)
    .order('revision_number', { ascending: false });

  if (error) throw error;
  return (data as ProofRevision[]) ?? [];
}

/** Inscription IDs that currently have the LATEST revision in 'changes_requested'. */
export async function fetchInscriptionsAwaitingEdits(
  inscriptionIds: string[],
): Promise<Set<string>> {
  if (inscriptionIds.length === 0) return new Set();
  const { data, error } = await supabase
    // @ts-expect-error - proof_revisions not yet in generated Database types
    .from('proof_revisions')
    .select('inscription_id, revision_number, status')
    .in('inscription_id', inscriptionIds)
    .order('revision_number', { ascending: false });
  if (error) throw error;

  const latestByInscription = new Map<string, string>();
  (data as Array<{ inscription_id: string; status: string }> | null ?? []).forEach((r) => {
    if (!latestByInscription.has(r.inscription_id)) {
      latestByInscription.set(r.inscription_id, r.status);
    }
  });
  return new Set(
    Array.from(latestByInscription.entries())
      .filter(([, status]) => status === 'changes_requested')
      .map(([id]) => id),
  );
}

export async function fetchRevisionByToken(token: string): Promise<ProofRevision | null> {
  // Uses a SECURITY DEFINER RPC so anonymous callers can read only the row
  // matching their token (enumeration via PostgREST is disabled at the RLS
  // level).
  const { data, error } = await supabase.rpc('get_proof_by_token', {
    p_token: token,
  });
  if (error) throw error;
  return (data as ProofRevision | null) ?? null;
}

// ---------------------------------------------------------------------------
// Mutations (mason-side, authenticated)
// ---------------------------------------------------------------------------

export interface CreateRevisionInput {
  inscriptionId: string;
  orderId?: string | null;
  lines: ProofLine[];
  materialColor?: string | null;
  letteringColor?: string | null;
  shape?: string | null;
}

/** Creates a new draft revision, auto-incrementing revision_number. */
export async function createRevision(input: CreateRevisionInput): Promise<ProofRevision> {
  const existing = await fetchRevisionsByInscription(input.inscriptionId);
  const nextNumber = (existing[0]?.revision_number ?? 0) + 1;

  const payload = {
    inscription_id: input.inscriptionId,
    order_id: input.orderId ?? null,
    revision_number: nextNumber,
    lines: input.lines,
    material_color: input.materialColor ?? null,
    lettering_color: input.letteringColor ?? null,
    shape: input.shape ?? null,
    status: 'draft' as const,
  };

  const { data, error } = await supabase
    // @ts-expect-error - proof_revisions not yet in generated Database types
    .from('proof_revisions')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as ProofRevision;
}

/**
 * Sends a revision to the customer. Reuses any existing public_token from a
 * prior revision on the same inscription so the customer's URL stays valid
 * across revisions; otherwise generates a fresh token. Supersedes any earlier
 * non-approved revisions and clears their tokens (so the unique constraint
 * holds).
 */
export async function sendRevision(revisionId: string): Promise<ProofRevision> {
  // Read current state.
  const { data: current, error: readErr } = await supabase
    // @ts-expect-error - proof_revisions not yet in generated Database types
    .from('proof_revisions')
    .select('*')
    .eq('id', revisionId)
    .single();
  if (readErr) throw readErr;
  const currentRow = current as ProofRevision;

  // Find a token from any other active revision on the same inscription so we
  // can inherit it (keeps the customer's link stable across revisions).
  let inheritedToken: string | null = null;
  if (!currentRow.public_token) {
    const { data: existing } = await supabase
      // @ts-expect-error - proof_revisions not yet in generated Database types
      .from('proof_revisions')
      .select('public_token')
      .eq('inscription_id', currentRow.inscription_id)
      .neq('id', revisionId)
      .not('public_token', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1);
    inheritedToken = (existing as Array<{ public_token: string }> | null)?.[0]?.public_token ?? null;
  }

  const token = currentRow.public_token ?? inheritedToken ?? generatePublicToken();

  // Supersede other open revisions on the same inscription AND clear their
  // tokens, so the unique constraint allows assignment below.
  await supabase
    // @ts-expect-error - proof_revisions not yet in generated Database types
    .from('proof_revisions')
    .update({ status: 'superseded', public_token: null })
    .eq('inscription_id', currentRow.inscription_id)
    .neq('id', revisionId)
    .in('status', ['draft', 'sent', 'changes_requested']);

  const { data, error } = await supabase
    // @ts-expect-error - proof_revisions not yet in generated Database types
    .from('proof_revisions')
    .update({
      status: 'sent',
      public_token: token,
      sent_at: new Date().toISOString(),
    })
    .eq('id', revisionId)
    .select()
    .single();
  if (error) throw error;
  return data as ProofRevision;
}

export async function updateRevision(
  id: string,
  updates: ProofRevisionUpdate,
): Promise<ProofRevision> {
  const { data, error } = await supabase
    // @ts-expect-error - proof_revisions not yet in generated Database types
    .from('proof_revisions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ProofRevision;
}

// ---------------------------------------------------------------------------
// Public RPCs (anon-callable)
// ---------------------------------------------------------------------------

export async function submitProofFeedback(
  token: string,
  feedback: string,
): Promise<ProofRevision> {
  const { data, error } = await supabase.rpc('submit_proof_feedback', {
    p_token: token,
    p_feedback: feedback,
  });
  if (error) throw error;
  return data as ProofRevision;
}

export async function approveProofByToken(
  token: string,
  approverName: string,
): Promise<ProofRevision> {
  const { data, error } = await supabase.rpc('approve_proof', {
    p_token: token,
    p_name: approverName,
  });
  if (error) throw error;
  return data as ProofRevision;
}
