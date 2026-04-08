import { supabase } from '@/shared/lib/supabase';
import type { SentryIssuesResponse, SentryStatsResponse } from '@/modules/monitoring/types/sentry.types';

function functionsBaseUrl(): string {
  const u = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
  if (!u?.trim()) {
    throw new Error('VITE_SUPABASE_FUNCTIONS_URL is not configured');
  }
  return u.replace(/\/$/, '');
}

async function proxyFetchJson<T>(pathWithQuery: string): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to view monitoring.');
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const response = await fetch(`${functionsBaseUrl()}${pathWithQuery}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(anonKey ? { apikey: anonKey } : {}),
    },
  });

  const bodyText = await response.text();
  let message = 'Failed to load monitoring data.';
  try {
    const parsed = JSON.parse(bodyText) as { error?: string };
    if (parsed.error) message = parsed.error;
  } catch {
    if (bodyText) message = bodyText.slice(0, 200);
  }

  if (response.status === 403) {
    throw new Error('You do not have access to monitoring.');
  }
  if (!response.ok) {
    throw new Error(message);
  }

  return JSON.parse(bodyText) as T;
}

export async function fetchSentryIssues(limit = 25): Promise<SentryIssuesResponse> {
  const cap = Math.min(100, Math.max(1, limit));
  return proxyFetchJson<SentryIssuesResponse>(`/sentry-proxy?op=issues&limit=${cap}`);
}

export async function fetchSentryStats(): Promise<SentryStatsResponse> {
  return proxyFetchJson<SentryStatsResponse>('/sentry-proxy?op=stats');
}
