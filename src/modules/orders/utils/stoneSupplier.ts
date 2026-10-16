/**
 * One stone · supplier status for an Orders row.
 * Board facts come from the existing supplier rollup (useSupplierBoard).
 * This file does not match orders to jobs.
 */
import { isJobCodeLabel, type SupplierRollup } from '../../../../supabase/functions/_shared/supplierStatus';
import { supplierBatchCode } from '@/modules/supplier/display';
import { depositAgeDays, formatStageDate, STONE_OVERDUE_AFTER_DAYS } from './stageTone';

export type StoneSupplierTone = 'over' | 'needs' | 'match' | 'wait' | 'done';

export interface StoneSupplierView {
  tone: StoneSupplierTone;
  label: string;
  detail: string;
}

export interface StoneSupplierOrder {
  stoneStatus?: string | null;
  depositDate?: string | null;
  jobPaidAt?: string | null;
  /** Not stored on orders. Shown as `ord {d MMM}` only when a caller already has it. */
  stoneOrderedAt?: string | null;
}

const MARKED_ORDERED = 'Ordered';
const IN_STOCK = 'In Stock';

function notOrdered(status: string | null | undefined): boolean {
  return status !== MARKED_ORDERED && status !== IN_STOCK;
}

function ageDetail(order: StoneSupplierOrder, now: Date): string {
  const age = depositAgeDays(order.depositDate, order.jobPaidAt, now);
  if (age == null) return '';
  if (age <= 0) return 'today';
  return `${age}d`;
}

/**
 * First matching row wins.
 * A possible match is decided before the generic "not ordered" rows, so a
 * pending match is never offered as a fresh order.
 * A confirmed board status is shown ahead of "not ordered", because the
 * supplier already has the stone.
 * "Not at supplier" is only when we marked it ordered and the loaded board
 * has no confirmed row.
 */
export function stoneSupplierState(
  order: StoneSupplierOrder,
  board: SupplierRollup | null | undefined,
  now: Date = new Date(),
): StoneSupplierView {
  const status = order.stoneStatus;
  const linked = board?.kind === 'linked';
  const suggested = board?.kind === 'suggested';
  const batch = board ? (supplierBatchCode(board) ?? '') : '';
  const boardStatus = linked ? board?.status ?? null : null;

  if (notOrdered(status) && suggested) {
    return { tone: 'match', label: 'Match?', detail: batch };
  }
  if (linked && boardStatus === 'production') {
    return { tone: 'wait', label: 'In production', detail: batch };
  }
  if (linked && boardStatus === 'transit') {
    const due = board?.deliveryDate ? formatStageDate(board.deliveryDate, now) : null;
    return { tone: 'wait', label: 'In transit', detail: due ? `due ${due}` : batch };
  }
  if (linked && boardStatus === 'arrived') {
    const when = board?.deliveryDate ? formatStageDate(board.deliveryDate, now) : null;
    return { tone: 'done', label: 'Arrived', detail: when ?? '' };
  }
  if (linked && boardStatus === 'waiting') {
    return { tone: 'wait', label: 'Waiting', detail: batch };
  }
  if (board && !linked && status === MARKED_ORDERED) {
    const ordered = formatStageDate(order.stoneOrderedAt, now);
    return { tone: 'over', label: 'Not at supplier', detail: ordered ? `ord ${ordered}` : '' };
  }
  if (status === MARKED_ORDERED && (!board || (linked && !boardStatus))) {
    return { tone: 'done', label: 'Ordered', detail: batch };
  }
  if (notOrdered(status)) {
    const age = depositAgeDays(order.depositDate, order.jobPaidAt, now);
    const overdue = age != null && age > STONE_OVERDUE_AFTER_DAYS;
    const detail = ageDetail(order, now);
    return overdue
      ? { tone: 'over', label: 'Order now', detail }
      : { tone: 'needs', label: 'Order', detail };
  }
  return { tone: 'done', label: 'In stock', detail: '' };
}

