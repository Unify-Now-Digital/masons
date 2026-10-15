/**
 * Server-side Revolut Business calls. Pure JWT, signature, and matching live beside this file.
 * Tokens stay in revolut_connections and are read only with the service role.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { getUserFromRequest } from './auth.ts';
import { buildRevolutPaymentInsert, revolutResyncPatch, type RevolutPaymentInsert } from './revolut/buildPayment.ts';
import {
  refreshTokenExpiresAt,
  revolutHosts,
  revolutJwtIssuer,
  revolutSandboxEnabled,
  type RevolutHosts,
} from './revolut/hosts.ts';
import { buildRevolutClientAssertion } from './revolut/jwt.ts';
import type { RevolutMatchOrder } from './revolut/match.ts';
import { incomingLeg, type RevolutTransaction } from './revolut/transaction.ts';
import { timingSafeEqual } from './revolut/webhookSignature.ts';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version, x-region, x-revolut-cron-secret',
};

export function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export interface RevolutEnv {
  clientId: string;
  privateKey: string;
  redirectUrl: string;
  webhookUrl: string;
  appUrl: string;
  issuer: string;
  hosts: RevolutHosts;
}

export function readRevolutEnv(): RevolutEnv | { error: string } {
  const clientId = (Deno.env.get('REVOLUT_CLIENT_ID') ?? '').trim();
  const privateKey = Deno.env.get('REVOLUT_PRIVATE_KEY') ?? '';
  const redirectUrl = (Deno.env.get('REVOLUT_OAUTH_REDIRECT_URL') ?? '').trim();
  const webhookUrl = (Deno.env.get('REVOLUT_WEBHOOK_URL') ?? '').trim();
  const appUrl = (Deno.env.get('APP_URL') ?? '').trim().replace(/\/$/, '');
  if (!clientId || !privateKey.trim() || !redirectUrl || !webhookUrl || !appUrl) {
    return { error: 'server_config' };
  }
  let issuer = '';
  try {
    issuer = revolutJwtIssuer(redirectUrl, Deno.env.get('REVOLUT_JWT_ISSUER'));
  } catch {
    return { error: 'server_config' };
  }
  return {
    clientId,
    privateKey,
    redirectUrl,
    webhookUrl,
    appUrl,
    issuer,
    hosts: revolutHosts(revolutSandboxEnabled(Deno.env.get('REVOLUT_SANDBOX'))),
  };
}

export function isRevolutEnv(value: RevolutEnv | { error: string }): value is RevolutEnv {
  return !('error' in value);
}

export function adminClient(): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function appRedirect(appUrl: string, params: Record<string, string>): Response {
  const url = new URL(`${appUrl}/dashboard/settings`);
  url.searchParams.set('tab', 'integrations');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return Response.redirect(url.toString(), 302);
}

export async function requester(req: Request) {
  return getUserFromRequest(req);
}

/** Unattended sync and token refresh. The gateway still requires a JWT when verify_jwt is on. */
export function isUnattended(req: Request): boolean {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (token && service && timingSafeEqual(token, service)) return true;
  const cron = req.headers.get('x-revolut-cron-secret') ?? '';
  const expected = Deno.env.get('REVOLUT_CRON_SECRET') ?? '';
  return !!cron && !!expected && timingSafeEqual(cron, expected);
}

export async function isFinanceMember(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error || !data) return false;
  return data.role === 'admin' || data.role === 'member';
}

export function newOauthState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function consentUrl(env: RevolutEnv, state: string): string {
  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUrl,
    response_type: 'code',
    scope: 'READ,WRITE', // WRITE is required to register webhooks (POST /api/2.0/webhooks)
    state,
  });
  return `${env.hosts.consent}/app-confirm?${params.toString()}`;
}

