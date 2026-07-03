import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import type { User } from 'npm:@supabase/supabase-js@2.49.4';

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const url = Deno.env.get('SUPABASE_URL');
  const key =
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) return null;

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  return user;
}