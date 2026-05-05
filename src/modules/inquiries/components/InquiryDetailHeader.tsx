import { Link } from 'react-router-dom';
import { Badge } from '@/shared/components/ui/badge';
import type { InquiryPipelineRow, InquiryPipelineStage } from '../types/inquiries';
import { formatDateTime, personDisplayName } from '../utils/display';

const STAGE_LABEL: Record<InquiryPipelineStage, string> = {
  new: 'New',
  quoted: 'Quoted',
  order_created: 'Order created',
};

interface InquiryDetailHeaderProps {
  row: InquiryPipelineRow;
}

export function InquiryDetailHeader({ row }: InquiryDetailHeaderProps) {
  const stage = row.stage as InquiryPipelineStage;
  const stageLabel = STAGE_LABEL[stage] ?? row.stage;
  const name = personDisplayName(row);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {row.channel ? (
          <Badge variant="outline" className="capitalize text-[11px] font-normal">
            {row.channel}
          </Badge>
        ) : null}
        {row.sub_type ? (
          <Badge variant="secondary" className="text-[11px] font-normal">
            {row.sub_type}
          </Badge>
        ) : null}
        <Badge className="text-[11px] bg-gardens-acc hover:bg-gardens-acc-dk font-normal">{stageLabel}</Badge>
      </div>
      <div className="text-[11px] text-gardens-txs">{formatDateTime(row.created_at)}</div>
      <div className="rounded-md border border-gardens-bdr p-3 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gardens-txs">Person</div>
        <div className="text-sm font-medium text-gardens-tx">{name}</div>
        <div className="text-xs text-gardens-txm space-y-0.5">
          <div>Email: {row.person_email ?? '—'}</div>
          <div>Phone: {row.person_phone ?? '—'}</div>
        </div>
        {row.person_id ? (
          <Link
            to={`/dashboard/customers?customer=${encodeURIComponent(row.person_id)}`}
            className="inline-flex text-xs text-gardens-acc hover:text-gardens-acc-dk underline underline-offset-2"
          >
            Open person record
          </Link>
        ) : (
          <p className="text-xs text-gardens-txs">No linked person.</p>
        )}
      </div>
    </div>
  );
}
