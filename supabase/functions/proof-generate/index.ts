import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';
import { getProofSignedUrl } from './proofUtils.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

interface GenerateProofRequest {
  order_id: string;
  inscription_text: string;
  stone_photo_url?: string | null;
  font_style?: string | null;
  additional_instructions?: string | null;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function logStep(step: string, detail?: Record<string, unknown>) {
  console.log(`proof-generate: ${step}`, detail ?? {});
}

function logError(step: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(`proof-generate: ${step}`, {
    error: error instanceof Error ? error.message : String(error),
    ...extra,
  });
}

/**
 * Build a prompt for the OpenAI image generation/edit call.
 */
function buildPrompt(
  inscriptionText: string,
  fontStyle: string | null | undefined,
  additionalInstructions: string | null | undefined,
): string {
  const style = fontStyle ? `Font style: ${fontStyle}.` : '';
  const extra = additionalInstructions ? `Additional notes: ${additionalInstructions}.` : '';
  return [
    'Render the following inscription as realistic stone engraving on this memorial stone.',
    `Text: "${inscriptionText}".`,
    style,
    'Photorealistic. The engraving should look as if physically carved into the stone surface.',
    'No borders, no overlays, no watermarks.',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getUserFromRequest(req);
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: GenerateProofRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { order_id, inscription_text, stone_photo_url, font_style, additional_instructions } = body;

  if (!order_id?.trim() || !inscription_text?.trim()) {
    return jsonResponse({ error: 'order_id and inscription_text are required' }, 400);
  }

  // ── Supabase service-role client ──────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── Verify order belongs to user ──────────────────────────────────────────
  logStep('verifying order ownership', { order_id, user_id: user.id });
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, product_photo_url')
    .eq('id', order_id)
    // Orders don't have a user_id column — they are shared across the authenticated tenant.
    // Assumption: all authenticated users in the tenant can generate proofs for any order.
    // If per-user order ownership is added later, add .eq('user_id', user.id) here.
    .single();

  if (orderErr || !order) {
    logError('order not found', orderErr, { order_id });
    return jsonResponse({ error: 'Order not found' }, 404);
  }

  // ── Reject if an approved proof already exists ────────────────────────────
  const { data: existingApproved } = await supabase
    .from('order_proofs')
    .select('id')
    .eq('order_id', order_id)
    .eq('state', 'approved')
    .limit(1)
    .maybeSingle();

  if (existingApproved) {
    return jsonResponse({ error: 'order_already_has_approved_proof' }, 409);
  }

  // ── Use order's product_photo_url as fallback stone photo ─────────────────
  const effectivePhotoUrl =
    (stone_photo_url?.trim() ?? '') !== '' ? stone_photo_url! : (order.product_photo_url ?? null);

  // ── Insert proof row (state = generating) ─────────────────────────────────
  logStep('inserting proof row', { order_id, user_id: user.id });
  const { data: proof, error: insertErr } = await supabase
    .from('order_proofs')
    .insert({
      order_id,
      user_id: user.id,
      inscription_text: inscription_text.trim(),
      stone_photo_url: effectivePhotoUrl ?? '',
      font_style: font_style?.trim() || null,
      additional_instructions: additional_instructions?.trim() || null,
      state: 'generating',
      render_method: 'ai_image',
      render_provider: 'openai',
    })
    .select('id')
    .single();

  if (insertErr || !proof) {
    logError('failed to insert proof row', insertErr);
    return jsonResponse({ error: 'Failed to create proof record' }, 500);
  }

  const proofId = proof.id;
  logStep('proof row created', { proof_id: proofId, state: 'generating' });

  // ── Helper: mark proof failed and return 500 ──────────────────────────────
  async function failProof(errorMsg: string, rawMeta?: unknown): Promise<Response> {
    logError('marking proof failed', errorMsg, { proof_id: proofId });
    await supabase
      .from('order_proofs')
      .update({
        state: 'failed',
        last_error: errorMsg,
        render_meta: rawMeta ? { error: rawMeta } : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proofId);
    return jsonResponse({ error: errorMsg, proof_id: proofId, state: 'failed' }, 500);
  }

  // ── OpenAI API call ───────────────────────────────────────────────────────
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return failProof('OPENAI_API_KEY is not configured');
  }

  const prompt = buildPrompt(inscription_text, font_style, additional_instructions);
  logStep('calling OpenAI', { has_photo: !!effectivePhotoUrl, prompt_length: prompt.length });

  let imageBase64: string;
  let rawOpenAiResponse: unknown;

  try {
    if (effectivePhotoUrl) {
      // ── images/edits: send the stone photo as the source image ────────────
      const photoResponse = await fetch(effectivePhotoUrl);
      if (!photoResponse.ok) {
        return failProof(`Failed to download stone photo: HTTP ${photoResponse.status}`);
      }
      const photoBlob = await photoResponse.blob();
      const photoFilename = 'stone.png';

      const formData = new FormData();
      formData.append('model', 'gpt-image-1');
      formData.append('image', new File([photoBlob], photoFilename, { type: 'image/png' }));
      formData.append('prompt', prompt);
      formData.append('n', '1');
      formData.append('size', '1024x1024');

      const openaiResp = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: formData,
      });

      rawOpenAiResponse = await openaiResp.json().catch(() => ({}));

      if (!openaiResp.ok) {
        logError('OpenAI images/edits error', rawOpenAiResponse, { status: openaiResp.status });
        return failProof(
          `OpenAI returned ${openaiResp.status}: ${(rawOpenAiResponse as { error?: { message?: string } })?.error?.message ?? 'Unknown error'}`,
          rawOpenAiResponse,
        );
      }
    } else {
      // ── images/generations: no source photo — generate from prompt alone ──
      const genResp = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt,
          n: 1,
          size: '1024x1024',
          response_format: 'b64_json',
        }),
      });

      rawOpenAiResponse = await genResp.json().catch(() => ({}));

      if (!genResp.ok) {
        logError('OpenAI images/generations error', rawOpenAiResponse, { status: genResp.status });
        return failProof(
          `OpenAI returned ${genResp.status}: ${(rawOpenAiResponse as { error?: { message?: string } })?.error?.message ?? 'Unknown error'}`,
          rawOpenAiResponse,
        );
      }
    }

    // Extract base64 image from response
    const respData = rawOpenAiResponse as { data?: Array<{ b64_json?: string; url?: string }> };
    const firstItem = respData?.data?.[0];

    if (firstItem?.b64_json) {
      imageBase64 = firstItem.b64_json;
    } else if (firstItem?.url) {
      // URL response — download and re-encode as base64
      const imgResp = await fetch(firstItem.url);
      if (!imgResp.ok) return failProof('Failed to download generated image from OpenAI');
      const imgBytes = await imgResp.arrayBuffer();
      imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imgBytes)));
    } else {
      return failProof('OpenAI response contained no image data', rawOpenAiResponse);
    }
  } catch (err) {
    return failProof(`OpenAI call threw: ${err instanceof Error ? err.message : String(err)}`);
  }

  logStep('OpenAI call succeeded', { proof_id: proofId });

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  const storagePath = `${user.id}/${order_id}/${proofId}.png`;
  logStep('uploading to storage', { path: storagePath });

  try {
    const imageBytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const { error: uploadErr } = await supabase.storage
      .from('proof-renders')
      .upload(storagePath, imageBytes, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadErr) {
      logError('storage upload failed', uploadErr, { path: storagePath });
      return failProof(`Storage upload failed: ${uploadErr.message}`, uploadErr);
    }
  } catch (err) {
    return failProof(`Storage upload threw: ${err instanceof Error ? err.message : String(err)}`);
  }

  logStep('upload complete', { path: storagePath });

  // ── Update proof row to draft ──────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('order_proofs')
    .update({
      state: 'draft',
      render_url: storagePath,
      render_meta: rawOpenAiResponse as Record<string, unknown>,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', proofId);

  if (updateErr) {
    logError('failed to update proof row to draft', updateErr, { proof_id: proofId });
    return failProof(`Failed to update proof record: ${updateErr.message}`);
  }

  logStep('proof row updated to draft', { proof_id: proofId });

  // ── Generate signed URL for immediate display ──────────────────────────────
  let signedUrl: string | null = null;
  try {
    signedUrl = await getProofSignedUrl(supabase, storagePath);
  } catch (err) {
    logError('signed URL generation failed (non-fatal)', err, { path: storagePath });
  }

  return jsonResponse({
    proof_id: proofId,
    state: 'draft',
    render_url: signedUrl ?? storagePath,
  });
});
