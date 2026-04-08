import { useQuery } from '@tanstack/react-query';
import { fetchSentryIssues, fetchSentryStats } from '@/modules/monitoring/api/sentryProxy.api';

export function useSentryIssuesQuery(limit = 25) {
  return useQuery({
    queryKey: ['sentry', 'issues', limit],
    queryFn: () => fetchSentryIssues(limit),
    staleTime: 60_000,
  });
}

export function useSentryStatsQuery() {
  return useQuery({
    queryKey: ['sentry', 'stats'],
    queryFn: () => fetchSentryStats(),
    staleTime: 60_000,
  });
}
