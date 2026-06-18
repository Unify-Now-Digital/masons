import React from 'react';
import type { EnquiryPipelineBuckets } from '@/modules/inbox/api/enquiryPipeline.api';
import { EnquiryPipelineCard } from '@/modules/inbox/components/EnquiryPipelineCard';

export interface EnquiryPipelineBoardProps {
  buckets: EnquiryPipelineBuckets;
  onMarkInProgress: (conversationId: string) => void;
  onSelect: (conversationId: string) => void;
  isLoading?: boolean;
  isError?: boolean;
}

const EMPTY_BUCKETS: EnquiryPipelineBuckets = { new: [], in_progress: [] };

interface PipelineColumnProps {
  title: string;
  count: number;
  children: React.ReactNode;
}

const PipelineColumn: React.FC<PipelineColumnProps> = ({ title, count, children }) => (
  <div className="flex flex-col min-h-0 min-w-0 flex-1 border border-gardens-bdr rounded-lg bg-gardens-surf2 overflow-hidden">
    <div className="shrink-0 px-3 py-2 border-b border-gardens-bdr bg-gardens-page/60">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gardens-txm">
          {title}
        </span>
        <span className="text-[11px] font-medium text-gardens-txs tabular-nums">{count}</span>
      </div>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
  </div>
);

export const EnquiryPipelineBoard: React.FC<EnquiryPipelineBoardProps> = ({
  buckets = EMPTY_BUCKETS,
  onMarkInProgress,
  onSelect,
  isLoading = false,
  isError = false,
}) => {
  const newItems = buckets.new ?? [];
  const inProgressItems = buckets.in_progress ?? [];

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 min-h-0">
        <PipelineColumn title="New" count={newItems.length}>
          {isLoading ? (
            <p className="p-3 text-[12px] text-gardens-txs">Loading enquiries…</p>
          ) : isError ? (
            <p className="p-3 text-[12px] text-gardens-red-dk">Unable to load enquiries.</p>
          ) : newItems.length === 0 ? (
            <p className="p-3 text-[12px] text-gardens-txs">No new enquiries.</p>
          ) : (
            newItems.map((item) => (
              <EnquiryPipelineCard
                key={item.conversation.id}
                item={item}
                onMarkInProgress={onMarkInProgress}
                onSelect={onSelect}
              />
            ))
          )}
        </PipelineColumn>
        <PipelineColumn title="In progress" count={inProgressItems.length}>
          {isLoading ? (
            <p className="p-3 text-[12px] text-gardens-txs">Loading enquiries…</p>
          ) : isError ? (
            <p className="p-3 text-[12px] text-gardens-red-dk">Unable to load enquiries.</p>
          ) : inProgressItems.length === 0 ? (
            <p className="p-3 text-[12px] text-gardens-txs">Nothing in progress yet.</p>
          ) : (
            inProgressItems.map((item) => (
              <EnquiryPipelineCard
                key={item.conversation.id}
                item={item}
                onMarkInProgress={onMarkInProgress}
                onSelect={onSelect}
              />
            ))
          )}
        </PipelineColumn>
      </div>
    </div>
  );
};
