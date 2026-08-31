/**
 * Revise invoice flow (Option 1): create a new Mason invoice carrying the same orders, then
 * void the old Stripe invoice. Ordered so failures are non-destructive — the old invoice must
 * stay intact and payable unless the whole revise succeeds:
 *   1. Fail-fast reads: load + org guard, resolve Stripe creds, retrieve the old Stripe
 *      invoice's status (paid → 409; unreachable → 502; nothing mutated yet).
 *   2. Insert the new Mason invoice (insert failure → 500; nothing else has been mutated).
 *   3. Void the old Stripe invoice; if the void fails, delete the just-inserted new invoice
 *      and return 502 — never leave a payable old invoice alongside a revision. The Mason row
 *      is stamped 'void' only when the Stripe side is confirmed dead (just voided, or was
 *      already void/uncollectible).
 *   4. Reassign orders (failure → warning in response; manually recoverable).
 * Client should then call stripe-create-invoice for the new invoice to create the Stripe invoice.
 */
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

interface ReviseInvoiceRequest {
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
    const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('X-Admin-Token');
    const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');
    if (!expectedToken || !adminToken || adminToken !== expectedToken) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let body: ReviseInvoiceRequest;
    try {
      body = (await req.json()) as ReviseInvoiceRequest;
    } catch {
      return jsonResponse({ error: 'Invalid JSON or missing body' }, 400);
    }

    const oldInvoiceId = body?.invoice_id?.trim();
    if (!oldInvoiceId) {
      return jsonResponse({ error: 'invoice_id is required' }, 400);
    }

    // No global STRIPE_SECRET_KEY — credentials resolve per-org from the old invoice's stamped mode.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: oldInv, error: oldErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, amount, due_date, issue_date, user_id, organization_id, stripe_credential_mode, stripe_invoice_id, stripe_checkout_session_id')
      .eq('id', oldInvoiceId)
      .single();

    if (oldErr || !oldInv) {
      return jsonResponse({ error: 'Invoice not found' }, 404);
    }

    // --- The revised invoice MUST carry the org forward, else stripe-create-invoice 422s on it.
    //     Require the source invoice to have an org. ---
    const rawOrgId = oldInv.organization_id;
    if (!rawOrgId || typeof rawOrgId !== 'string' || !rawOrgId.trim()) {
      console.error('Source invoice has no organization_id; cannot revise', oldInv.id);
      return jsonResponse({ error: 'Invoice is not associated with an organization' }, 422);
    }
    const orgId = rawOrgId.trim();

    // --- PHASE 1 — fail-fast Stripe reads (no writes yet): we must know the old invoice's
    //     status before mutating anything. ---
    let stripe: Awaited<ReturnType<typeof createReconciliationStripeClient>>['stripe'] | null = null;
    let oldStripeStatus: string | null = null;
    let oldStripeCustomerId: string | null = null;

    if (oldInv.stripe_invoice_id) {
      const stampedMode = oldInv.stripe_credential_mode as StripeCredentialMode | null;
      if (!stampedMode) {
        // Legacy: we can't safely target the right account to void. Proceeding would leave the
        // old invoice OPEN and payable alongside the revision — a double-pay seam. Refuse;
        // staff must void the old Stripe invoice manually (or backfill the mode) first.
        console.error('Old Stripe invoice has no stamped mode; refusing revise', {
          oldInvoiceId,
          stripeInvoiceId: oldInv.stripe_invoice_id,
        });
        return jsonResponse({
          error: 'Old Stripe invoice predates per-org config; void it manually before revising',
        }, 409);
      }

      try {
        ({ stripe } = await createReconciliationStripeClient(supabase, orgId, stampedMode));
      } catch (resolveErr) {
        const reason = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
        console.error('Failed to resolve Stripe credentials for void', { orgId, oldInvoiceId, stampedMode, reason });
        return jsonResponse({ error: 'Payment processing is not available for this organization' }, 503);
      }

      try {
        const existing = await stripe.invoices.retrieve(oldInv.stripe_invoice_id);
        oldStripeStatus = existing.status ?? null;
        oldStripeCustomerId =
          typeof existing.customer === 'string'
            ? existing.customer
            : existing.customer?.id ?? null;
      } catch (retrieveErr) {
        console.error('Could not retrieve old Stripe invoice status', {
          oldInvoiceId,
          stripeInvoiceId: oldInv.stripe_invoice_id,
          retrieveErr,
        });
        return jsonResponse({ error: 'Could not verify the old Stripe invoice status' }, 502);
      }

      if (oldStripeStatus === 'paid') {
        return jsonResponse({
          error: 'Invoice is already paid — revise does not apply. Create a new invoice instead.',
        }, 409);
      }
    }

