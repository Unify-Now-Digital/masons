import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import {
  createReconciliationStripeClient,
  type StripeCredentialMode,
} from '../_shared/stripeOrgCredentials.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-admin-token',
};

interface DeleteInvoiceRequest {
  invoice_id: string;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    // Auth via admin token, consistent with other Stripe functions
    const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('X-Admin-Token');
    const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');
    if (!expectedToken || !adminToken || adminToken !== expectedToken) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let body: DeleteInvoiceRequest;
    try {
      body = (await req.json()) as DeleteInvoiceRequest;
    } catch {
      return jsonResponse({ error: 'Invalid JSON or missing body' }, 400);
    }

    const invoiceId = body?.invoice_id?.trim();
    if (!invoiceId) {
      return jsonResponse({ error: 'invoice_id is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load invoice with Stripe metadata (org + stamped mode drive the best-effort void)
    const { data: invoice, error: invError } = await supabase
      .from('invoices')
      .select('id, organization_id, stripe_credential_mode, stripe_invoice_id, stripe_invoice_status, stripe_checkout_session_id, deleted_at')
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice) {
      return jsonResponse({ error: 'Invoice not found' }, 404);
    }

    // If already soft-deleted, treat as success (idempotent)
    if ((invoice as { deleted_at?: string | null }).deleted_at) {
      return jsonResponse({ success: true }, 200);
    }

    // --- Best-effort void of the Stripe invoice, in its stamped mode. The soft-delete below is
    //     the real operation and must NEVER be blocked by Stripe. We only attempt the void when
    //     we can safely target the right account (org + stamped mode both known); otherwise we
    //     log and proceed, leaving the Stripe invoice to be voided manually (or after backfill). ---
    if (invoice.stripe_invoice_id) {
      const orgId = (invoice.organization_id ?? '').toString().trim();
      const stampedMode = invoice.stripe_credential_mode as StripeCredentialMode | null;

      if (orgId && stampedMode) {
        try {
          const { stripe } = await createReconciliationStripeClient(supabase, orgId, stampedMode);
          const si = await stripe.invoices.retrieve(invoice.stripe_invoice_id);
          if (si.status === 'draft' || si.status === 'open') {
            await stripe.invoices.voidInvoice(si.id);
          }

          // Kill any open Checkout Session — a previously generated partial-payment link must
          // not stay payable against the deleted invoice (same pattern as stripe-void-invoice
          // :176-220). Best-effort like the void: log-only, never blocks the soft-delete.
          // Runs regardless of the invoice's Stripe status (covers manually-voided invoices).
          const sessionId = (invoice.stripe_checkout_session_id ?? '').toString().trim();
          if (sessionId) {
            try {
              await stripe.checkout.sessions.expire(sessionId);
            } catch (expireErr) {
              // Expire only works on open sessions — inspect the real state before reporting.
              try {
                const session = await stripe.checkout.sessions.retrieve(sessionId);
                if (session.status === 'complete') {
                  console.error('Checkout session already completed for deleted invoice — reconcile manually', {
                    invoiceId: invoice.id,
                    sessionId,
                  });
                } else if (session.status !== 'expired') {
                  console.error('Could not expire checkout session before delete', {
                    invoiceId: invoice.id,
                    sessionId,
                    status: session.status,
                    expireErr,
                  });
                }
              } catch (retrieveErr) {
                console.error('Could not expire or inspect checkout session before delete', {
                  invoiceId: invoice.id,
                  sessionId,
                  expireErr,
                  retrieveErr,
                });
              }
            }
          }

          // Belt-and-braces: expire ANY other open session still pointing at this invoice
          // (metadata.mason_invoice_id) — covers sessions orphaned before the expire-before-
          // overwrite guard existed in stripe-create-invoice-payment-link. Log-only; skipped
          // when the invoice has no Stripe customer.
          const stripeCustomerId =
            typeof si.customer === 'string' ? si.customer : si.customer?.id ?? null;
          if (stripeCustomerId) {
            const openSessions = await stripe.checkout.sessions.list({
              customer: stripeCustomerId,
              status: 'open',
              limit: 100,
            });
            for (const s of openSessions.data) {
              if (s.metadata?.mason_invoice_id === invoice.id && s.id !== sessionId) {
                try {
                  await stripe.checkout.sessions.expire(s.id);
                } catch (expireErr) {
                  console.error('Could not expire orphaned checkout session before delete', {
                    invoiceId: invoice.id,
                    orphanSessionId: s.id,
                    expireErr,
                  });
                }
              }
            }
          }
        } catch (err) {
          // Resolution or Stripe error — do not block local delete.
          console.error('Failed to void Stripe invoice before delete; proceeding with soft-delete', err);
        }
      } else {
        // Legacy/unknown account: cannot safely void. Proceed, but make the orphan risk visible.
        console.error(
          'Cannot void Stripe invoice before delete (missing org or stamped mode); soft-deleting anyway — Stripe invoice may remain OPEN and payable, void it manually',
          {
            invoiceId: invoice.id,
            stripeInvoiceId: invoice.stripe_invoice_id,
            stripeInvoiceStatus: invoice.stripe_invoice_status ?? null,
            hasOrg: Boolean(orgId),
            hasStampedMode: Boolean(stampedMode),
          },
        );
      }
    }

    // Soft delete invoice row (do not remove related orders or payments)
    const { error: delErr } = await supabase
      .from('invoices')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id);

    if (delErr) {
      console.error('Failed to delete invoice', delErr);
      return jsonResponse({ error: 'Failed to delete invoice' }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (e) {
    console.error('invoices-delete unexpected error', e);
    return jsonResponse({ error: 'Unexpected error' }, 500);
  }
});