interface TokenBody {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

async function postToken(
  api: string,
  body: URLSearchParams,
): Promise<{ ok: true; data: TokenBody } | { ok: false; status: number }> {
  const res = await fetch(`${api}/api/1.0/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    console.error('revolut token endpoint', res.status);
    return { ok: false, status: res.status };
  }
  const data = await res.json() as TokenBody;
  if (!data.access_token) return { ok: false, status: 502 };
  return { ok: true, data };
}

export async function exchangeAuthCode(env: RevolutEnv, code: string) {
  const assertion = await buildRevolutClientAssertion({
    privateKeyPem: env.privateKey,
    clientId: env.clientId,
    issuer: env.issuer,
  });
  return postToken(env.hosts.api, new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
  }));
}

export interface ConnectionRow {
  id: string;
  organization_id: string;
  user_id: string;
  client_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  webhook_id: string | null;
  webhook_signing_secret: string | null;
  status: string;
  environment: string | null;
  last_synced_at?: string | null;
}

function hostsFor(environment: string | null, fallback: RevolutHosts): RevolutHosts {
  if (environment === 'sandbox') return revolutHosts(true);
  if (environment === 'production') return revolutHosts(false);
  return fallback;
}

export async function refreshConnectionToken(
  supabase: SupabaseClient,
  env: RevolutEnv,
  connection: ConnectionRow,
): Promise<{ ok: true; accessToken: string } | { ok: false; status: number; code: string }> {
  if (!connection.refresh_token) return { ok: false, status: 401, code: 'refresh_missing' };
  if (connection.refresh_token_expires_at && Date.parse(connection.refresh_token_expires_at) <= Date.now()) {
    await supabase.from('revolut_connections').update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id);
    return { ok: false, status: 401, code: 'refresh_expired' };
  }
  const hosts = hostsFor(connection.environment, env.hosts);
  let assertion: string;
  try {
    assertion = await buildRevolutClientAssertion({
      privateKeyPem: env.privateKey,
      clientId: connection.client_id || env.clientId,
      issuer: env.issuer,
    });
  } catch (err) {
    console.error('revolut jwt', err instanceof Error ? err.message : 'sign_failed');
    return { ok: false, status: 500, code: 'jwt_sign_failed' };
  }
  const token = await postToken(hosts.api, new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: connection.refresh_token,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
  }));
  if (!token.ok) {
    if (token.status === 400 || token.status === 401) {
      await supabase.from('revolut_connections').update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      }).eq('id', connection.id);
    }
    return { ok: false, status: token.status, code: 'refresh_failed' };
  }
  const now = Date.now();
  const patch: Record<string, string> = {
    access_token: token.data.access_token!,
    token_expires_at: new Date(now + (token.data.expires_in ?? 2399) * 1000).toISOString(),
    status: 'active',
    updated_at: new Date(now).toISOString(),
  };
  if (token.data.refresh_token) {
    patch.refresh_token = token.data.refresh_token;
    patch.refresh_token_expires_at = refreshTokenExpiresAt(now, token.data.refresh_token_expires_in);
  }
  const { error } = await supabase.from('revolut_connections').update(patch).eq('id', connection.id);
  if (error) return { ok: false, status: 500, code: 'db_error' };
  return { ok: true, accessToken: token.data.access_token! };
}

export async function accessTokenFor(
  supabase: SupabaseClient,
  env: RevolutEnv,
  connection: ConnectionRow,
): Promise<{ ok: true; accessToken: string; api: string } | { ok: false; status: number; code: string }> {
  const api = hostsFor(connection.environment, env.hosts).api;
  const expires = connection.token_expires_at ? Date.parse(connection.token_expires_at) : 0;
  if (connection.access_token && expires > Date.now() + 5 * 60 * 1000) {
    return { ok: true, accessToken: connection.access_token, api };
  }
  const refreshed = await refreshConnectionToken(supabase, env, connection);
  if (!refreshed.ok) return refreshed;
  return { ok: true, accessToken: refreshed.accessToken, api };
}

async function authed(api: string, token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${api}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
}

export async function ensureWebhook(
  api: string,
  token: string,
  url: string,
  existingId: string | null,
): Promise<{ id: string | null; signingSecret: string | null }> {
  const drop = async (id: string) => {
    await authed(api, token, `/api/2.0/webhooks/${id}`, { method: 'DELETE' });
  };
  if (existingId) await drop(existingId);
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await authed(api, token, '/api/2.0/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url, events: ['TransactionCreated', 'TransactionStateChanged'] }),
    });
    if (res.ok) {
      const data = await res.json() as { id?: string; signing_secret?: string };
      return { id: data.id ?? null, signingSecret: data.signing_secret ?? null };
    }
    console.error('revolut webhook create', res.status);
    if (attempt === 1) break;
    const list = await authed(api, token, '/api/2.0/webhooks');
    if (!list.ok) break;
    const hooks = await list.json() as Array<{ id?: string; url?: string }>;
    const same = (Array.isArray(hooks) ? hooks : []).find((hook) => hook.url === url && hook.id);
    if (!same?.id) break;
    await drop(same.id);
  }
  return { id: null, signingSecret: null };
}

export async function deleteWebhook(api: string, token: string, webhookId: string | null): Promise<void> {
  if (!webhookId) return;
  const res = await authed(api, token, `/api/2.0/webhooks/${webhookId}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) console.error('revolut webhook delete', res.status);
}

export async function loadOpenOrders(supabase: SupabaseClient, organizationId: string): Promise<RevolutMatchOrder[]> {
  const full = await supabase
    .from('orders_with_balance')
    .select('id, order_number, person_name, customer_name, balance_due')
    .eq('organization_id', organizationId)
    .gt('balance_due', 0.01);
  const rows = full.error
    ? (await supabase
      .from('orders_with_balance')
      .select('id, order_number, customer_name, balance_due')
      .eq('organization_id', organizationId)
      .gt('balance_due', 0.01)).data
    : full.data;
  return (rows ?? []).map((row: {
    id: string;
    order_number: number | string | null;
    person_name?: string | null;
    customer_name?: string | null;
    balance_due?: number | string | null;
  }) => ({
    id: row.id,
    orderNumber: row.order_number == null ? null : Number(row.order_number),
    payerName: row.person_name ?? null,
    deceasedName: row.customer_name ?? null,
    balanceDue: Number(row.balance_due ?? 0),
  }));
}

async function gbpAccountId(api: string, token: string): Promise<string | null> {
  const res = await authed(api, token, '/api/1.0/accounts');
  if (!res.ok) return null;
  const accounts = await res.json() as Array<{ id?: string; currency?: string; state?: string }>;
  const gbp = (Array.isArray(accounts) ? accounts : []).filter((account) =>
    account.currency === 'GBP' && account.state === 'active' && account.id
  );
  return gbp.length === 1 ? gbp[0].id! : null;
}

export async function listTransactions(api: string, token: string, fromIso: string): Promise<RevolutTransaction[]> {
  const account = await gbpAccountId(api, token);
  const all: RevolutTransaction[] = [];
  let to: string | undefined;
  for (let page = 0; page < 50; page++) {
    const params = new URLSearchParams({ from: fromIso, count: '1000' });
    if (to) params.set('to', to);
    if (account) params.set('account', account);
    const res = await authed(api, token, `/api/1.0/transactions?${params.toString()}`);
    if (!res.ok) throw new Error(`transactions_${res.status}`);
    const batch = await res.json() as RevolutTransaction[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 1000) break;
    const nextTo = batch[batch.length - 1]?.created_at;
    if (!nextTo || nextTo === to) break;
    to = nextTo;
  }
  return all;
}

async function counterpartyName(
  api: string,
  token: string,
  txn: RevolutTransaction,
  cache: Map<string, string | null>,
): Promise<string | null> {
  const id = incomingLeg(txn)?.counterpartyId;
  if (!id) return null;
  if (cache.has(id)) return cache.get(id) ?? null;
  const res = await authed(api, token, `/api/1.0/counterparty/${id}`);
  if (!res.ok) {
    cache.set(id, null);
    return null;
  }
  const body = await res.json() as { name?: string };
  const name = body.name?.trim() || null;
  cache.set(id, name);
  return name;
}

export async function fetchTransaction(api: string, token: string, id: string): Promise<RevolutTransaction | null> {
  const res = await authed(api, token, `/api/1.0/transaction/${id}`);
  if (!res.ok) {
    console.error('revolut transaction fetch', res.status);
    return null;
  }
  return await res.json() as RevolutTransaction;
}

export async function applyRevolutTransaction(
  supabase: SupabaseClient,
  args: {
    organizationId: string;
    userId: string | null;
    txn: RevolutTransaction;
    orders: RevolutMatchOrder[];
    counterpartyName: string | null;
  },
): Promise<'inserted' | 'updated' | 'skipped'> {
  const row = buildRevolutPaymentInsert({
    organizationId: args.organizationId,
    userId: args.userId,
    txn: args.txn,
    orders: args.orders,
    counterpartyName: args.counterpartyName,
  });
  if (!row) return 'skipped';
  const { data: existing, error } = await supabase
    .from('order_payments')
    .select('id, status, matched_by, organization_id')
    .eq('external_id', row.external_id)
    .maybeSingle();
  if (error) throw error;
  if (existing?.organization_id && existing.organization_id !== row.organization_id) {
    console.error('revolut transaction belongs to another organisation');
    return 'skipped';
  }
  if (!existing) {
    const { error: insertErr } = await supabase.from('order_payments').insert(row);
    if (insertErr?.code === '23505') return 'updated';
    if (insertErr) throw insertErr;
    return 'inserted';
  }
  const patch = revolutResyncPatch(existing, row);
  if (!patch) return 'skipped';
  const { error: updateErr } = await supabase
    .from('order_payments')
    .update(patch)
    .eq('id', existing.id);
  if (updateErr) throw updateErr;
  return 'updated';
}

export async function syncConnection(
  supabase: SupabaseClient,
  env: RevolutEnv,
  connection: ConnectionRow,
): Promise<{ inserted: number; updated: number }> {
  const access = await accessTokenFor(supabase, env, connection);
  if (!access.ok) throw new Error(access.code);
  const fromMs = connection.last_synced_at
    ? Date.parse(connection.last_synced_at) - 2 * 24 * 60 * 60 * 1000
    : Date.now() - 90 * 24 * 60 * 60 * 1000;
  const transactions = await listTransactions(access.api, access.accessToken, new Date(fromMs).toISOString());
  const orders = await loadOpenOrders(supabase, connection.organization_id);
  const names = new Map<string, string | null>();
  let inserted = 0;
  let updated = 0;
  for (const txn of transactions) {
    const name = await counterpartyName(access.api, access.accessToken, txn, names);
    const result = await applyRevolutTransaction(supabase, {
      organizationId: connection.organization_id,
      userId: connection.user_id,
      txn,
      orders,
      counterpartyName: name,
    });
    if (result === 'inserted') inserted++;
    else if (result === 'updated') updated++;
  }
  await supabase.from('revolut_connections').update({
    last_synced_at: new Date().toISOString(),
    last_sync_error: null,
    updated_at: new Date().toISOString(),
  }).eq('id', connection.id);
  return { inserted, updated };
}

export async function loadActiveConnection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ConnectionRow | null> {
  const { data, error } = await supabase
    .from('revolut_connections')
    .select('id, organization_id, user_id, client_id, access_token, refresh_token, token_expires_at, refresh_token_expires_at, webhook_id, webhook_signing_secret, status, environment, last_synced_at')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw error;
  return (data as ConnectionRow | null) ?? null;
}

export async function loadActiveConnections(supabase: SupabaseClient): Promise<ConnectionRow[]> {
  const { data, error } = await supabase
    .from('revolut_connections')
    .select('id, organization_id, user_id, client_id, access_token, refresh_token, token_expires_at, refresh_token_expires_at, webhook_id, webhook_signing_secret, status, environment, last_synced_at')
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []) as ConnectionRow[];
}

export type { RevolutPaymentInsert };
