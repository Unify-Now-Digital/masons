import React, { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible';
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog';
import { formatShortDate } from '@/modules/jobsPipeline/utils/display';
import type { QuoteEnquiry } from '@/modules/inbox/hooks/useQuoteEnquiriesByPersonId';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import { cn } from '@/shared/lib/utils';

interface InboxEnquiryCardProps {
  /** Newest first; the panel renders the card only when there is at least one. */
  enquiries: QuoteEnquiry[];
  /** The person has ≥1 order: the card starts collapsed to its summary line. */
  hasOrders: boolean;
  triggerClassName: string;
  bodyClassName: string;
  sectionLabelClassName: string;
  /** Render only the body. The parent supplies the PanelBlock trigger. */
  bodyOnly?: boolean;
}

const INSCRIPTION_LONG_CHARS = 200;
const INSCRIPTION_LONG_LINES = 4;

const DetailRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex items-start justify-between gap-2">
    <span className="shrink-0 text-[11px] text-gardens-txs">{label}</span>
    <span className={cn('min-w-0 text-right text-[11px] text-gardens-tx', strong ? 'font-semibold' : 'font-medium')}>
      {value}
    </span>
  </div>
);

/** Website quote enquiry for the inbox right panel. Values as stored by the portal. */
export const InboxEnquiryCard: React.FC<InboxEnquiryCardProps> = ({
  enquiries,
  hasOrders,
  triggerClassName,
  bodyClassName,
  sectionLabelClassName,
  bodyOnly,
}) => {
  // null = default (expanded unless the person has orders); set once staff toggle the card.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inscriptionExpanded, setInscriptionExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [brokenImageUrl, setBrokenImageUrl] = useState<string | null>(null);

  const enquiry = enquiries.find((e) => e.id === selectedId) ?? enquiries[0];
  if (!enquiry) return null;

  const open = openOverride ?? !hasOrders;
  const imageUrl = enquiry.imageUrl && enquiry.imageUrl !== brokenImageUrl ? enquiry.imageUrl : null;
  const onImageError = () => setBrokenImageUrl(enquiry.imageUrl);

  const options = [
    { label: 'Stone', value: enquiry.colour },
    { label: 'Size', value: enquiry.size },
    { label: 'Font', value: enquiry.font },
    { label: 'Lettering', value: enquiry.lettering },
    { label: 'Infill', value: enquiry.infill },
    { label: 'Add-ons', value: enquiry.addons.join(', ') || null },
  ].filter((row): row is { label: string; value: string } => row.value !== null);

  const inscriptionLong =
    !!enquiry.inscription &&
    (enquiry.inscription.length > INSCRIPTION_LONG_CHARS ||
      enquiry.inscription.split('\n').length > INSCRIPTION_LONG_LINES);

  const details = (
    <>
      <div className={bodyOnly ? 'space-y-3' : 'space-y-3 rounded-lg bg-gardens-surf2 p-3.5 shadow-sm'}>
        <div className="flex gap-3">
          {imageUrl && (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label="Enlarge product image"
              className="w-20 shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-gardens-acc"
            >
              <img
                src={imageUrl}
                alt={enquiry.name}
                loading="lazy"
                onError={onImageError}
                className="aspect-[3/4] w-full rounded-lg border border-gardens-bdr object-contain"
              />
            </button>
          )}
          <div className="min-w-0 space-y-0.5">
            <p className="text-[13px] font-medium text-gardens-tx">{enquiry.name}</p>
            {enquiry.type && <p className="text-[11px] text-gardens-txs">{enquiry.type}</p>}
            <p className="text-[11px] text-gardens-txs">Enquired {formatShortDate(enquiry.createdAt)}</p>
          </div>
        </div>
        {options.length > 0 && (
          <div className="space-y-1.5">
            {options.map(({ label, value }) => (
              <DetailRow key={label} label={label} value={value} />
            ))}
          </div>
        )}
        {enquiry.inscription && (
          <div className="space-y-1">
            <p className={sectionLabelClassName}>Inscription</p>
            <p
              className={cn(
                'whitespace-pre-line text-[12px] italic text-gardens-tx',
                !inscriptionExpanded && 'line-clamp-4',
              )}
            >
              {enquiry.inscription}
            </p>
            {inscriptionLong && (
              <button
                type="button"
                onClick={() => setInscriptionExpanded((v) => !v)}
                className="text-[11px] font-medium text-gardens-txs hover:text-gardens-tx"
              >
                {inscriptionExpanded ? 'Show less' : 'Show all'}
              </button>
            )}
          </div>
        )}
        <div className="space-y-1.5 border-t border-gardens-bdr pt-2">
          <DetailRow label="Guide price" value={formatGbpDecimal(enquiry.price)} />
          <DetailRow
            label="Permit fee"
            value={enquiry.permitFee ? `+${formatGbpDecimal(enquiry.permitFee)}` : 'Not yet determined'}
          />
          <DetailRow label="Guide total" value={formatGbpDecimal(enquiry.guideTotal)} strong />
        </div>
      </div>
      {enquiries.length > 1 && (
        <div className="mt-3 space-y-1">
          <p className={cn(sectionLabelClassName, 'px-0.5')}>All enquiries</p>
          {enquiries.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={e.id === enquiry.id}
              onClick={() => {
                setSelectedId(e.id);
                setInscriptionExpanded(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] text-gardens-tx',
                e.id === enquiry.id ? 'bg-gardens-acc-lt' : 'hover:bg-gardens-page',
              )}
            >
              <span className="shrink-0 tabular-nums text-gardens-txs">{formatShortDate(e.createdAt)}</span>
              <span className="min-w-0 flex-1 truncate">{e.name}</span>
              <span className="shrink-0 tabular-nums">{formatGbpDecimal(e.guideTotal)}</span>
            </button>
          ))}
        </div>
      )}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-3xl p-2" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{enquiry.name}</DialogTitle>
          {imageUrl && (
            <img src={imageUrl} alt={enquiry.name} className="max-h-[85vh] w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  if (bodyOnly) return details;

  return (
    <Collapsible open={open} onOpenChange={setOpenOverride}>
      <CollapsibleTrigger className={triggerClassName}>
        {open ? (
          <>
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Enquiry</span>
            {enquiries.length > 1 && (
              <span className="text-xs font-semibold tabular-nums">{enquiries.length}</span>
            )}
          </>
        ) : (
          <>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                onError={onImageError}
                className="h-6 w-6 shrink-0 rounded border border-gardens-bdr object-cover"
              />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate text-left">
              <span className="sr-only">Enquiry: </span>
              {enquiry.name}
            </span>
            {enquiry.guideTotal !== null && (
              <span className="shrink-0 tabular-nums">{formatGbpDecimal(enquiry.guideTotal)}</span>
            )}
          </>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 group-data-[state=open]:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className={bodyClassName}>
        {details}
      </CollapsibleContent>
    </Collapsible>
  );
};