export function stoneSupplierChipClass(tone: StoneSupplierTone): string {
  switch (tone) {
    case 'over':
      return 'bg-gardens-na-red-lt text-gardens-na-red';
    case 'needs':
      return 'bg-gardens-na-amber-lt text-gardens-na-amber';
    case 'wait':
      return 'bg-gardens-na-blue-lt text-gardens-na-blue';
    case 'done':
      return 'bg-gardens-na-green-lt text-gardens-na-green';
    case 'match':
      return 'bg-white text-gardens-na-amber border border-dashed border-[#C08A2E]';
  }
}

/** `Order {n} stone(s) · {m} to confirm`, omitting either part when it is 0. */
export function bulkStoneLabel(stones: number, matches: number): string | null {
  const parts: string[] = [];
  if (stones > 0) parts.push(`Order ${stones} stone${stones === 1 ? '' : 's'}`);
  if (matches > 0) parts.push(`${matches} to confirm`);
  return parts.length ? parts.join(' · ') : null;
}

export interface SupplierMatchField {
  label: 'Their name' | 'Size' | 'Material' | 'Parts' | 'Status';
  value: string;
  matches: boolean;
}

export interface SupplierMatchOrder {
  deceasedName?: string | null;
  customer?: string | null;
  dimensions?: string | null;
  material?: string | null;
  stoneStatus?: string | null;
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function same(a: string, b: string): boolean {
  const left = norm(a);
  const right = norm(b);
  return left.length > 0 && left === right;
}

function surnameOf(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).pop() ?? '';
}

function nameMatches(theirs: string, ours: string): boolean {
  if (same(theirs, ours)) return true;
  const surname = surnameOf(ours);
  if (surname.length < 2) return false;
  const escaped = surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(theirs);
}

function sizeIn(text: string | null | undefined): string {
  return text?.match(/\d+\s*[×x]\s*\d+(?:\s*[×x]\s*\d+)?(?:\s*in)?/i)?.[0]?.replace(/\s+/g, ' ').trim() ?? '';
}

export function supplierMatchHeading(board: SupplierRollup): string {
  const batch = supplierBatchCode(board);
  return batch ? `Supplier board · batch ${batch}` : 'Supplier board';
}

/** Supplier line next to ours. `matches` is true only when the two values are the same. */
export function supplierMatchFields(order: SupplierMatchOrder, board: SupplierRollup): SupplierMatchField[] {
  const part = board.parts.find((row) => row.description && !isJobCodeLabel(row.description));
  const reference = board.suggestions[0]?.reference?.trim() || '';
  const theirName = reference || part?.description || '';
  const ourName = (order.deceasedName || order.customer || '').trim();

  const theirSize = sizeIn(part?.description);
  const ourSize = (order.dimensions || '').trim();

  const ourMaterial = (order.material || '').trim();
  const theirMaterial = ourMaterial && part?.description && norm(part.description).includes(norm(ourMaterial))
    ? ourMaterial
    : '';

  const partCount = board.parts.filter((row) => row.description && !isJobCodeLabel(row.description)).length;
  const partsValue = partCount > 0
    ? partCount === 1 ? '1 part' : `${partCount} parts`
    : '';

  const due = board.deliveryDate ? formatStageDate(board.deliveryDate) : null;
  const statusValue = [board.status ? board.statusLabel : '', due ? `due ${due}` : ''].filter(Boolean).join(' · ');
  const ourStatus = order.stoneStatus === IN_STOCK
    ? 'Arrived'
    : order.stoneStatus === MARKED_ORDERED
      ? 'Ordered'
      : 'Not ordered';

  return [
    { label: 'Their name', value: theirName || '—', matches: nameMatches(theirName, ourName) },
    { label: 'Size', value: theirSize || '—', matches: same(theirSize, ourSize) },
    { label: 'Material', value: theirMaterial || '—', matches: !!theirMaterial && same(theirMaterial, ourMaterial) },
    { label: 'Parts', value: partsValue || '—', matches: false },
    { label: 'Status', value: statusValue || '—', matches: same(board.statusLabel, ourStatus) },
  ];
}

export function matchLinkId(board: SupplierRollup | null | undefined): string | null {
  return board?.suggestions[0]?.linkId ?? null;
}
