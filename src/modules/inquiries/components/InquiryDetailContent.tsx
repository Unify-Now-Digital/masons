import type { InquiryPipelineRow } from '../types/inquiries';
import { detailsNumber, detailsString, formatDateTime } from '../utils/display';

interface InquiryDetailContentProps {
  row: InquiryPipelineRow;
}

function ConfigRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[92px_1fr] gap-2 text-xs py-1 border-b border-gardens-bdr/70 last:border-0">
      <div className="text-gardens-txs font-medium">{label}</div>
      <div className="text-gardens-tx whitespace-pre-wrap break-words">{value}</div>
    </div>
  );
}

export function InquiryDetailContent({ row }: InquiryDetailContentProps) {
  const d = row.details;
  const memorial = detailsString(d, 'name') ?? detailsString(d, 'memorial');
  const stone = detailsString(d, 'stone');
  const size = detailsString(d, 'size');
  const font = detailsString(d, 'font');
  const inscription = detailsString(d, 'inscription');
  const addons = detailsString(d, 'addons') ?? detailsString(d, 'add_ons');
  const priceRaw = detailsNumber(d, 'price');
  const price =
    priceRaw !== null
      ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(
          priceRaw,
        )
      : null;

  const hasConfig = !!(memorial || stone || size || font || inscription || addons || price);

  return (
    <div className="space-y-4 pt-4 border-t border-gardens-bdr">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gardens-txs mb-2">Inquiry</div>
        <div className="space-y-2 text-xs text-gardens-tx">
          <div>
            <span className="text-gardens-txs">Message · </span>
            <span className="whitespace-pre-wrap break-words">{row.message?.trim() || '—'}</span>
          </div>
          <div className="text-gardens-txm space-y-0.5">
            <div>Source page: {row.source_page ?? '—'}</div>
            <div>Location: {row.location ?? '—'}</div>
            <div>Contact preference: {row.contact_pref ?? '—'}</div>
            {row.appointment_at ? <div>Appointment: {formatDateTime(row.appointment_at)}</div> : null}
          </div>
        </div>
      </div>

      {hasConfig ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gardens-txs mb-2">Configuration</div>
          <div className="rounded-md border border-gardens-bdr px-3 py-2 bg-gardens-page/40">
            <ConfigRow label="Memorial" value={memorial} />
            <ConfigRow label="Stone" value={stone} />
            <ConfigRow label="Size" value={size} />
            <ConfigRow label="Font" value={font} />
            <ConfigRow label="Inscription" value={inscription} />
            <ConfigRow label="Add-ons" value={addons} />
            <ConfigRow label="Price" value={price} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
