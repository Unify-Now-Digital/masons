import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Development-time validation and logging
if (import.meta.env.DEV) {
  if (!supabaseUrl) {
    console.error('❌ Missing VITE_SUPABASE_URL environment variable');
    console.error('   Please create a .env file with VITE_SUPABASE_URL=your_url');
  }
  if (!supabaseKey) {
    console.error('❌ Missing VITE_SUPABASE_ANON_KEY environment variable');
    console.error('   Please create a .env file with VITE_SUPABASE_ANON_KEY=your_key');
  }
  if (supabaseUrl && supabaseKey) {
    console.log('✅ Supabase environment variables loaded');
    console.log(`   URL: ${supabaseUrl}`);
  }
}

// Fail-fast: throw error if environment variables are missing
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'Please create a .env file in the project root with:\n' +
    '  VITE_SUPABASE_URL=your_supabase_project_url\n' +
    '  VITE_SUPABASE_ANON_KEY=your_supabase_anon_key\n\n' +
    'See .env.example for a template.'
  );
}

const REST_TIMEOUT_MS = 20_000;
/** Edge functions (AI summary, Stripe) can legitimately take longer. */
const FUNCTIONS_TIMEOUT_MS = 60_000;

export function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const ms = url.includes('/functions/v1/') ? FUNCTIONS_TIMEOUT_MS : REST_TIMEOUT_MS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException(`Request timed out after ${ms / 1000}s`, 'TimeoutError')), ms);
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) ctrl.abort(outer.reason);
    else outer.addEventListener('abort', () => ctrl.abort(outer.reason), { once: true });
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// Single app-wide Supabase client (no global Authorization; auth uses supabase-js session handling).
// Import everywhere: import { supabase } from "@/shared/lib/supabase";
// Checked-in generated DB types are a partial snapshot; loosen generics so `.from('…')` matches the live schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(supabaseUrl, supabaseKey, {
  // QA 2026-10-14: a hung request (incl. the auth token refresh, which holds the auth lock
  // every other query waits on) left screens on "Loading…" forever. Time requests out so
  // React Query can retry and show an error instead.
  global: { fetch: fetchWithTimeout },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Versioned storage key to invalidate any old tokens after auth/OAuth changes
    storageKey: 'mason-auth-v2',
  },
});

// DEV ONLY: expose Supabase client in browser console for debugging
if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.supabase = supabase;
}