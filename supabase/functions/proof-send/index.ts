/**
 * proof-send — Send a draft proof to the customer via email and/or WhatsApp.
 *
 * Email: plain-text Gmail send with a signed link to the proof (same `messages/send`
 * + `raw` pattern as inbox-gmail-send). WhatsApp uses MediaUrl with the same signed URL.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';
import { getProofSignedUrl } from './proofUtils.ts';
import { resolveWhatsAppRouting } from './whatsappRoutingResolver.ts';
import { decryptSecret } from './whatsappCrypto.ts';
import { attemptAutoLink } from './autoLinkConversation.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

interface SendProofRequest {
  proof_id: string;
  channels: ('email' | 'whatsapp')[];
  customer_email?: string | null;
  customer_phone?: string | null;
  message_text?: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function logStep(step: string, detail?: Record<string, unknown>) {
  console.log(`proof-send: ${step}`, detail ?? {});
}

function logError(step: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(`proof-send: ${step}`, {
    error: error instanceof Error ? error.message : String(error),
    ...extra,
  });
}

// ── Gmail helpers ─────────────────────────────────────────────────────────────

/**
 * OAuth: refresh_token from gmail_connections + app client id/secret from env → access_token.
 */
async function getGmailAccessToken(
  supabase: SupabaseClient,
): Promise<{ accessToken: string; senderEmail: string }> {
  const { data, error } = await supabase
    .from('gmail_connections')
    .select('refresh_token, email_address')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data?.refresh_token) {
    throw new Error('No active Gmail connection found — reconnect Gmail in settings');
  }

  const clientId = Deno.env.get('GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');

  console.log('Gmail credentials check:', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRefreshToken: !!data.refresh_token,
    refreshTokenLength: data.refresh_token.length,
    refreshTokenPrefix: data.refresh_token.substring(0, 10),
    senderEmail: data.email_address,
  });

  if (!clientId || !clientSecret) {
    throw new Error('Gmail credentials not configured (GMAIL_CLIENT_ID/SECRET)');
  }

  const senderEmail = data.email_address?.trim() ?? '';
  if (!senderEmail) {
    throw new Error('No active Gmail connection found — reconnect Gmail in settings');
  }

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: data.refresh_token,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('Gmail OAuth error body:', errText);
    throw new Error(`Gmail OAuth failed: HTTP ${resp.status} — ${errText}`);
  }

  const tokenJson = await resp.json() as { access_token: string };
  return { accessToken: tokenJson.access_token, senderEmail };
}

/**
 * Plain-text RFC 2822 via Gmail messages/send (same pattern as inbox-gmail-send).
 * UTF-8 body encoded for `raw` base64url per Gmail.
 */
