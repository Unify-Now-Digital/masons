import React from 'react';
import { cn } from '@/shared/lib/utils';
import { isJobCodeLabel, type SupplierRollup } from '../../../../supabase/functions/_shared/supplierStatus';
import { formatSupplierWhen, supplierDataStale, supplierEtaView, supplierPartsHint, supplierToneClass } from '../display';
import { useSupplierBoard, useSupplierLinkDecision } from '../hooks/useSupplierBoard';

function absentSupplierLabel(stoneStatus?: string | null): string {
  if (stoneStatus === 'Ordered') return 'Ordered, not on supplier board';
  if (stoneStatus === 'In Stock') return 'In stock';
  return 'Not ordered yet';
}

export function OrdersSupplierCell({
  rollup,
  loaded,
  compact = false,
  stoneStatus,
}: {
  rollup?: SupplierRollup | null;
  loaded?: boolean;
  compact?: boolean;
  /** Orders stone status, so a stone we never ordered is not "missing from the board". */
  stoneStatus?: string | null;
}) {
  if (!loaded) {
    return <span data-testid="supplier-pending" className="block min-h-[1em]" />;
  }
  if (!rollup || rollup.kind === 'none') {
    return (
      <span data-testid="supplier-absent" className="inline-flex h-[22px] items-center rounded-full bg-gardens-page px-2 text-[12px] text-gardens-txm">
        {absentSupplierLabel(stoneStatus)}
      </span>
    );
  }
  const eta = supplierEtaView(rollup);
  const hint = supplierPartsHint(rollup.otherParts);
  return (
    <span className={cn('flex w-full min-w-0 max-w-full overflow-hidden', compact ? 'flex-row flex-wrap items-center gap-1.5' : 'flex-col items-start gap-1')}>
      <span
        className={cn(
          'inline-flex min-h-[22px] max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full px-2 py-0.5 text-[12px] font-semibold',
          supplierToneClass(rollup.tone),
        )}
      >
        <span data-testid="supplier-status">{rollup.statusLabel}</span>
        {hint && (
          <span data-testid="supplier-parts" className="font-medium opacity-80">
            {hint}
          </span>
        )}
      </span>
      <span
        data-testid="supplier-delivery"
        title={eta.detail ?? (eta.confirmed ? undefined : eta.label)}
        className={cn(
          'inline-flex h-[22px] max-w-full min-w-0 items-center overflow-hidden rounded-full px-2 text-[12px] font-semibold',
          eta.confirmed
            ? 'bg-gardens-na-green-lt text-gardens-na-green'
            : 'border border-dashed border-gardens-bdr font-medium text-gardens-txs',
        )}
      >
        <span className="min-w-0 truncate">{eta.label}</span>
      </span>
    </span>
  );
}

export function SupplierDetailCard({
  rollup,
  loaded,
  unavailable = false,
  stoneStatus,
  onConfirm,
  onReject,
}: {
  rollup: SupplierRollup | null;
  loaded: boolean;
  unavailable?: boolean;
  stoneStatus?: string | null;
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
        {absentSupplierLabel(stoneStatus)}
      </p>
    );
  }
  const stale = supplierDataStale(current);
  const eta = supplierEtaView(current);
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2">
      <OrdersSupplierCell rollup={current} loaded stoneStatus={stoneStatus} />
      {eta.detail && (
        <p data-testid="supplier-eta-detail" className="m-0 break-words text-[12px] text-gardens-txs">{eta.detail}</p>
      )}
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
            <li key={`${part.description}-${index}`} className="flex min-w-0 items-center gap-2 text-[12px]">
              {!isJobCodeLabel(part.description) && (
                <span className="min-w-0 flex-1 break-words text-gardens-tx">{part.description}</span>
              )}
              <span className={cn('ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', supplierToneClass(part.tone))}>
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
  stoneStatus,
}: {
  orderId: string;
  organizationId: string | null;
  stoneStatus?: string | null;
}) {
  const board = useSupplierBoard(organizationId);
  const decision = useSupplierLinkDecision();
  const rollup = board.loaded ? (board.byOrder.get(orderId) ?? null) : null;
  return (
    <SupplierDetailCard
      rollup={rollup && rollup.kind === 'none' ? null : rollup}
      loaded={board.loaded}
      stoneStatus={stoneStatus}
      unavailable={board.unavailable || !organizationId}
      onConfirm={(linkId) => decision.mutate({ linkId, decision: 'confirmed' })}
      onReject={(linkId) => decision.mutate({ linkId, decision: 'rejected' })}
    />
  );
}
