import { getUserFromRequest } from '../_shared/auth.ts';
import {
  assertKeyPrefixMatchesMode,
  getOrganizationStripeConfigRow,
  serviceSupabase,
  type StripeCredentialMode,
} from '../_shared/stripeOrgCredentials.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseAdminEmails(): string[] {
  const raw = Deno.env.get('ADMIN_EMAILS') ?? '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  return parseAdminEmails().includes(email.trim().toLowerCase());
}

type Action = 'upsert_credentials' | 'enable_live' | 'disable_live';

interface RequestBody {
  organization_id?: string;
  action?: Action;
  test_secret_key?: string;
  test_publishable_key?: string;
  test_webhook_secret?: string;
  live_secret_key?: string;
  live_publishable_key?: string;
  live_webhook_secret?: string;
}

function validatePublishableKey(key: string, mode: StripeCredentialMode): void {
  if (mode === 'test' && !key.startsWith('pk_test_')) {
    throw new Error('mode_mismatch: expected pk_test_ publishable key');
  }
  if (mode === 'live' && !key.startsWith('pk_live_')) {
    throw new Error('mode_mismatch: expected pk_live_ publishable key');
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  const encryptionKey = Deno.env.get('STRIPE_CREDENTIALS_ENCRYPTION_KEY')?.trim();
  if (!encryptionKey) {
    console.error('STRIPE_CREDENTIALS_ENCRYPTION_KEY not set');
    return json({ error: 'Server configuration error' }, 500);
  }

  const user = await getUserFromRequest(req);
  if (!user?.email || !isAdminEmail(user.email)) {
    return json({ error: 'Forbidden' }, 403);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const organizationId = body.organization_id?.trim();
  const action = body.action;
  if (!organizationId || !action) {
    return json({ error: 'organization_id and action are required' }, 400);
  }

  const supabase = serviceSupabase();

  const { data: orgRow, error: orgErr } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .maybeSingle();

  if (orgErr) {
    console.error('organization lookup failed', orgErr);
    return json({ error: 'Failed to verify organization' }, 500);
  }
  if (!orgRow) {
    return json({ error: 'Organization not found' }, 404);
  }

  if (action === 'upsert_credentials') {
    const testSecret = body.test_secret_key?.trim();
    const testPublishable = body.test_publishable_key?.trim();
    const testWebhook = body.test_webhook_secret?.trim();
    if (!testSecret || !testPublishable || !testWebhook) {
      return json({ error: 'test_secret_key, test_publishable_key, and test_webhook_secret are required' }, 400);
    }

    try {
      assertKeyPrefixMatchesMode(testSecret, 'test');
      validatePublishableKey(testPublishable, 'test');
      if (!testWebhook.startsWith('whsec_')) {
        return json({ error: 'mode_mismatch: invalid test webhook secret' }, 400);
      }

      const liveSecret = body.live_secret_key?.trim() || null;
      const livePublishable = body.live_publishable_key?.trim() || null;
      const liveWebhook = body.live_webhook_secret?.trim() || null;

      if (liveSecret) {
        assertKeyPrefixMatchesMode(liveSecret, 'live');
      }
      if (livePublishable) {
        validatePublishableKey(livePublishable, 'live');
      }
      if (liveWebhook && !liveWebhook.startsWith('whsec_')) {
        return json({ error: 'mode_mismatch: invalid live webhook secret' }, 400);
      }

      const { error: rpcErr } = await supabase.rpc('upsert_organization_stripe_credentials', {
        p_organization_id: organizationId,
        p_encryption_key: encryptionKey,
        p_test_secret_key: testSecret,
        p_test_publishable_key: testPublishable,
        p_test_webhook_secret: testWebhook,
        p_live_secret_key: liveSecret,
        p_live_publishable_key: livePublishable,
        p_live_webhook_secret: liveWebhook,
      });

      if (rpcErr) {
        console.error('upsert_organization_stripe_credentials failed', rpcErr);
        return json({ error: 'Failed to store credentials' }, 500);
      }

      const row = await getOrganizationStripeConfigRow(supabase, organizationId);
      return json({
        ok: true,
        organization_id: organizationId,
        live_payments_enabled: row?.live_payments_enabled ?? false,
        test_round_trip_passed_at: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Validation failed';
      if (msg.includes('mode_mismatch')) {
        return json({ error: 'mode_mismatch', detail: msg }, 400);
      }
      return json({ error: msg }, 400);
    }
  }

  if (action === 'enable_live') {
    const row = await getOrganizationStripeConfigRow(supabase, organizationId);
    if (!row) {
      return json({ error: 'payment_not_configured' }, 400);
    }
    if (!row.test_round_trip_passed_at) {
      return json({ error: 'test_round_trip_required' }, 400);
    }

    const { data: fullRow } = await supabase
      .from('organization_stripe_config')
      .select('live_publishable_key')
      .eq('organization_id', organizationId)
      .single();

    if (!fullRow?.live_publishable_key?.trim()) {
      return json({ error: 'live credentials incomplete' }, 400);
    }

    const { error: updateErr } = await supabase
      .from('organization_stripe_config')
      .update({
        live_payments_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId);

    if (updateErr) {
      console.error('enable_live failed', updateErr);
      return json({ error: 'Failed to enable live payments' }, 500);
    }

    return json({ ok: true, organization_id: organizationId, live_payments_enabled: true });
  }

  if (action === 'disable_live') {
    const { error: updateErr } = await supabase
      .from('organization_stripe_config')
      .update({
        live_payments_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId);

    if (updateErr) {
      console.error('disable_live failed', updateErr);
      return json({ error: 'Failed to disable live payments' }, 500);
    }

    return json({ ok: true, organization_id: organizationId, live_payments_enabled: false });
  }

  return json({ error: 'Unknown action' }, 400);
});
