import { useEnquiryScores, type EnquiryScore } from '@/modules/inbox/hooks/useEnquiryScores';
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

/** Score desc; unscored last; ties/unscored keep incoming (RPC) order — sort is stable. */
function byScoreDesc(scoreById: Map<string, EnquiryScore>) {
  return (a: InquiryPipelineRow, b: InquiryPipelineRow) => {
    const scoreA = scoreById.get(a.enquiry_id);
    const scoreB = scoreById.get(b.enquiry_id);
    if (scoreA && scoreB) return scoreB.score - scoreA.score;
    if (scoreA) return -1;
    if (scoreB) return 1;
    return 0;
  };
}

export function InquiriesBoard({ rows, selectedId, onSelect }: InquiriesBoardProps) {
  const { data: enquiryScores } = useEnquiryScores();
  const scoreById = new Map((enquiryScores ?? []).map((s) => [s.id, s]));

  const byStage = STAGES.reduce(
    (acc, stage) => {
      acc[stage] = rows.filter((r) => r.stage === stage).sort(byScoreDesc(scoreById));
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
                score={scoreById.get(row.enquiry_id) ?? null}
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
