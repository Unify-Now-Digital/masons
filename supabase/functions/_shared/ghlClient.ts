/**
 * GHL Edge client — multi-org (010-ghl-multi-org).
 * Per-org PIT from ghl_connections.ghl_api_key via get_ghl_api_key RPC.
 *
 * Deprecated (not read): GHL_API_KEY, GHL_LOCATION_ID env vars.
 * Required: GHL_API_KEY_ENCRYPTION_KEY — passed to decrypt RPC.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { isUserInOrganization } from './organizationMembership.ts';

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

export type GhlConnectionRow = {
  id: string;
  organization_id: string;
  ghl_location_id: string;
  status: string;
  outbound_enabled: boolean;
};

export type ActiveGhlConnection = {
  connection: GhlConnectionRow;
  apiKey: string;
};

export function ghlEncryptionKey(): string | null {
  return Deno.env.get('GHL_API_KEY_ENCRYPTION_KEY')?.trim() || null;
}

export async function ghlFetch(
  path: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!apiKey?.trim()) {
    throw new Error('GHL API key not configured for this organization');
  }
  const url = path.startsWith('http') ? path : `${GHL_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${apiKey.trim()}`);
  headers.set('Version', GHL_VERSION);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...init, headers });
}

export async function requireOrgMember(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  return isUserInOrganization(supabase, userId, organizationId);
}

export async function getActiveGhlConnection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<GhlConnectionRow | null> {
  const { data, error } = await supabase
    .from('ghl_connections')
    .select('id, organization_id, ghl_location_id, status, outbound_enabled')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !data) return null;
  return data as GhlConnectionRow;
}

export async function getActiveGhlConnectionWithKey(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ActiveGhlConnection | null> {
  const encryptionKey = ghlEncryptionKey();
  if (!encryptionKey) {
    throw new Error('GHL_API_KEY_ENCRYPTION_KEY is not configured');
  }

  const connection = await getActiveGhlConnection(supabase, organizationId);
  if (!connection) return null;

  const { data, error } = await supabase.rpc('get_ghl_api_key', {
    p_connection_id: connection.id,
    p_encryption_key: encryptionKey,
  });

  if (error) {
    throw new Error(`Failed to decrypt GHL API key: ${error.message}`);
  }

  const apiKey = typeof data === 'string' ? data.trim() : '';
  if (!apiKey) return null;

  return { connection, apiKey };
}

export function serviceSupabase(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, key);
}
