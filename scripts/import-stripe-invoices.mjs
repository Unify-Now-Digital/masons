#!/usr/bin/env node
// One-off import of Stripe invoices that have no Mason `invoices` row (created outside Mason).
// DRY RUN BY DEFAULT — prints what it would create/link; writes nothing unless --apply.
//
// Run (needs Node 22+):
//   node --experimental-strip-types scripts/import-stripe-invoices.mjs --org <organization_id> [--days 90] [--apply]
//     env: STRIPE_SECRET_KEY (the org's own Stripe account!), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   Offline dry run from JSON snapshots (no keys, never writes):
//   node --experimental-strip-types scripts/import-stripe-invoices.mjs --org <id> \
//     --stripe-json stripe_invoices.json --mason-json mason_snapshot.json
//     mason_snapshot.json = { invoices:[{id,stripe_invoice_id}], orders:[{id,order_number,person_id,job_id,customer_email,customer_name,archived_at}], people:[{id,email}] }
//
// --apply requires migration 20261015150000_invoices_stripe_link_status.sql to be applied first.
// Same matching rules as stripe-webhook/ensureStripeInvoice.ts.
import fs from 'node:fs';
import { matchStripeInvoice, masonStatusFromStripe, normaliseEmail } from '../supabase/functions/_shared/stripeInvoiceMatch.ts';

const args = process.argv.slice(2);
const arg = (k, d = null) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const has = (k) => args.includes(k);
const org = arg('--org');
const days = Number(arg('--days', '90'));
const stripeJson = arg('--stripe-json');
const masonJson = arg('--mason-json');
const offline = Boolean(stripeJson || masonJson);
const apply = has('--apply') && !offline;
if (!org) {
  console.error('--org <organization_id> is required');
  process.exit(1);
}
const since = Math.floor(Date.now() / 1000) - days * 86400;

async function stripeInvoices() {
  if (stripeJson) {
    const raw = JSON.parse(fs.readFileSync(stripeJson, 'utf8'));
    return (Array.isArray(raw) ? raw : raw.data).filter((i) => i.created >= since);
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  const out = [];
  let after = null;
  for (;;) {
    const q = new URLSearchParams({ limit: '100', 'created[gte]': String(since) });
    if (after) q.set('starting_after', after);
    const r = await fetch(`https://api.stripe.com/v1/invoices?${q}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`Stripe ${r.status}`);
    const j = await r.json();
    out.push(...j.data);
    if (!j.has_more) break;
    after = j.data[j.data.length - 1].id;
  }
  return out;
}

const sbUrl = process.env.SUPABASE_URL;
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
async function sb(path, init = {}) {
  const r = await fetch(`${sbUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status} ${await r.text()}`);
  return r.json();
}

async function masonSnapshot() {
  if (masonJson) return JSON.parse(fs.readFileSync(masonJson, 'utf8'));
  if (!sbUrl || !sbKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  const o = `organization_id=eq.${org}`;
  return {
    invoices: await sb(`invoices?select=id,stripe_invoice_id&${o}&stripe_invoice_id=not.is.null`),
    orders: await sb(`orders?select=id,order_number,person_id,job_id,customer_email,customer_name,archived_at&${o}`),
    people: await sb(`people?select=id,email&${o}`),
  };
}

const [invoices, snap] = await Promise.all([stripeInvoices(), masonSnapshot()]);
const known = new Set(snap.invoices.map((i) => i.stripe_invoice_id));
const masonIds = new Set(snap.invoices.map((i) => i.id));
const pick = (o) => ({ id: o.id, person_id: o.person_id, job_id: o.job_id, customer_name: o.customer_name });
const lookups = {
  invoiceExists: async (id) => masonIds.has(id),
  orderByNumber: async (n) => {
    const o = snap.orders.find((x) => Number(x.order_number) === n);
    return o ? pick(o) : null;
  },
  openOrdersByEmail: async (email) => {
    const pids = new Set(snap.people.filter((p) => normaliseEmail(p.email) === email).map((p) => p.id));
    return snap.orders
      .filter((o) => !o.archived_at && (pids.has(o.person_id) || normaliseEmail(o.customer_email) === email))
      .map(pick);
  },
};

const counts = { stripe_total: invoices.length, already_in_mason: 0, mason_originated: 0, draft: 0, would_create_auto: 0, would_create_unmatched: 0, created: 0 };
const rows = [];
for (const inv of invoices) {
  if (known.has(inv.id)) { counts.already_in_mason++; continue; }
  const md = inv.metadata ?? {};
  if (md.mason_invoice_id || md.invoice_id || md.organization_id) { counts.mason_originated++; continue; }
  if (inv.status === 'draft') { counts.draft++; continue; }
  const m = await matchStripeInvoice(inv, lookups);
  const order = m.kind === 'order' ? m.order : null;
  counts[order ? 'would_create_auto' : 'would_create_unmatched']++;
  const ord = order ? snap.orders.find((o) => o.id === order.id) : null;
  rows.push({ stripe: inv.id, number: inv.number, status: inv.status, total: (inv.total ?? 0) / 100, paid: (inv.amount_paid ?? 0) / 100, email: inv.customer_email, order: ord ? `ORD-${String(ord.order_number).padStart(6, '0')}` : null, reason: m.reason });
  if (apply) {
    const created = new Date(inv.created * 1000);
    const paid = (inv.amount_paid ?? 0) > 0;
    const status = masonStatusFromStripe(inv);
    await sb('invoices', {
      method: 'POST',
      body: JSON.stringify({
        organization_id: org,
        order_id: order?.id ?? null, person_id: order?.person_id ?? null, job_id: order?.job_id ?? null,
        invoice_number: inv.number ?? `STRIPE-${inv.id}`,
        customer_name: inv.customer_name || inv.customer_email || 'Unknown (Stripe)',
        amount: (inv.total ?? 0) / 100, status,
        due_date: new Date((inv.due_date ?? inv.created) * 1000).toISOString().slice(0, 10),
        issue_date: created.toISOString().slice(0, 10),
        payment_method: 'Credit Card', stripe_status: status === 'paid' ? 'paid' : 'unpaid',
        paid_at: paid && inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : null,
        stripe_invoice_id: inv.id, stripe_invoice_status: inv.status, hosted_invoice_url: inv.hosted_invoice_url ?? null,
        amount_paid: inv.amount_paid ?? 0, amount_remaining: inv.amount_remaining ?? 0,
        is_test: !inv.livemode, stripe_credential_mode: inv.livemode ? 'live' : 'test', currency: 'gbp',
        stripe_customer_id: typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null,
        stripe_link_status: order ? 'auto' : 'unmatched', stripe_link_reason: m.reason,
        notes: 'Created in Stripe (outside Mason); imported by scripts/import-stripe-invoices.mjs',
      }),
    });
    counts.created++;
  }
}
console.log(apply ? 'APPLY' : 'DRY RUN (no writes)', `org=${org} days=${days}`);
console.table(rows);
console.log(JSON.stringify(counts, null, 2));
