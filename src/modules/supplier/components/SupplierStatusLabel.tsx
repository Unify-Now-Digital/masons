import React from 'react';
import { cn } from '@/shared/lib/utils';
import type { SupplierRollup } from '../../../../supabase/functions/_shared/supplierStatus';
import { formatSupplierDate, formatSupplierWhen, supplierDataStale, supplierToneClass } from '../display';
import { useSupplierBoard, useSupplierLinkDecision } from '../hooks/useSupplierBoard';

export function OrdersSupplierCell({
  rollup,
  loaded,
  compact = false,
}: {
  rollup?: SupplierRollup | null;
  loaded?: boolean;
  compact?: boolean;
}) {
  if (!loaded) {
    return <span data-testid="supplier-pending" className="block min-h-[1em]" />;
  }
  if (!rollup || rollup.kind === 'none') {
    return (
      <span data-testid="supplier-absent" className="text-[12px] text-gardens-txm">
        Not on supplier board
      </span>
    );
  }
  const date = rollup.deliveryDate ? formatSupplierDate(rollup.deliveryDate) : null;
  return (
    <span className={cn('flex min-w-0', compact ? 'flex-row flex-wrap items-center gap-1.5' : 'flex-col items-start gap-1')}>
      <span className="inline-flex max-w-full items-center gap-1.5">
        <span
          data-testid="supplier-status"
          className={cn(
            'inline-flex h-[22px] max-w-full items-center truncate rounded-full px-2 text-[12px] font-semibold',
            supplierToneClass(rollup.tone),
          )}
        >
          {rollup.statusLabel}
        </span>
        {rollup.otherParts > 0 && (
          <span data-testid="supplier-parts" className="shrink-0 text-[11px] text-gardens-txs">
            +{rollup.otherParts} parts
          </span>
        )}
      </span>
      {date ? (
        <span
          data-testid="supplier-delivery"
          className="inline-flex h-[22px] items-center rounded-full bg-gardens-na-green-lt px-2 text-[12px] font-semibold text-gardens-na-green"
        >
          {date}
        </span>
      ) : (
        <span
          data-testid="supplier-delivery"
          className="inline-flex h-[22px] max-w-full items-center truncate rounded-full border border-dashed border-gardens-bdr px-2 text-[12px] text-gardens-txs"
        >
          {rollup.deliveryEstimate ? `est. ${rollup.deliveryEstimate}` : 'est.'}
        </span>
      )}
    </span>
  );
}

export function SupplierDetailCard({
  rollup,
  loaded,
  unavailable = false,
  onConfirm,
  onReject,
}: {
  rollup: SupplierRollup | null;
  loaded: boolean;
  unavailable?: boolean;
  onConfirm?: (linkId: string) => void;
  onReject?: (linkId: string) => void;
}) {
  if (unavailable) {
    return <p className="m-0 text-[13px] text-gardens-txs">The supplier board isn’t connected yet.</p>;
  }
  if (!loaded) {
    return <p className="m-0 text-[13px] text-gardens-txm">Checking the supplier board…</p>;
  }
  const current = rollup;
  if (!current || current.kind === 'none') {
    return (
      <p data-testid="supplier-absent" className="m-0 text-[13px] text-gardens-txm">
        Not on supplier board
      </p>
    );
  }
  const stale = supplierDataStale(current);
  return (
    <div className="flex flex-col gap-2">
      <OrdersSupplierCell rollup={current} loaded />
      {stale && (
        <p className="m-0 text-[12px] text-gardens-na-amber">Supplier data may be out of date</p>
      )}
      {current.jobCodes.length > 0 && (
        <p className="m-0 text-[12px] tabular-nums text-gardens-txs">Board ref {current.jobCodes.join(', ')}</p>
      )}
      {current.syncedAt && (
        <p className="m-0 text-[12px] text-gardens-txm">Last synced {formatSupplierWhen(current.syncedAt)}</p>
      )}
      {current.parts.length > 0 && (
        <ul className="m-0 list-none space-y-1 p-0">
          {current.parts.map((part, index) => (
            <li key={`${part.jobCode ?? 'part'}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-[12px]">
              <span className="min-w-0 truncate text-gardens-tx">{part.description}</span>
              <span className="tabular-nums text-gardens-txs">{part.jobCode ?? '—'}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', supplierToneClass(part.tone))}>
                {part.statusLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
      {current.suggestions.map((suggestion) => (
        <div key={suggestion.linkId} className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-gardens-bdr px-2 py-1.5">
          <span className="min-w-0 flex-1 text-[12px] text-gardens-txs">
            {suggestion.jobCode ?? 'Job'} · {suggestion.confidence}
          </span>
          {onConfirm && (
            <button type="button" className="h-11 rounded-md border border-gardens-acc bg-gardens-surf px-3 text-[12px] font-semibold text-gardens-acc-dk" onClick={() => onConfirm(suggestion.linkId)}>
              Confirm
            </button>
          )}
          {onReject && (
            <button type="button" className="h-11 rounded-md border border-gardens-bdr px-3 text-[12px] text-gardens-txs" onClick={() => onReject(suggestion.linkId)}>
              Reject
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Order panel Supplier section. The header does not repeat the label. */
export function SupplierOrderSection({
  orderId,
  organizationId,
}: {
  orderId: string;
  organizationId: string | null;
}) {
  const board = useSupplierBoard(organizationId);
  const decision = useSupplierLinkDecision();
  const rollup = board.loaded ? (board.byOrder.get(orderId) ?? null) : null;
  return (
    <SupplierDetailCard
      rollup={rollup && rollup.kind === 'none' ? null : rollup}
      loaded={board.loaded}
      unavailable={board.unavailable || !organizationId}
      onConfirm={(linkId) => decision.mutate({ linkId, decision: 'confirmed' })}
      onReject={(linkId) => decision.mutate({ linkId, decision: 'rejected' })}
    />
  );
}
