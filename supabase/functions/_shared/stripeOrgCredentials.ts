/**
 * Per-org Stripe credentials (012-per-org-stripe).
 * Decrypt via get_stripe_secret_key / get_stripe_webhook_secret RPCs.
 * Required env: STRIPE_CREDENTIALS_ENCRYPTION_KEY
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import Stripe from 'npm:stripe@14.21.0';

export type StripeCredentialMode = 'test' | 'live';

export type OrganizationStripeConfigRow = {
  organization_id: string;
  live_payments_enabled: boolean;
  test_round_trip_passed_at: string | null;
  test_publishable_key: string | null;
  live_publishable_key: string | null;
};

export type OrgStripeCredentials = {
  organizationId: string;
  mode: StripeCredentialMode;
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  livePaymentsEnabled: boolean;
  testRoundTripPassedAt: string | null;
};

export function stripeCredentialsEncryptionKey(): string | null {
  return Deno.env.get('STRIPE_CREDENTIALS_ENCRYPTION_KEY')?.trim() || null;
}

export function serviceSupabase(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) {
    throw new Error('Supabase service configuration missing');
  }
  return createClient(url, key);
}

export async function getOrganizationStripeConfigRow(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationStripeConfigRow | null> {
  const { data, error } = await supabase
    .from('organization_stripe_config')
    .select(
      'organization_id, live_payments_enabled, test_round_trip_passed_at, test_publishable_key, live_publishable_key',
    )
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Stripe config: ${error.message}`);
  }
  return data as OrganizationStripeConfigRow | null;
}

async function decryptSecretKey(
  supabase: SupabaseClient,
  organizationId: string,
  mode: StripeCredentialMode,
  encryptionKey: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_stripe_secret_key', {
    p_organization_id: organizationId,
    p_mode: mode,
    p_encryption_key: encryptionKey,
  });
  if (error) {
    throw new Error(`Failed to decrypt Stripe secret key: ${error.message}`);
  }
  const key = typeof data === 'string' ? data.trim() : '';
  return key || null;
}

export async function decryptWebhookSecret(
  supabase: SupabaseClient,
  organizationId: string,
  mode: StripeCredentialMode,
  encryptionKey: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_stripe_webhook_secret', {
    p_organization_id: organizationId,
    p_mode: mode,
    p_encryption_key: encryptionKey,
  });
  if (error) {
    throw new Error(`Failed to decrypt Stripe webhook secret: ${error.message}`);
  }
  const secret = typeof data === 'string' ? data.trim() : '';
  return secret || null;
}

/** FR-001a (a): outbound API — test vs live from live_payments_enabled */
export function resolveOutboundCredentialMode(
  config: OrganizationStripeConfigRow,
): StripeCredentialMode {
  return config.live_payments_enabled ? 'live' : 'test';
}

export function assertKeyPrefixMatchesMode(secretKey: string, mode: StripeCredentialMode): void {
  const isTest = secretKey.startsWith('sk_test_');
  const isLive = secretKey.startsWith('sk_live_');
  if (mode === 'test' && !isTest) {
    throw new Error('mode_mismatch: expected test secret key');
  }
  if (mode === 'live' && !isLive) {
    throw new Error('mode_mismatch: expected live secret key');
  }
  if (!isTest && !isLive) {
    throw new Error('mode_mismatch: unrecognized Stripe secret key prefix');
  }
}

/** Decrypt and assemble credentials for an already-decided mode (no mode policy here). */
async function resolveStripeCredentials(
  supabase: SupabaseClient,
  organizationId: string,
  mode: StripeCredentialMode,
  row: OrganizationStripeConfigRow,
): Promise<OrgStripeCredentials> {
  const encryptionKey = stripeCredentialsEncryptionKey();
  if (!encryptionKey) {
    throw new Error('STRIPE_CREDENTIALS_ENCRYPTION_KEY is not configured');
  }

  const secretKey = await decryptSecretKey(supabase, organizationId, mode, encryptionKey);
  if (!secretKey) {
    throw new Error('payment_not_configured');
  }

  assertKeyPrefixMatchesMode(secretKey, mode);

  const publishableKey =
    mode === 'live'
      ? (row.live_publishable_key?.trim() ?? '')
      : (row.test_publishable_key?.trim() ?? '');

  const webhookSecret = await decryptWebhookSecret(supabase, organizationId, mode, encryptionKey);
  if (!webhookSecret) {
    throw new Error('payment_not_configured');
  }

  return {
    organizationId,
    mode,
    secretKey,
    publishableKey,
    webhookSecret,
    livePaymentsEnabled: row.live_payments_enabled,
    testRoundTripPassedAt: row.test_round_trip_passed_at,
  };
}

/**
 * Outbound charge initiation (checkout, invoicing, payment links).
 * Separate from reconciliation so live keys cannot be issued when live_payments_enabled
 * is false — the kill-switch must apply to all new charges.
 */
