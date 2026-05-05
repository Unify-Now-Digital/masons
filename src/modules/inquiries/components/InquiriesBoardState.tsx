import { AlertCircle, Inbox } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { InquiryPipelineRow } from '../types/inquiries';
import { InquiriesBoard } from './InquiriesBoard';

interface InquiriesBoardStateProps {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  rows: InquiryPipelineRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRetry: () => void;
}

export function InquiriesBoardState({
  isLoading,
  isError,
  errorMessage,
  rows,
  selectedId,
  onSelect,
  onRetry,
}: InquiriesBoardStateProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-gardens-bdr p-3 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-gardens-bdr bg-gardens-red-lt/30 px-6 py-12 text-center">
        <AlertCircle className="h-8 w-8 text-gardens-red-dk" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium text-gardens-tx">Could not load inquiries</p>
          <p className="text-xs text-gardens-txs max-w-md">{errorMessage ?? 'Something went wrong.'}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gardens-bdr px-6 py-16 text-center">
        <Inbox className="h-10 w-10 text-gardens-txm opacity-60" aria-hidden />
        <p className="text-sm font-medium text-gardens-tx">No enquiries match these filters</p>
        <p className="text-xs text-gardens-txs max-w-sm">
          Try widening the date range or including more channels.
        </p>
      </div>
    );
  }

  return <InquiriesBoard rows={rows} selectedId={selectedId} onSelect={onSelect} />;
}
