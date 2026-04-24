import React from 'react';
import type { SentryIssueRow } from '@/modules/monitoring/types/sentry.types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

function formatTs(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export interface SentryIssuesTableProps {
  issues: SentryIssueRow[];
  isLoading?: boolean;
}

export const SentryIssuesTable: React.FC<SentryIssuesTableProps> = ({ issues, isLoading }) => {
  if (isLoading) {
    return (
      <div className="rounded-md border bg-white p-8 text-center text-sm text-muted-foreground">
        Loading issues…
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">
        No open issues reported for this project. If you expected errors here, check the Sentry project and
        filters.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead className="text-right w-24">Events</TableHead>
            <TableHead className="whitespace-nowrap">First seen</TableHead>
            <TableHead className="whitespace-nowrap">Last seen</TableHead>
            <TableHead className="w-20">Level</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-md">
                {row.permalink ? (
                  <a
                    href={row.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gardens-blu-dk hover:underline font-medium"
                  >
                    {row.title}
                  </a>
                ) : (
                  <span className="font-medium">{row.title}</span>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.count.toLocaleString()}</TableCell>
              <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                {formatTs(row.firstSeen)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                {formatTs(row.lastSeen)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.level ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
