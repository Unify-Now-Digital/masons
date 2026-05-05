import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { InquiryPipelineRow } from '../types/inquiries';
import {
  detailsNumber,
  detailsString,
  formatGbp,
  formatShortDate,
  formatDateTime,
  personDisplayName,
  shortlistSummary,
  truncate,
} from '../utils/display';

interface InquiryCardProps {
  row: InquiryPipelineRow;
  selected: boolean;
  onSelect: () => void;
}

export function InquiryCard({ row, selected, onSelect }: InquiryCardProps) {
  const name = personDisplayName(row);
  const channel = (row.channel ?? '').toLowerCase();

  const primary = () => {
    switch (channel) {
      case 'quote': {
        const memorial = detailsString(row.details, 'name');
        const price = detailsNumber(row.details, 'price');
        const inscription = detailsString(row.details, 'inscription');
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium text-gardens-tx leading-snug">
              {truncate(memorial, 80) || 'Quote enquiry'}
            </div>
            <div className="text-xs text-gardens-txm">{price !== null ? formatGbp(price) : '—'}</div>
            {inscription ? (
              <div className="text-[11px] text-gardens-txs leading-snug">{truncate(inscription, 120)}</div>
            ) : null}
          </div>
        );
      }
      case 'contact':
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium text-gardens-tx leading-snug">{name}</div>
            <div className="text-[11px] text-gardens-txs leading-snug">{truncate(row.message, 140)}</div>
            {row.sub_type ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                {row.sub_type}
              </Badge>
            ) : null}
          </div>
        );
      case 'appointment':
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium text-gardens-tx leading-snug">{name}</div>
            <div className="text-[11px] text-gardens-txm">{formatDateTime(row.appointment_at)}</div>
            <div className="text-[11px] text-gardens-txs">{row.appointment_kind ?? '—'}</div>
          </div>
        );
      case 'call':
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium text-gardens-tx leading-snug">{name}</div>
            <div className="text-[11px] text-gardens-txm">{row.contact_pref ?? '—'}</div>
            {row.sub_type ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                {row.sub_type}
              </Badge>
            ) : null}
          </div>
        );
      case 'shortlist':
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium text-gardens-tx leading-snug">{name}</div>
            <div className="text-[11px] text-gardens-txs leading-snug">{shortlistSummary(row.details)}</div>
          </div>
        );
      default:
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium text-gardens-tx leading-snug">{name}</div>
            <div className="text-[11px] text-gardens-txs leading-snug">{truncate(row.message, 120)}</div>
          </div>
        );
    }
  };

  const secondary = () => {
    switch (channel) {
      case 'quote':
        return (
          <div className="text-[11px] text-gardens-txs mt-2 flex flex-wrap gap-x-2 gap-y-0.5">
            <span>{name}</span>
            <span className="text-gardens-txm">·</span>
            <span>{formatShortDate(row.created_at)}</span>
          </div>
        );
      default:
        return (
          <div className="text-[11px] text-gardens-txs mt-2">{formatShortDate(row.created_at)}</div>
        );
    }
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-md border px-2.5 py-2 transition-colors',
        selected
          ? 'border-gardens-acc bg-gardens-acc-lt/40 ring-1 ring-gardens-acc/40'
          : 'border-gardens-bdr bg-background hover:bg-gardens-sidebar-hover/60',
      )}
    >
      {primary()}
      {secondary()}
    </button>
  );
}
