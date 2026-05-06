import type { InquiryPipelineRow } from '../types/inquiries';
import { formatGbp } from '../utils/display';

interface InquiryDetailRelatedProps {
  row: InquiryPipelineRow;
}

export function InquiryDetailRelated({ row }: InquiryDetailRelatedProps) {
  const orderDisplayId = row.linked_order_id ?? row.order_id;

  return (
    <div className="space-y-4 pt-4 border-t border-gardens-bdr">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gardens-txs mb-2">Linked quote</div>
        {row.linked_quote_id ? (
          <div className="rounded-md border border-gardens-bdr p-3 text-xs space-y-1 bg-gardens-page/40">
            <div className="text-gardens-tx font-medium tabular-nums">Quote {row.linked_quote_id}</div>
            <div className="text-gardens-txm">Status: {row.linked_quote_status ?? '—'}</div>
            <div className="text-gardens-txm">Total: {formatGbp(row.linked_quote_total)}</div>
          </div>
        ) : (
          <p className="text-xs text-gardens-txs">No quote matched for display.</p>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gardens-txs mb-2">Linked order</div>
        {orderDisplayId ? (
          <div className="rounded-md border border-gardens-bdr p-3 text-xs space-y-1 bg-gardens-page/40">
            <div className="text-gardens-tx font-medium tabular-nums">Order {orderDisplayId}</div>
            <div className="text-gardens-txm">Status: {row.linked_order_status ?? '—'}</div>
          </div>
        ) : (
          <p className="text-xs text-gardens-txs">No linked order.</p>
        )}
      </div>
    </div>
  );
}
