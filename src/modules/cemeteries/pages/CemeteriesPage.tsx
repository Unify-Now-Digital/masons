import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useJobsList } from '@/modules/jobs/hooks/useJobs';
import { formatDateDMY } from '@/shared/lib/formatters';

interface CemeteryRow {
  name: string;
  jobs: number;
  openJobs: number;
  lastInstall: string | null;
}

export const CemeteriesPage: React.FC = () => {
  const { data: jobs, isLoading, error } = useJobsList();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const rows = useMemo<CemeteryRow[]>(() => {
    if (!jobs) return [];
    const byName = new Map<string, CemeteryRow>();
    for (const job of jobs) {
      const name = job.location_name?.trim() || 'Unspecified';
      const row = byName.get(name) ?? {
        name,
        jobs: 0,
        openJobs: 0,
        lastInstall: null,
      };
      row.jobs += 1;
      if (job.status !== 'completed' && job.status !== 'cancelled') {
        row.openJobs += 1;
      }
      if (job.status === 'completed' && job.scheduled_date) {
        if (!row.lastInstall || job.scheduled_date > row.lastInstall) {
          row.lastInstall = job.scheduled_date;
        }
      }
      byName.set(name, row);
    }
    return Array.from(byName.values()).sort((a, b) => b.jobs - a.jobs);
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  if (error) {
    return (
      <div className="text-gardens-red">Error loading cemeteries: {error instanceof Error ? error.message : 'Unknown error'}</div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="font-head text-xl sm:text-2xl font-semibold text-gardens-tx tracking-tight">Cemeteries</h1>
          <p className="text-sm text-gardens-txs mt-1">
            Jobs grouped by cemetery — derived from scheduled work.
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="h-4 w-4 absolute left-3 top-3 text-gardens-txs" />
          <Input
            placeholder="Search cemeteries..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {rows.length} cemeter{rows.length === 1 ? 'y' : 'ies'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cemetery</TableHead>
                  <TableHead className="text-right">Jobs</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Open</TableHead>
                  <TableHead className="hidden md:table-cell">Last install</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-gardens-txs">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-gardens-txs">
                      {rows.length === 0 ? 'No cemeteries yet — add jobs with a location to populate this view.' : 'No matches.'}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((row) => (
                  <TableRow
                    key={row.name}
                    className="cursor-pointer hover:bg-gardens-page/60"
                    onClick={() => navigate(`/dashboard/logistics?cemetery=${encodeURIComponent(row.name)}`)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gardens-txs shrink-0" />
                        <span className="truncate">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.jobs}</TableCell>
                    <TableCell className="text-right tabular-nums hidden sm:table-cell">
                      {row.openJobs > 0 ? (
                        <span className="text-gardens-amb-dk">{row.openJobs}</span>
                      ) : (
                        <span className="text-gardens-txm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-gardens-txs">
                      {row.lastInstall ? formatDateDMY(row.lastInstall) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