    // --- PHASE 2 — create the new Mason invoice. Nothing else has been mutated yet, so a
    //     failure here leaves the old invoice exactly as it was. ---

    // Next invoice number
    let newInvoiceNumber: string;
    const { data: rpcNum } = await supabase.rpc('get_next_invoice_number');
    if (rpcNum && typeof rpcNum === 'string') {
      newInvoiceNumber = rpcNum;
    } else {
      const { data: maxRow } = await supabase
        .from('invoices')
        .select('invoice_number')
        .order('invoice_number', { ascending: false })
        .limit(1)
        .single();
      const match = maxRow?.invoice_number?.match(/\d+/);
      const nextNum = match ? parseInt(match[0], 10) + 1 : 1001;
      newInvoiceNumber = `INV-${String(nextNum).padStart(6, '0')}`;
    }

    const revisedNote = `Revised from ${oldInv.invoice_number}; previous payments on prior invoice.`;

    const { data: newInv, error: insertErr } = await supabase
      .from('invoices')
      .insert({
        invoice_number: newInvoiceNumber,
        customer_name: oldInv.customer_name,
        amount: oldInv.amount,
        due_date: oldInv.due_date,
        issue_date: new Date().toISOString().slice(0, 10),
        status: 'pending',
        organization_id: orgId, // carry org forward so the new invoice can get a Stripe invoice
        revised_from_invoice_id: oldInvoiceId,
        notes: revisedNote,
        user_id: oldInv.user_id ?? null,
      })
      .select('id, invoice_number')
      .single();

    if (insertErr || !newInv) {
      console.error('Failed to create new invoice', insertErr);
      return jsonResponse({ error: 'Failed to create revised invoice' }, 500);
    }

    const warnings: string[] = [];