async function sendGmailPlainText(opts: {
  to: string;
  subject: string;
  bodyText: string;
  senderEmail: string;
  accessToken: string;
}): Promise<{ messageId: string; threadId: string }> {
  const rfc2822 = [
    'MIME-Version: 1.0',
    `From: ${opts.senderEmail}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    opts.bodyText,
  ].join('\r\n');

  const base64url = btoa(unescape(encodeURIComponent(rfc2822)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const sendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
  logStep('gmail plain text: sending via messages/send', { sendUrl });

  const gmailRes = await fetch(sendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64url }),
  });

  logStep('gmail plain text: response received', { status: gmailRes.status });

  if (!gmailRes.ok) {
    const errText = await gmailRes.text();
    console.error('Gmail error body:', errText);
    throw new Error(`Gmail send failed: HTTP ${gmailRes.status} — ${errText}`);
  }

  const gmailData = await gmailRes.json() as { id: string; threadId: string };
  logStep('gmail plain text: success', { messageId: gmailData.id, threadId: gmailData.threadId });
  return { messageId: gmailData.id, threadId: gmailData.threadId };
}

/** Base64-encode large binary without spread stack overflow (chunked). */
function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function sendGmailWithOptionalAttachment(opts: {
  to: string;
  subject: string;
  bodyText: string;
  senderEmail: string;
  accessToken: string;
  imageBytes: Uint8Array | null;
}): Promise<{ messageId: string; threadId: string }> {
  if (!opts.imageBytes) {
    logStep('gmail: sending link-only fallback', {});
    return sendGmailPlainText({
      to: opts.to,
      subject: opts.subject,
      bodyText: opts.bodyText,
      senderEmail: opts.senderEmail,
      accessToken: opts.accessToken,
    });
  }

  logStep('gmail: sending with attachment', { bytes: opts.imageBytes.byteLength });

  const imageBase64 = bytesToBase64(opts.imageBytes);
  const boundary = `mason_proof_${crypto.randomUUID().replace(/-/g, '')}`;

  const rfc2822 = [
    'MIME-Version: 1.0',
    `From: ${opts.senderEmail}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    opts.bodyText,
    '',
    `--${boundary}`,
    'Content-Type: image/png; name="proof.png"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="proof.png"',
    '',
    imageBase64,
    `--${boundary}--`,
  ].join('\r\n');

  const base64url = btoa(unescape(encodeURIComponent(rfc2822)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const sendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
  logStep('gmail attachment: sending via messages/send', { sendUrl });

  const gmailRes = await fetch(sendUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64url }),
  });

  logStep('gmail attachment: response received', { status: gmailRes.status });

  if (!gmailRes.ok) {
    const errText = await gmailRes.text();
    console.error('Gmail error body:', errText);
    throw new Error(`Gmail send failed: HTTP ${gmailRes.status} — ${errText}`);
  }

  const gmailData = await gmailRes.json() as { id: string; threadId: string };
  logStep('gmail attachment: success', { messageId: gmailData.id, threadId: gmailData.threadId });
  return { messageId: gmailData.id, threadId: gmailData.threadId };
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getUserFromRequest(req);
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: SendProofRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { proof_id, channels, customer_email, customer_phone, message_text } = body;

  if (!proof_id?.trim() || !channels?.length) {
    return jsonResponse({ error: 'proof_id and channels[] are required' }, 400);
  }
  if (channels.includes('email') && !customer_email?.trim()) {
    return jsonResponse({ error: 'customer_email is required for email channel' }, 400);
  }
  if (channels.includes('whatsapp') && !customer_phone?.trim()) {
    return jsonResponse({ error: 'customer_phone is required for whatsapp channel' }, 400);
  }

  // ── Supabase service-role client ──────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Server configuration error' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── Fetch proof — must be draft ───────────────────────────────────────────
  logStep('fetching proof', { proof_id });
  const { data: proof, error: proofErr } = await supabase
    .from('order_proofs')
    .select('id, order_id, user_id, state, render_url, inscription_text')
    .eq('id', proof_id)
    .eq('user_id', user.id)
    .single();

  if (proofErr || !proof) {
    logError('proof not found', proofErr, { proof_id });
    return jsonResponse({ error: 'Proof not found' }, 404);
  }
  if (proof.state !== 'draft') {
    return jsonResponse(
      { error: 'Proof must be in draft state to send', current_state: proof.state },
      409,
    );
  }
  if (!proof.render_url) {
    return jsonResponse({ error: 'Proof has no render URL — regenerate before sending' }, 400);
  }

  // ── Signed URL (TTL 72h — email link + WhatsApp MediaUrl) ──
  logStep('generating signed URL', { render_url: proof.render_url, ttlSeconds: 259200 });
  let signedUrl: string;
  try {
    signedUrl = await getProofSignedUrl(supabase, proof.render_url, 259200);
    logStep('signed URL ready', {});
  } catch (err) {
    logError('signed URL generation failed', err);
    return jsonResponse(
      { error: `Could not create proof link: ${err instanceof Error ? err.message : String(err)}` },
      500,
    );
  }

  let imageBytes: Uint8Array | null = null;
  if (channels.includes('email') && customer_email?.trim()) {
    try {
      const imgResp = await fetch(signedUrl);
      const fetchedBytes = new Uint8Array(await imgResp.arrayBuffer());

      if (fetchedBytes.byteLength > 20 * 1024 * 1024) {
        logStep('image too large for attachment, sending link only', { bytes: fetchedBytes.byteLength });
        imageBytes = null;
      } else {
        imageBytes = fetchedBytes;
      }
    } catch (err) {
      logError('proof image fetch failed (attachment fallback)', err);
      imageBytes = null;
    }
  }

  const bodyText =
    message_text?.trim() ||
    [
      'Please review your memorial proof by clicking the link below:',
      '',
      signedUrl,
      '',
      'To approve: reply to this email with the word APPROVED.',
      'To request changes: reply with details of what you would like changed.',
      '',
      'This link will expire in 72 hours.',
    ].join('\n');

  const emailBodyText = message_text?.trim()
    ? [
        message_text.trim(),
        '',
        'View online: ' + signedUrl,
        '',
        'To approve: reply APPROVED.',
        'To request changes: reply with details.',
        '',
        'Link expires in 72 hours.',
      ].join('\n')
    : [
        'Please review your memorial proof (also attached below).',
        '',
        'View online: ' + signedUrl,
        '',
        'To approve: reply APPROVED.',
        'To request changes: reply with details.',
        '',
        'Link expires in 72 hours.',
      ].join('\n');

  const createdConversationIds: string[] = [];
  const now = new Date().toISOString();

  // ── EMAIL channel ─────────────────────────────────────────────────────────
  if (channels.includes('email') && customer_email?.trim()) {
    logStep('sending via email', { to: customer_email });
    try {
      const { accessToken, senderEmail } = await getGmailAccessToken(supabase);

      const { messageId, threadId } = await sendGmailWithOptionalAttachment({
        to: customer_email.trim(),
        subject: 'Your Memorial Proof - Please Review',
        bodyText: emailBodyText,
        senderEmail,
        accessToken,
        imageBytes,
      });

      logStep('gmail send succeeded', { messageId, threadId });

      // Create inbox_conversations row
      const { data: conv, error: convErr } = await supabase
        .from('inbox_conversations')
        .insert({
          channel: 'email',
          primary_handle: customer_email.trim(),
          user_id: user.id,
          subject: 'Your Memorial Proof - Please Review',
          status: 'open',
          unread_count: 0,
          link_state: 'unlinked',
          link_meta: { proof_id, type: 'proof_send' },
          last_message_at: now,
          last_message_preview: emailBodyText.substring(0, 120),
        })
        .select('id')
        .single();

      if (convErr || !conv) {
        logError('failed to create email conversation', convErr);
      } else {
        createdConversationIds.push(conv.id);

        // Create inbox_messages row
        await supabase.from('inbox_messages').insert({
          conversation_id: conv.id,
          channel: 'email',
          direction: 'outbound',
          from_handle: senderEmail,
          to_handle: customer_email.trim(),
          body_text: emailBodyText,
          sent_at: now,
          status: 'sent',
          user_id: user.id,
          meta: { proof_id, gmail: { messageId, threadId } },
        });

        // Attempt auto-link to customer
        await attemptAutoLink(supabase, conv.id, 'email', customer_email.trim()).catch((e) =>
          logError('auto-link failed (non-fatal)', e, { conversation_id: conv.id }),
        );
      }
    } catch (err) {
      logError('email send failed', err);
      return jsonResponse({
        error: `Email send failed: ${err instanceof Error ? err.message : String(err)}`,
        channel: 'email',
      }, 500);
    }
  }

  // ── WHATSAPP channel ──────────────────────────────────────────────────────
  if (channels.includes('whatsapp') && customer_phone?.trim()) {
    logStep('sending via whatsapp', { to: customer_phone });
    try {
      const resolved = await resolveWhatsAppRouting(supabase, user.id);
      if (!resolved.ok) {
        return jsonResponse({
          error: resolved.error,
          status_reason_message: resolved.status_reason_message,
          channel: 'whatsapp',
        }, 409);
      }

      // ── Resolve Twilio credentials (same pattern as inbox-twilio-send) ────
      let accountSid: string;
      let apiKeySid: string;
      let apiKeySecret: string;
      let fromNumber: string;

      if (resolved.mode === 'managed') {
        accountSid = resolved.managedConnection.twilio_account_sid ?? '';
        apiKeySid = Deno.env.get('TWILIO_MANAGED_API_KEY_SID') ?? '';
        apiKeySecret = Deno.env.get('TWILIO_MANAGED_API_KEY_SECRET') ?? '';
        const fromRaw = resolved.managedConnection.whatsapp_from_address ?? '';
        fromNumber = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`;
        if (!accountSid || !apiKeySid || !apiKeySecret || !fromRaw) {
          return jsonResponse({ error: 'managed_whatsapp_credentials_missing', channel: 'whatsapp' }, 409);
        }
      } else {
        accountSid = resolved.manualConnection.twilio_account_sid;
        apiKeySid = resolved.manualConnection.twilio_api_key_sid;
        apiKeySecret = await decryptSecret(resolved.manualConnection.twilio_api_key_secret_encrypted);
        const fromRaw = resolved.manualConnection.whatsapp_from;
        fromNumber = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`;
      }

      const toPhone = customer_phone.trim();
      const toNumber = toPhone.startsWith('whatsapp:') ? toPhone : `whatsapp:${toPhone}`;

      // ── Call Twilio Messages API with MediaUrl (image delivery) ───────────
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const twilioBody = new URLSearchParams({
        From: fromNumber,
        To: toNumber,
        Body: bodyText,
        'MediaUrl[0]': signedUrl,
      });

      const twilioResp = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${apiKeySid}:${apiKeySecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: twilioBody.toString(),
      });

      if (!twilioResp.ok) {
        const errText = await twilioResp.text();
        throw new Error(`Twilio HTTP ${twilioResp.status}: ${errText}`);
      }

      const twilioData = await twilioResp.json().catch(() => ({})) as { sid?: string };
      logStep('twilio send succeeded', { sid: twilioData.sid });

      // Create inbox_conversations row
      const { data: conv, error: convErr } = await supabase
        .from('inbox_conversations')
        .insert({
          channel: 'whatsapp',
          primary_handle: toPhone,
          user_id: user.id,
          status: 'open',
          unread_count: 0,
          link_state: 'unlinked',
          link_meta: { proof_id, type: 'proof_send' },
          last_message_at: now,
          last_message_preview: bodyText.substring(0, 120),
        })
        .select('id')
        .single();

      if (convErr || !conv) {
        logError('failed to create whatsapp conversation', convErr);
      } else {
        createdConversationIds.push(conv.id);

        await supabase.from('inbox_messages').insert({
          conversation_id: conv.id,
          channel: 'whatsapp',
          direction: 'outbound',
          from_handle: fromNumber.replace('whatsapp:', ''),
          to_handle: toPhone,
          body_text: bodyText,
          sent_at: now,
          status: 'sent',
          user_id: user.id,
          meta: { proof_id, twilio: { sid: twilioData.sid ?? null } },
        });

        await attemptAutoLink(supabase, conv.id, 'whatsapp', toPhone).catch((e) =>
          logError('auto-link failed (non-fatal)', e, { conversation_id: conv.id }),
        );
      }
    } catch (err) {
      logError('whatsapp send failed', err);
      return jsonResponse({
        error: `WhatsApp send failed: ${err instanceof Error ? err.message : String(err)}`,
        channel: 'whatsapp',
      }, 500);
    }
  }

  // ── Update proof to sent ──────────────────────────────────────────────────
  const sentVia =
    channels.includes('email') && channels.includes('whatsapp')
      ? 'both'
      : channels.includes('email')
        ? 'email'
        : 'whatsapp';

  const firstConvId = createdConversationIds[0] ?? null;

  const { error: updateErr } = await supabase
    .from('order_proofs')
    .update({
      state: 'sent',
      sent_via: sentVia,
      sent_at: now,
      inbox_conversation_id: firstConvId,
      updated_at: now,
    })
    .eq('id', proof_id);

  if (updateErr) {
    logError('failed to update proof to sent', updateErr, { proof_id });
    return jsonResponse({ error: 'Proof sent but failed to update record — refresh the page.' }, 500);
  }

  logStep('proof updated to sent', { proof_id, sent_via: sentVia });

  return jsonResponse({
    ok: true,
    proof_id,
    state: 'sent',
    sent_via: sentVia,
    inbox_conversation_ids: createdConversationIds,
  });
});
