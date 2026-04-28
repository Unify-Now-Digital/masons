import { useQuery, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { InboxChannel } from '@/modules/inbox/types/inbox.types';

/** Prefix-invalidates all thread summary queries (conversations + customer timelines). */
export const INBOX_THREAD_SUMMARY_QUERY_KEY = ['inbox', 'ai-thread-summary'] as const;

export function invalidateInboxThreadSummaries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: INBOX_THREAD_SUMMARY_QUERY_KEY });
}

interface ThreadSummaryResponse {
  summary?: string | null;
  error?: string;
}

function getInternalKey(): string {
  const v = import.meta.env.VITE_INTERNAL_FUNCTION_KEY;
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

export type ThreadSummaryScope =
  | { scope: 'conversation'; conversationId: string | null }
  | { scope: 'customer_timeline'; personId: string | null }
  | { scope: 'unlinked_timeline'; channel: InboxChannel | null; handle: string | null };

async function fetchThreadSummary(params: ThreadSummaryScope): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be logged in to load conversation summaries.');
  }

  const body =
    params.scope === 'conversation'
      ? { scope: 'conversation' as const, conversation_id: params.conversationId! }
      : params.scope === 'customer_timeline'
        ? { scope: 'customer_timeline' as const, person_id: params.personId! }
        : {
            scope: 'unlinked_timeline' as const,
            channel: params.channel!,
            handle: params.handle!,
          };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  };
  const key = getInternalKey();
  if (key) {
    headers['x-internal-key'] = key;
  }

  const { data, error } = await supabase.functions.invoke<ThreadSummaryResponse>(
    'inbox-ai-thread-summary',
    { body, headers }
  );

  if (error) {
    const message = error.message ?? '';
    const status = (error as { status?: number }).status;
    const isInvalidJwt =
      status === 401 || /invalid jwt/i.test(message) || /unauthorized/i.test(message);

    if (isInvalidJwt) {
      await supabase.auth.signOut();
      throw new Error('Your session has expired or is invalid. Please log in again.');
    }

    throw new Error(message || 'Failed to load summary');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (typeof data?.summary === 'string' && data.summary.trim()) {
    return data.summary.trim();
  }

  return null;
}

function summaryQueryKey(params: ThreadSummaryScope): readonly unknown[] {
  if (params.scope === 'conversation') {
    return [...INBOX_THREAD_SUMMARY_QUERY_KEY, params.scope, params.conversationId ?? ''] as const;
  }
  if (params.scope === 'customer_timeline') {
    return [...INBOX_THREAD_SUMMARY_QUERY_KEY, params.scope, params.personId ?? ''] as const;
  }
  return [
    ...INBOX_THREAD_SUMMARY_QUERY_KEY,
    params.scope,
    params.channel ?? '',
    params.handle ?? '',
  ] as const;
}

function summaryEnabled(params: ThreadSummaryScope): boolean {
  if (params.scope === 'conversation') return !!params.conversationId;
  if (params.scope === 'customer_timeline') return !!params.personId;
  return !!(params.channel && params.handle && params.handle.trim());
}

/**
 * Loads persisted / generated AI summary for the active conversation or customer unified timeline.
 * Refetch when `invalidateInboxThreadSummaries` runs (paired with inbox message invalidation).
 */
export function useThreadSummary(params: ThreadSummaryScope): {
  summary: string | null;
  isLoading: boolean;
  /** True during any fetch (including background refetch after inbox invalidation). */
  isFetching: boolean;
  error: Error | null;
} {
  const enabled = summaryEnabled(params);

  const {
    data: summary = null,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: summaryQueryKey(params),
    queryFn: () => fetchThreadSummary(params),
    enabled,
    retry: false,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    summary,
    isLoading,
    isFetching,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
  };
}
