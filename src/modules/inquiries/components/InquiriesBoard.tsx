import type { InquiryPipelineRow, InquiryPipelineStage } from '../types/inquiries';
import { InquiryCard } from './InquiryCard';

const STAGES: InquiryPipelineStage[] = ['new', 'quoted', 'order_created'];

const STAGE_LABEL: Record<InquiryPipelineStage, string> = {
  new: 'New',
  quoted: 'Quoted',
  order_created: 'Order created',
};

interface InquiriesBoardProps {
  rows: InquiryPipelineRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function InquiriesBoard({ rows, selectedId, onSelect }: InquiriesBoardProps) {
  const byStage = STAGES.reduce(
    (acc, stage) => {
      acc[stage] = rows.filter((r) => r.stage === stage);
      return acc;
    },
    {} as Record<InquiryPipelineStage, InquiryPipelineRow[]>,
  );

  return (
    <div className="grid gap-3 lg:grid-cols-3 min-h-[420px]">
      {STAGES.map((stage) => (
        <div
          key={stage}
          className="flex flex-col rounded-lg border border-gardens-bdr bg-gardens-page/60 min-h-[320px] overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gardens-bdr bg-gardens-sidebar/40">
            <span className="text-xs font-semibold uppercase tracking-wide text-gardens-txs">
              {STAGE_LABEL[stage]}
            </span>
            <span className="text-[11px] font-medium tabular-nums text-gardens-txm">{byStage[stage].length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
            {byStage[stage].map((row) => (
              <InquiryCard
                key={row.enquiry_id}
                row={row}
                selected={row.enquiry_id === selectedId}
                onSelect={() => onSelect(row.enquiry_id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
