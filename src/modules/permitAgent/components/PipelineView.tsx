import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/shared/components/ui/table';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Search, AlertTriangle, CheckCircle2, FileSearch, FilePen, Send,
  Clock, RefreshCw, Bot,
} from 'lucide-react';
import type { PermitPipelineItem, PermitPhase } from '../types/permitAgent.types';
import { PHASE_LABELS, PHASE_COLORS } from '../types/permitAgent.types';

interface PipelineViewProps {
  items: PermitPipelineItem[];
  isLoading: boolean;
  error: Error | null;
  onSelectItem: (item: PermitPipelineItem) => void;
  selectedId?: string;
  onRefetch: () => void;
  onInitialize: () => void;
  isInitializing: boolean;
}

const phaseIcons: Record<PermitPhase, React.ElementType> = {
  REQUIRED: Clock,
  SEARCHING: FileSearch,
  FORM_FOUND: CheckCircle2,
  PREFILLED: FilePen,
  SENT_TO_CLIENT: Send,
  SUBMITTED: Send,
  APPROVED: CheckCircle2,
};

function ReadinessMeter({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : score >= 20 ? 'bg-blue-500' : 'bg-slate-300';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Progress value={score} className="h-2 flex-1 [&>div]:transition-all" />
      <span className="text-xs font-medium tabular-nums w-8 text-right">{score}%</span>
    </div>
  );
}

export const PipelineView: React.FC<PipelineViewProps> = ({
  items, isLoading, error, onSelectItem, selectedId, onRefetch, onInitialize, isInitializing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<PermitPhase | 'ALL' | 'URGENT'>('ALL');

  const filtered = useMemo(() => {
    let result = items;

    if (phaseFilter === 'URGENT') {
      result = result.filter((i) => i.isUrgent);
    } else if (phaseFilter !== 'ALL') {
      result = result.filter((i) => i.permit.permit_phase === phaseFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((i) =>
        i.order.customer_name.toLowerCase().includes(q) ||
        i.order.location?.toLowerCase().includes(q) ||
        i.order.order_number?.toString().includes(q) ||
        i.permit.authority_name?.toLowerCase().includes(q)
      );
    }

    // Sort: urgent first, then by readiness ascending (least ready first)
    return result.sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1;
      if (!a.isUrgent && b.isUrgent) return 1;
      return a.permit.readiness_score - b.permit.readiness_score;
    });
  }, [items, phaseFilter, searchQuery]);

  const urgentCount = useMemo(() => items.filter((i) => i.isUrgent).length, [items]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-between">
          <div className="text-red-600">
            {error instanceof Error ? error.message : 'Failed to load permit pipeline.'}
          </div>
          <Button variant="outline" size="sm" onClick={onRefetch}>
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <Bot className="h-10 w-10 text-slate-400 mx-auto" />
          <div className="text-lg font-medium">No permits in pipeline</div>
          <div className="text-sm text-slate-600">
            Initialize permits for existing orders to get started.
          </div>
          <Button onClick={onInitialize} disabled={isInitializing}>
            <Bot className="h-4 w-4 mr-2" />
            {isInitializing ? 'Initializing...' : 'Initialize Permits'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search orders, locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={phaseFilter === 'ALL' ? 'default' : 'outline'}
            onClick={() => setPhaseFilter('ALL')}
          >
            All ({items.length})
          </Button>
          <Button
            size="sm"
            variant={phaseFilter === 'URGENT' ? 'destructive' : 'outline'}
            onClick={() => setPhaseFilter('URGENT')}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Urgent ({urgentCount})
          </Button>
          {(['REQUIRED', 'SEARCHING', 'FORM_FOUND', 'PREFILLED', 'SENT_TO_CLIENT', 'SUBMITTED', 'APPROVED'] as PermitPhase[]).map((phase) => {
            const count = items.filter((i) => i.permit.permit_phase === phase).length;
            if (count === 0) return null;
            return (
              <Button
                key={phase}
                size="sm"
                variant={phaseFilter === phase ? 'default' : 'outline'}
                onClick={() => setPhaseFilter(phase)}
              >
                {PHASE_LABELS[phase]} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead>Deceased / Order</TableHead>
              <TableHead className="hidden md:table-cell">Location</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead className="hidden sm:table-cell">Readiness</TableHead>
              <TableHead className="hidden lg:table-cell">Install</TableHead>
              <TableHead className="hidden lg:table-cell">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => {
              const PhaseIcon = phaseIcons[item.permit.permit_phase];
              return (
                <TableRow
                  key={item.permit.id}
                  className={`cursor-pointer transition-colors ${
                    selectedId === item.permit.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => onSelectItem(item)}
                >
                  <TableCell className="font-mono text-xs text-slate-500">
                    {item.order.order_number || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.isUrgent && (
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{item.order.customer_name}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {item.order.person_name || item.order.order_type}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-slate-600 max-w-[200px] truncate">
                    {item.order.location || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${PHASE_COLORS[item.permit.permit_phase]} text-xs`}>
                      <PhaseIcon className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">{PHASE_LABELS[item.permit.permit_phase]}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <ReadinessMeter score={item.permit.readiness_score} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {item.daysUntilInstall !== null ? (
                      <span className={item.isUrgent ? 'text-red-600 font-medium' : 'text-slate-600'}>
                        {item.daysUntilInstall <= 0
                          ? 'Overdue'
                          : `${item.daysUntilInstall}d`}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex gap-1">
                      {item.permit.form_url && (
                        <span title="Form Found" className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                      )}
                      {item.permit.prefilled_data && (
                        <span title="Pre-filled" className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
                      )}
                      {item.permit.fee_paid && (
                        <span title="Fee Paid" className="inline-block w-2 h-2 rounded-full bg-green-500" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-slate-500">
                  No permits match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-slate-500 text-right">
        Showing {filtered.length} of {items.length} permits
      </div>
    </div>
  );
};
