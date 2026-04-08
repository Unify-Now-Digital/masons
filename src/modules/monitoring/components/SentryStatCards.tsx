import React from 'react';
import type { SentryPeriodStats } from '@/modules/monitoring/types/sentry.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

export interface SentryStatCardsProps {
  period: SentryPeriodStats | undefined;
  isLoading?: boolean;
  error?: Error | null;
}

export const SentryStatCards: React.FC<SentryStatCardsProps> = ({ period, isLoading, error }) => {
  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error.message}
      </div>
    );
  }

  if (isLoading || !period) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-24 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const tiles: { label: string; value: string; hint?: string }[] = [
    { label: 'Errors (24h)', value: period.errors24h.toLocaleString() },
    { label: 'Errors (7d)', value: period.errors7d.toLocaleString() },
    { label: 'Errors (30d)', value: period.errors30d.toLocaleString() },
    {
      label: 'Users (30d)',
      value: period.usersAffected.toLocaleString(),
      hint: 'From daily user stats when available in Sentry',
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{t.value}</p>
            {t.hint ? <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
