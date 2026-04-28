import React from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useSentryIssuesQuery, useSentryStatsQuery } from '@/modules/monitoring/hooks/useSentryMonitor';
import { SentryIssuesTable } from '@/modules/monitoring/components/SentryIssuesTable';
import { SentryStatCards } from '@/modules/monitoring/components/SentryStatCards';
import { SentryErrorTrendChart } from '@/modules/monitoring/components/SentryErrorTrendChart';
import { Button } from '@/shared/components/ui/button';

export const SentryMonitorPage: React.FC = () => {
  const { isOrgAdmin } = useOrganization();
  const issuesQuery = useSentryIssuesQuery(40);
  const statsQuery = useSentryStatsQuery();

  const handleRefresh = () => {
    void issuesQuery.refetch();
    void statsQuery.refetch();
  };

  if (!isOrgAdmin) {
    return <Navigate to="/dashboard/inbox" replace />;
  }

  const issuesError = issuesQuery.error instanceof Error ? issuesQuery.error : null;
  const statsError = statsQuery.error instanceof Error ? statsQuery.error : null;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Error monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Overview from Sentry for the configured project. Data refreshes when you reload or use Refresh.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          onClick={handleRefresh}
          disabled={issuesQuery.isFetching || statsQuery.isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${issuesQuery.isFetching || statsQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <SentryStatCards
        period={statsQuery.data?.period}
        isLoading={statsQuery.isLoading}
        error={statsError}
      />

      <SentryErrorTrendChart
        series={statsQuery.data?.series ?? []}
        isLoading={statsQuery.isLoading}
        error={statsError}
      />

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Recent issues</h2>
        {issuesError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {issuesError.message}
          </div>
        ) : (
          <SentryIssuesTable issues={issuesQuery.data?.issues ?? []} isLoading={issuesQuery.isLoading} />
        )}
      </div>
    </div>
  );
};