    // --- PHASE 3 — void the old Stripe invoice. If the void fails, delete the just-inserted
    //     new invoice (created moments ago, no payments; revised_from linkage dies with it) so
    //     the old invoice is never left payable alongside a revision. ---
    if (oldInv.stripe_invoice_id && stripe) {
      let stripeSideDead = false;
      if (oldStripeStatus === 'open' || oldStripeStatus === 'draft') {
        try {
          await stripe.invoices.voidInvoice(oldInv.stripe_invoice_id);
          stripeSideDead = true;
        } catch (voidErr) {
          console.error('Could not void old Stripe invoice; rolling back new invoice', {
            oldInvoiceId,
            stripeInvoiceId: oldInv.stripe_invoice_id,
            newInvoiceId: newInv.id,
            voidErr,
          });
          await supabase.from('invoices').delete().eq('id', newInv.id);
          return jsonResponse({
            error: 'Could not void the old Stripe invoice — nothing was changed. Please retry.',
          }, 502);
        }
      } else if (oldStripeStatus === 'void' || oldStripeStatus === 'uncollectible') {
        // Nothing to void on Stripe — already dead.
        stripeSideDead = true;
      } else {
        // Unexpected status (paid was rejected in phase 1) — don't claim the Stripe side is
        // void when it isn't. The revise still completes; recoverable manually, like phase 4.
        console.error('Old Stripe invoice in unexpected state; not voided', {
          oldInvoiceId,
          stripeInvoiceId: oldInv.stripe_invoice_id,
          oldStripeStatus,
        });
        warnings.push(`old Stripe invoice in unexpected state ${oldStripeStatus}; not voided`);
      }

      // Stamp Mason 'void' only when the Stripe side is confirmed dead.
      if (stripeSideDead) {
        const { error: statusErr } = await supabase
          .from('invoices')
          .update({
            stripe_invoice_status: 'void',
            updated_at: new Date().toISOString(),
          })
          .eq('id', oldInvoiceId);
        if (statusErr) {
          // Stripe-side is correct; Mason status self-heals via stripe-fetch-invoice sync.
          console.error('Failed to update old invoice stripe_invoice_status', {
            oldInvoiceId,
            statusErr,
          });
          warnings.push('old invoice status update failed');
        }

        // Kill any open Checkout Session — a previously generated partial-payment link must
        // not stay payable against the voided old invoice (same pattern as stripe-void-invoice
        // :176-220). Non-fatal throughout: the revise already succeeded, so failures here
        // become warnings, never a failed response.
        const sessionId = (oldInv.stripe_checkout_session_id ?? '').toString().trim();
        if (sessionId) {
          try {
            await stripe.checkout.sessions.expire(sessionId);
          } catch (expireErr) {
            // Expire only works on open sessions — inspect the real state before deciding
            // what to report.
            try {
              const session = await stripe.checkout.sessions.retrieve(sessionId);
              if (session.status === 'complete') {
                console.error('Checkout session already completed for voided old invoice', {
                  oldInvoiceId,
                  sessionId,
                });
                warnings.push(
                  'a completed checkout payment may exist against the old invoice — reconcile manually',
                );
              } else if (session.status === 'expired') {
                // Already dead — the goal state.
              } else {
                console.error('Could not expire checkout session', {
                  oldInvoiceId,
                  sessionId,
                  status: session.status,
                  expireErr,
                });
                warnings.push(
                  `could not expire checkout session (status ${session.status ?? 'unknown'}) — check it manually in Stripe`,
                );
              }
            } catch (retrieveErr) {
              console.error('Could not expire or inspect checkout session', {
                oldInvoiceId,
                sessionId,
                expireErr,
                retrieveErr,
              });
              warnings.push('could not expire the old checkout session — check it manually in Stripe');
            }
          }
        }

        // Belt-and-braces: expire ANY other open session still pointing at the old invoice
        // (metadata.mason_invoice_id) — covers sessions orphaned before the expire-before-
        // overwrite guard existed in stripe-create-invoice-payment-link. Non-fatal; skipped
        // when the old invoice has no Stripe customer.
        if (oldStripeCustomerId) {
          try {
            const openSessions = await stripe.checkout.sessions.list({
              customer: oldStripeCustomerId,
              status: 'open',
              limit: 100,
            });
            for (const s of openSessions.data) {
              if (s.metadata?.mason_invoice_id === oldInvoiceId && s.id !== sessionId) {
                try {
                  await stripe.checkout.sessions.expire(s.id);
                } catch (expireErr) {
                  console.error('Could not expire orphaned checkout session', {
                    oldInvoiceId,
                    orphanSessionId: s.id,
                    expireErr,
                  });
                  warnings.push('could not expire an orphaned checkout session — check Stripe manually');
                }
              }
            }
          } catch (listErr) {
            console.error('Could not list checkout sessions for orphan sweep', {
              oldInvoiceId,
              oldStripeCustomerId,
              listErr,
            });
            warnings.push('could not sweep for orphaned checkout sessions — check Stripe manually');
          }
        }
      }
    }

    // --- PHASE 4 — reassign orders from old invoice to new invoice. The revise itself is
    //     complete; a failure here is manually recoverable, so warn instead of rolling back. ---
    const { error: ordersErr } = await supabase
      .from('orders')
      .update({ invoice_id: newInv.id, updated_at: new Date().toISOString() })
      .eq('invoice_id', oldInvoiceId);
    if (ordersErr) {
      console.error('Failed to reassign orders to revised invoice', {
        oldInvoiceId,
        newInvoiceId: newInv.id,
        ordersErr,
      });
      warnings.push('order reassignment failed — reassign manually');
    }

    return jsonResponse({
      new_invoice_id: newInv.id,
      new_invoice_number: newInv.invoice_number,
      revised_from_invoice_id: oldInvoiceId,
      ...(warnings.length > 0 ? { warning: warnings.join('; ') } : {}),
    });
  } catch (e) {
    console.error('stripe-revise-invoice error', e);
    return jsonResponse({ error: 'Unexpected error' }, 500);
  }
});