export async function resolveOutboundCredentials(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrgStripeCredentials> {
  const row = await getOrganizationStripeConfigRow(supabase, organizationId);
  if (!row) {
    throw new Error('payment_not_configured');
  }

  const mode = resolveOutboundCredentialMode(row);
  if (mode === 'live' && !row.live_payments_enabled) {
    throw new Error('live_disabled');
  }

  return resolveStripeCredentials(supabase, organizationId, mode, row);
}

/**
 * Webhook reconciliation of in-flight sessions (FR-001a rule c).
 * Separate from outbound so an invoice stamped with stripe_credential_mode at creation
 * can still reconcile in that mode after live is disabled — freeze-in-flight, not new charges.
 */
export async function resolveReconciliationCredentials(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceMode: StripeCredentialMode | null,
): Promise<OrgStripeCredentials> {
  const row = await getOrganizationStripeConfigRow(supabase, organizationId);
  if (!row) {
    throw new Error('payment_not_configured');
  }

  const mode = invoiceMode ?? resolveOutboundCredentialMode(row);
  return resolveStripeCredentials(supabase, organizationId, mode, row);
}

export async function createOutboundStripeClient(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ stripe: Stripe; credentials: OrgStripeCredentials }> {
  const credentials = await resolveOutboundCredentials(supabase, organizationId);
  const stripe = new Stripe(credentials.secretKey);
  return { stripe, credentials };
}

export async function createReconciliationStripeClient(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceMode: StripeCredentialMode | null,
): Promise<{ stripe: Stripe; credentials: OrgStripeCredentials }> {
  const credentials = await resolveReconciliationCredentials(
    supabase,
    organizationId,
    invoiceMode,
  );
  const stripe = new Stripe(credentials.secretKey);
  return { stripe, credentials };
}

/** FR-001a (b): verify webhook with test or live whsec based on event.livemode (dual try) */
export async function constructOrgStripeEvent(
  rawBody: string,
  signature: string,
  organizationId: string,
  supabase: SupabaseClient,
): Promise<{ event: Stripe.Event; verifiedMode: StripeCredentialMode }> {
  const encryptionKey = stripeCredentialsEncryptionKey();
  if (!encryptionKey) {
    throw new Error('STRIPE_CREDENTIALS_ENCRYPTION_KEY is not configured');
  }

  const row = await getOrganizationStripeConfigRow(supabase, organizationId);
  if (!row) {
    throw new Error('payment_not_configured');
  }

  const modes: StripeCredentialMode[] = ['test', 'live'];
  let lastError: unknown = null;

  for (const mode of modes) {
    const whsec = await decryptWebhookSecret(supabase, organizationId, mode, encryptionKey);
    if (!whsec) continue;
    try {
      const event = await Stripe.webhooks.constructEventAsync(rawBody, signature, whsec);
      const verifiedMode: StripeCredentialMode = event.livemode ? 'live' : 'test';
      return { event, verifiedMode };
    } catch (e) {
      lastError = e;
    }
  }

  const msg = lastError instanceof Error ? lastError.message : 'Invalid signature';
  throw new Error(msg);
}

export type PaymentPath = 'checkout' | 'hosted';

/** U1: hosted wins when both stripe_invoice_id and stripe_checkout_session_id present */
export function resolvePaymentPath(invoice: {
  stripe_invoice_id?: string | null;
  stripe_checkout_session_id?: string | null;
}): PaymentPath | null {
  const hasStripeInvoice = Boolean(invoice.stripe_invoice_id?.trim());
  const hasCheckoutSession = Boolean(invoice.stripe_checkout_session_id?.trim());
  if (hasStripeInvoice) return 'hosted';
  if (hasCheckoutSession) return 'checkout';
  return null;
}

export function logOrgMismatch(params: {
  urlOrganizationId: string;
  invoiceOrganizationId: string | null;
  eventId: string;
  eventType: string;
  masonInvoiceId?: string | null;
}): void {
  console.error(
    JSON.stringify({
      level: 'error',
      alert: 'stripe_webhook_org_mismatch',
      message:
        'Verified Stripe webhook but Mason invoice organization does not match URL organization_id — check per-org webhook URL in Stripe Dashboard',
      url_organization_id: params.urlOrganizationId,
      invoice_organization_id: params.invoiceOrganizationId,
      mason_invoice_id: params.masonInvoiceId ?? null,
      stripe_event_id: params.eventId,
      stripe_event_type: params.eventType,
    }),
  );
}

export async function assertInvoiceBelongsToUrlOrg(
  supabase: SupabaseClient,
  urlOrganizationId: string,
  masonInvoiceId: string,
  event: Stripe.Event,
): Promise<{ ok: true; organizationId: string } | { ok: false }> {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, organization_id')
    .eq('id', masonInvoiceId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false };
  }

  const invoiceOrg = data.organization_id as string | null;
  if (!invoiceOrg || invoiceOrg !== urlOrganizationId) {
    logOrgMismatch({
      urlOrganizationId,
      invoiceOrganizationId: invoiceOrg,
      eventId: event.id,
      eventType: event.type,
      masonInvoiceId,
    });
    return { ok: false };
  }

  return { ok: true, organizationId: invoiceOrg };
}

export async function recordTestRoundTripIfEligible(
  supabase: SupabaseClient,
  urlOrganizationId: string,
  eventLivemode: boolean,
): Promise<void> {
  if (eventLivemode) return;

  await supabase
    .from('organization_stripe_config')
    .update({
      test_round_trip_passed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', urlOrganizationId)
    .is('test_round_trip_passed_at', null);
}
