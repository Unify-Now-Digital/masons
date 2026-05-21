import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';
import { isUserInOrganization } from './organizationMembership.ts';

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

export type GhlConnectionRow = {
  id: string;
  organization_id: string;
  ghl_location_id: string;
  status: string;
};

export function ghlApiKey(): string | null {
  return Deno.env.get('GHL_API_KEY')?.trim() || null;
}

export async function ghlFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const apiKey = ghlApiKey();
  if (!apiKey) {
    throw new Error('GHL API not configured');
  }
  const url = path.startsWith('http') ? path : `${GHL_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${apiKey}`);
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
    .select('id, organization_id, ghl_location_id, status')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !data) return null;
  return data as GhlConnectionRow;
}

export function serviceSupabase(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, key);
}

export function envLocationId(): string | null {
  return Deno.env.get('GHL_LOCATION_ID')?.trim() || null;
}

/** Optional: ensure connection location matches deployed secret for pilot single-tenant setup. */
export function locationMatchesEnv(ghlLocationId: string): boolean {
  const envLoc = envLocationId();
  if (!envLoc) return true;
  return ghlLocationId === envLoc;
}
