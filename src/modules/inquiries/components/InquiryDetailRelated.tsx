import { Link } from 'react-router-dom';
import type { InquiryPipelineRow } from '../types/inquiries';
import { formatGbp } from '../utils/display';

interface InquiryDetailRelatedProps {
  row: InquiryPipelineRow;
}

export function InquiryDetailRelated({ row }: InquiryDetailRelatedProps) {
  const photos = row.photo_urls?.filter(Boolean) ?? [];
  const orderHrefId = row.linked_order_id ?? row.order_id;

  return (
    <div className="space-y-4 pt-4 border-t border-gardens-bdr">
      {photos.length > 0 ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gardens-txs mb-2">Photos</div>
          <div className="grid grid-cols-3 gap-2">
            {photos.slice(0, 12).map((url, idx) => (
              <a
                key={`${url}-${idx}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square rounded-md overflow-hidden border border-gardens-bdr bg-gardens-page"
              >
                <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gardens-txs mb-2">Linked quote</div>
        {row.linked_quote_id ? (
          <div className="rounded-md border border-gardens-bdr p-3 text-xs space-y-1 bg-gardens-page/40">
            <div className="text-gardens-tx font-medium tabular-nums">Quote {row.linked_quote_id}</div>
            <div className="text-gardens-txm">Status: {row.linked_quote_status ?? '—'}</div>
            <div className="text-gardens-txm">Total: {formatGbp(row.linked_quote_total)}</div>
            <Link
              to={`/dashboard/orders?quote=${encodeURIComponent(row.linked_quote_id)}`}
              className="inline-flex text-gardens-acc hover:text-gardens-acc-dk underline underline-offset-2"
            >
              Open linked order from quote
            </Link>
          </div>
        ) : (
          <p className="text-xs text-gardens-txs">No quote matched for display.</p>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gardens-txs mb-2">Linked order</div>
        {orderHrefId ? (
          <div className="rounded-md border border-gardens-bdr p-3 text-xs space-y-1 bg-gardens-page/40">
            <div className="text-gardens-tx font-medium tabular-nums">Order {orderHrefId}</div>
            <div className="text-gardens-txm">Status: {row.linked_order_status ?? '—'}</div>
            <Link
              to={`/dashboard/orders?order=${encodeURIComponent(orderHrefId)}`}
              className="inline-flex text-gardens-acc hover:text-gardens-acc-dk underline underline-offset-2"
            >
              Open order
            </Link>
          </div>
        ) : (
          <p className="text-xs text-gardens-txs">No linked order.</p>
        )}
      </div>
    </div>
  );
}
