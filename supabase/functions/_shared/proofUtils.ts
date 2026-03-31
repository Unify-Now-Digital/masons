/**
 * Proof Agent shared utilities.
 * Used by proof-generate and proof-send edge functions.
 */

/**
 * Generate a signed URL for a proof render stored in the proof-renders bucket.
 *
 * @param supabase - Service-role Supabase client (from createClient with serviceRoleKey)
 * @param storagePath - Path stored in order_proofs.render_url, e.g. "{user_id}/{order_id}/{proof_id}.png"
 * @param expiresIn - TTL in seconds (default: 3600 = 1 hour)
 * @returns The signed URL string
 * @throws On storage API error
 */
export async function getProofSignedUrl(
  supabase: any,
  storagePath: string,
  expiresIn = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('proof-renders')
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to generate signed URL for proof render: ${error?.message ?? 'no signed URL returned'}`,
    );
  }

  return data.signedUrl;
}
