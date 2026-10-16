import { useRef, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/shared/lib/utils';
import type { UIOrder } from '../utils/orderTransform';
import {
  matchLinkId,
  stoneSupplierChipClass,
  stoneSupplierState,
  supplierMatchFields,
  supplierMatchHeading,
  supplierMatchWhy,
  type SupplierMatchOrder,
} from '../utils/stoneSupplier';
import type { SupplierRollup } from '../../../../supabase/functions/_shared/supplierStatus';

function canHover(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function SupplierMatchCard({
  order,
  board,
  onConfirm,
  onReject,
  pending = false,
}: {
  order: SupplierMatchOrder;
  board: SupplierRollup;
  onConfirm?: (linkId: string) => void;
  onReject?: (linkId: string) => void;
  pending?: boolean;
}) {
  const linkId = matchLinkId(board);
  const fields = supplierMatchFields(order, board);
  return (
    <div
      data-testid="supplier-match-card"
      className="flex w-[440px] max-w-[calc(100vw-24px)] flex-col gap-2.5 rounded-lg border border-gardens-bdr bg-gardens-surf p-3.5 text-gardens-tx shadow-md"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-[22px] shrink-0 items-center rounded-md border border-dashed border-[#C08A2E] px-2 text-[12px] font-bold text-gardens-na-amber">
          Match?
        </span>
        <b className="min-w-0 truncate text-[13.5px]">{supplierMatchHeading(board)}</b>
      </div>
      <p data-testid="supplier-match-status" className="m-0 text-[12.5px] font-semibold text-gardens-na-amber">
        Possible match · confirm?
      </p>
      <table className="m-0 w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-gardens-txs">
            <th className="py-1 pr-2 font-bold" />
            <th className="py-1 pr-2 font-bold">Mason</th>
            <th className="py-1 font-bold">Supplier</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.label} data-matched={field.matched ? 'yes' : 'no'}>
              <th className="py-0.5 pr-2 text-left font-medium text-gardens-txs">{field.label}</th>
              <td className="py-0.5 pr-2 align-top break-words text-gardens-tx">{field.ours}</td>
              <td className={cn('py-0.5 align-top break-words', field.matched ? 'font-semibold text-gardens-na-green' : 'text-gardens-tx')}>
                {field.theirs}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p data-testid="supplier-match-why" className="m-0 text-[12.5px] leading-snug text-gardens-tx">
        {supplierMatchWhy(fields)}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="supplier-match-confirm"
          disabled={!linkId || !onConfirm || pending}
          className="inline-flex h-8 min-h-11 items-center rounded-lg bg-gardens-acc px-3.5 text-[13px] font-bold text-white hover:bg-gardens-acc-dk disabled:opacity-50 lg:min-h-0"
          onClick={() => { if (linkId) onConfirm?.(linkId); }}
        >
          Confirm match
        </button>
        <button
          type="button"
          data-testid="supplier-match-reject"
          disabled={!linkId || !onReject || pending}
          className="inline-flex h-8 min-h-11 items-center rounded-lg border border-gardens-bdr bg-white px-3 text-[13px] font-semibold text-gardens-tx hover:bg-gardens-page disabled:opacity-50 lg:min-h-0"
          onClick={() => { if (linkId) onReject?.(linkId); }}
        >
          Not this one
        </button>
      </div>
    </div>
  );
}

function ChipFace({
  label,
  detail,
  tone,
  className,
}: {
  label: string;
  detail: string;
  tone: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex h-[30px] max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-semibold', className)}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
      {detail && <span className="ml-auto shrink-0 font-medium tabular-nums opacity-85">{detail}</span>}
      <span className="sr-only">{tone}</span>
    </span>
  );
}

export function StoneSupplierChip({
  order,
  now,
  compact = false,
  onOpen,
  onConfirm,
  onReject,
  pending = false,
}: {
  order: UIOrder;
  now?: Date;
  compact?: boolean;
  onOpen?: () => void;
  onConfirm?: (linkId: string) => void;
  onReject?: (linkId: string) => void;
  pending?: boolean;
}) {
  const clock = now ?? new Date();
  const view = stoneSupplierState(order, order.supplier ?? null, clock);
  const title = view.detail ? `${view.label} · ${view.detail}` : view.label;
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  if (view.tone !== 'match' || !order.supplier) {
    return (
      <button
        type="button"
        data-testid="stone-supplier-chip"
        data-tone={view.tone}
        title={title}
        onClick={(event) => {
          event.stopPropagation();
          onOpen?.();
        }}
        className={cn(compact && 'min-h-11', 'max-w-full rounded-md text-left')}
      >
        <ChipFace label={view.label} detail={view.detail} tone={view.tone} className={cn(stoneSupplierChipClass(view.tone), compact && 'min-h-11')} />
      </button>
    );
  }

  const schedule = () => {
    if (!canHover()) return;
    clearTimer();
    timer.current = setTimeout(() => setOpen(true), 300);
  };
  const close = () => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <button
          type="button"
          data-testid="stone-supplier-chip"
          data-tone="match"
          title={title}
          aria-expanded={open}
          onMouseEnter={schedule}
          onMouseLeave={close}
          onFocus={() => { if (canHover()) { clearTimer(); setOpen(true); } }}
          onBlur={close}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          className={cn(compact && 'min-h-11', 'max-w-full rounded-md text-left')}
        >
          <ChipFace label={view.label} detail={view.detail} tone="match" className={cn(stoneSupplierChipClass('match'), compact && 'min-h-11')} />
        </button>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onMouseEnter={() => { clearTimer(); setOpen(true); }}
          onMouseLeave={close}
          className="z-50 outline-none"
        >
          <SupplierMatchCard
            order={order}
            board={order.supplier}
            onConfirm={onConfirm}
            onReject={onReject}
            pending={pending}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
