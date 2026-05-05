import type { InquiryPipelineRow } from '../types/inquiries';
import { InquiryDetailContent } from './InquiryDetailContent';
import { InquiryDetailHeader } from './InquiryDetailHeader';
import { InquiryDetailRelated } from './InquiryDetailRelated';

interface InquiryDetailPanelProps {
  row: InquiryPipelineRow;
}

export function InquiryDetailPanel({ row }: InquiryDetailPanelProps) {
  return (
    <div className="space-y-2 pb-6">
      <InquiryDetailHeader row={row} />
      <InquiryDetailContent row={row} />
      <InquiryDetailRelated row={row} />
    </div>
  );
}
