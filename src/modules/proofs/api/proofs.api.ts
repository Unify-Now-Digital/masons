import { supabase } from '@/shared/lib/supabase';
import type {
  OrderProof,
  ProofGenerateRequest,
  ProofGenerateResponse,
  ProofSendRequest,
  ProofSendResponse,
} from '../types/proofs.types';

// ---------------------------------------------------------------------------
// Direct Supabase queries (RLS-gated, no secrets)
// ---------------------------------------------------------------------------

/**
 * Fetch the latest proof for a given order.
 * Returns null when no proof exists yet.
 */
export async function fetchProofByOrder(orderId: string): Promise<OrderProof | null> {
  const { data, error } = await supabase
    .from('order_proofs')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as OrderProof | null;
}

/**
 * Approve a sent proof.
 * Uses a DB-level state guard (.eq('state', 'sent')) so this is a no-op if the
 * proof state changed concurrently; throws an error in that case so the UI can
 * surface it.
 */
export async function approveProof(proofId: string): Promise<OrderProof> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('order_proofs')
    .update({
      state: 'approved',
      approved_at: now,
      approved_by: 'staff_manual',
      updated_at: now,
    })
    .eq('id', proofId)
    .eq('state', 'sent')
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      'Proof could not be approved — it may no longer be in the "sent" state. Refresh and try again.',
    );
  }

  return data as OrderProof;
}

/**
 * Record a customer change request on a sent proof.
 * Uses a DB-level state guard (.eq('state', 'sent')).
 */
export async function requestProofChanges(
  proofId: string,
  changesNote: string,
): Promise<OrderProof> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('order_proofs')
    .update({
      state: 'changes_requested',
      changes_requested_at: now,
      changes_note: changesNote.trim(),
      updated_at: now,
    })
    .eq('id', proofId)
    .eq('state', 'sent')
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    throw new Error(
      'Could not record change request — proof may no longer be in the "sent" state. Refresh and try again.',
    );
  }

  return data as OrderProof;
}

/**
 * Fetch the latest proof for each of multiple orders in a single query.
 * Returns an array of proofs ordered by created_at DESC.
 * The caller should deduplicate by order_id (first occurrence per order = latest).
 *
 * This resolves the N+1 query issue when displaying proof status in list views.
 */
export async function fetchProofsByOrders(orderIds: string[]): Promise<OrderProof[]> {
  if (!orderIds.length) return [];

  const { data, error } = await supabase
    .from('order_proofs')
    .select('*')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as OrderProof[];
}

// ---------------------------------------------------------------------------
// Edge Function calls (privileged operations — API keys held server-side)
// ---------------------------------------------------------------------------

/**
 * Trigger AI proof generation via the proof-generate Edge Function.
 * Creates or resets the proof row and calls OpenAI images.edit server-side.
 */
export async function generateProof(
  params: ProofGenerateRequest,
): Promise<ProofGenerateResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in to generate a proof');

  const { data, error } = await supabase.functions.invoke<ProofGenerateResponse>(
    'proof-generate',
    {
      body: params,
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
  );

  if (error) {
    const msg =
      typeof (error as { message?: string }).message === 'string'
        ? (error as { message: string }).message
        : 'Failed to generate proof';
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.proof_id) throw new Error('Invalid response from proof-generate');

  return data;
}

/**
 * Send a proof to the customer via the proof-send Edge Function.
 * Handles Gmail (multipart MIME) and Twilio (MediaUrl) delivery server-side.
 */
export async function sendProof(params: ProofSendRequest): Promise<ProofSendResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You must be signed in to send a proof');

  const { data, error } = await supabase.functions.invoke<ProofSendResponse>('proof-send', {
    body: params,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    const msg =
      typeof (error as { message?: string }).message === 'string'
        ? (error as { message: string }).message
        : 'Failed to send proof';
    throw new Error(msg);
  }
  if (data?.proof_id === undefined) throw new Error('Invalid response from proof-send');

  return data;
}
