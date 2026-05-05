import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/components/ui/sheet';
import { useDefaultInquiriesFilters, useInquiriesPipeline } from '../hooks/useInquiriesPipeline';
import type { InquiriesFilterState } from '../types/inquiries';
import { InquiriesBoardState } from '../components/InquiriesBoardState';
import { InquiriesFilters } from '../components/InquiriesFilters';
import { InquiryDetailPanel } from '../components/InquiryDetailPanel';

export function InquiriesPage() {
  const defaultFilters = useDefaultInquiriesFilters();
  const [filters, setFilters] = useState<InquiriesFilterState>(defaultFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useInquiriesPipeline(filters);

  const rows = useMemo(() => query.data ?? [], [query.data]);

  const selected = useMemo(() => rows.find((r) => r.enquiry_id === selectedId) ?? null, [rows, selectedId]);

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <h1 className="font-head text-xl sm:text-2xl font-semibold text-gardens-tx tracking-tight">Inquiries</h1>
        <p className="text-sm text-gardens-txs mt-1">
          Pipeline view of web enquiries with computed stages — read-only in this version.
        </p>
      </div>

      <InquiriesFilters filters={filters} onChange={setFilters} />

      <InquiriesBoardState
        isLoading={query.isLoading}
        isError={query.isError}
        errorMessage={query.error instanceof Error ? query.error.message : undefined}
        rows={rows}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)}
        onRetry={() => query.refetch()}
      />

      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Enquiry detail</SheetTitle>
            <SheetDescription>
              Full enquiry context for triage. Editing and actions stay in other modules for now.
            </SheetDescription>
          </SheetHeader>
          {selected ? <InquiryDetailPanel row={selected} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
