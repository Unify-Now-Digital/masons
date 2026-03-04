import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

const QUERY_KEY_PREFIX = ['inbox', 'ai-suggest'] as const;

interface SuggestReplyResponse {
  suggestion?: string;
  error?: string;
}

function getInternalKey(): string {
  const v = import.meta.env.VITE_INTERNAL_FUNCTION_KEY;
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

async function fetchSuggestedReply(messageId: string): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('You must be logged in to use AI suggested replies.');
  }

  const options: { body: { message_id: string }; headers?: Record<string, string> } = {
    body: { message_id: messageId },
  };
  const key = getInternalKey();
  if (key) {
    options.headers = { 'x-internal-key': key };
  }
  const { data, error } = await supabase.functions.invoke<SuggestReplyResponse>('inbox-ai-suggest-reply', options);

  if (error) {
    const message = error.message ?? '';
    const status = (error as { status?: number }).status;
    const isInvalidJwt =
      status === 401 || /invalid jwt/i.test(message) || /unauthorized/i.test(message);

    if (isInvalidJwt) {
      await supabase.auth.signOut();
      throw new Error('Your session has expired or is invalid. Please log in again to use AI suggested replies.');
    }

    throw new Error(message || 'Failed to load suggestion');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return typeof data?.suggestion === 'string' && data.suggestion.trim()
    ? data.suggestion.trim()
    : null;
}

/**
 * Fetches a cached or newly generated AI reply suggestion for the given inbound message.
 * Same message_id is not refetched (React Query cache). When messageId is null, no request is made.
 */
export function useSuggestedReply(messageId: string | null): {
  suggestion: string | null;
  isLoading: boolean;
  error: Error | null;
} {
  const {
    data: suggestion = null,
    isLoading,
    error,
  } = useQuery({
    queryKey: [...QUERY_KEY_PREFIX, messageId ?? ''],
    queryFn: () => fetchSuggestedReply(messageId!),
    enabled: !!messageId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    suggestion,
    isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
  };
}
