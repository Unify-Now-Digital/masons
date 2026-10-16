/**
 * One stone · supplier status for an Orders row.
 * Board facts come from the existing supplier rollup (useSupplierBoard).
 * This file does not match orders to jobs.
 */
import { isJobCodeLabel, type SupplierRollup } from '../../../../supabase/functions/_shared/supplierStatus';
import { supplierBatchCode } from '@/modules/supplier/display';
import { tidyStoredName } from '@/shared/lib/personName';
import { depositAgeDays, formatStageDate, STONE_OVERDUE_AFTER_DAYS } from './stageTone';

/** One set of words for the chip, the supplier filter, and the order panel. */
export const NOT_ORDERED_YET = 'Not ordered yet';
export const ORDERED_NOT_ON_BOARD = 'Ordered, not on supplier board';
export const MATCH_CONFIRM = 'Possible match · confirm?';
const DASH = '—';

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

function notOrderedDetail(order: StoneSupplierOrder, now: Date): string {
  const age = depositAgeDays(order.depositDate, order.jobPaidAt, now);
  if (age == null) return '';
  if (age > STONE_OVERDUE_AFTER_DAYS) return `overdue ${age}d`;
  if (age <= 0) return 'needed today';
  return `needed in ${age}d`;
}

/**
 * First matching row wins.
 * A possible match is decided before the generic "not ordered" rows, so a
 * pending match is never offered as a fresh order.
 * A confirmed board status is shown ahead of "not ordered", because the
 * supplier already has the stone.
 * "Ordered, not on supplier board" is only when we marked it ordered and the
 * loaded board has no confirmed row. A stone we have not ordered yet says
 * "Not ordered yet", with the days kept as extra detail.
 */
function knownSchedule(board: SupplierRollup | null | undefined, now: Date): string {
  if (!board?.deliveryDate && !board?.deliveryEstimate) return '';
  if (board.deliveryDate) {
    const due = formatStageDate(board.deliveryDate, now);
    return due ? `due ${due}` : '';
  }
  const estimate = board.deliveryEstimate?.trim() ?? '';
  if (!estimate) return '';
  const parsed = formatStageDate(estimate, now);
  return parsed ? `eta ${parsed}` : estimate;
}

function chipDetail(board: SupplierRollup | null | undefined, now: Date, batch: string): string {
  return knownSchedule(board, now) || batch;
}

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
    return { tone: 'wait', label: 'In production', detail: chipDetail(board, now, batch) };
  }
  if (linked && boardStatus === 'transit') {
    return { tone: 'wait', label: 'In transit', detail: chipDetail(board, now, batch) };
  }
  if (linked && boardStatus === 'arrived') {
    const when = board?.deliveryDate ? formatStageDate(board.deliveryDate, now) : null;
    const estimate = !when ? knownSchedule(board, now) : '';
    return { tone: 'done', label: 'Arrived', detail: when ?? estimate };
  }
  if (linked && boardStatus === 'waiting') {
    return { tone: 'wait', label: 'Waiting', detail: chipDetail(board, now, batch) };
  }
  if (board && !linked && status === MARKED_ORDERED) {
    const ordered = formatStageDate(order.stoneOrderedAt, now);
    return { tone: 'over', label: ORDERED_NOT_ON_BOARD, detail: ordered ? `ord ${ordered}` : '' };
  }
  if (status === MARKED_ORDERED && (!board || (linked && !boardStatus))) {
    return { tone: 'done', label: 'Ordered', detail: chipDetail(board, now, batch) };
  }
  if (notOrdered(status)) {
    const age = depositAgeDays(order.depositDate, order.jobPaidAt, now);
    const overdue = age != null && age > STONE_OVERDUE_AFTER_DAYS;
    return {
      tone: overdue ? 'over' : 'needs',
      label: NOT_ORDERED_YET,
      detail: notOrderedDetail(order, now),
    };
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
  label: 'Name' | 'Product' | 'Size' | 'Material' | 'Parts' | 'Job code' | 'Batch' | 'Status' | 'Delivery';
  ours: string;
  theirs: string;
  matched: boolean;
}

export interface SupplierMatchOrder {
  deceasedName?: string | null;
  customer?: string | null;
  dimensions?: string | null;
  material?: string | null;
  color?: string | null;
  stoneStatus?: string | null;
  productName?: string | null;
  type?: string | null;
  orderNumber?: number | string | null;
  dueDate?: string | null;
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

function sizeIn(text: string | null | undefined): string {
  return text?.match(/\d+\s*[×x]\s*\d+(?:\s*[×x]\s*\d+)?(?:\s*in)?/i)?.[0]?.replace(/\s+/g, ' ').trim() ?? '';
}

export function supplierMatchHeading(board: SupplierRollup): string {
  const batch = supplierBatchCode(board);
  return batch ? `Supplier board · batch ${batch}` : 'Supplier board';
}

const PRODUCT_NOISE = new Set(['memorial', 'headstone', 'stone', 'new', 'the', 'and', 'with']);

function dash(value: string): string {
  const trimmed = value.trim();
  return trimmed || DASH;
}

function wordIn(hay: string, word: string): boolean {
  if (word.length < 3) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(hay);
}

function productTokens(value: string): string[] {
  return norm(value).split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !PRODUCT_NOISE.has(word));
}

function ourPeople(order: SupplierMatchOrder): { line: string; customer: string; deceased: string } {
  const customer = tidyStoredName(order.customer);
  const deceased = tidyStoredName(order.deceasedName);
  const line = customer && deceased && norm(customer) !== norm(deceased)
    ? `${customer} (deceased ${deceased})`
    : deceased || customer;
  return { line, customer, deceased };
}

function ourJobLabel(orderNumber: number | string | null | undefined): string {
  if (orderNumber == null) return '';
  const raw = String(orderNumber).trim();
  if (!raw) return '';
  if (/^ORD-/i.test(raw)) return raw.toUpperCase();
  const digits = raw.replace(/\D/g, '');
  return digits ? `ORD-${digits.padStart(6, '0')}` : raw;
}

/** Mason column beside the supplier column. Empty cells are an em dash. */
export function supplierMatchFields(order: SupplierMatchOrder, board: SupplierRollup): SupplierMatchField[] {
  const part = board.parts.find((row) => row.description && !isJobCodeLabel(row.description));
  const reference = board.suggestions[0]?.reference?.trim() || '';
  const theirName = reference || part?.description || '';
  const people = ourPeople(order);
  const nameMatched = [people.deceased, people.customer].some((name) => wordIn(theirName, surnameOf(name)));

  const ourProduct = tidyStoredName(order.productName) || tidyStoredName(order.type);
  const theirProduct = (part?.description || '').replace(/\d+\s*[×x]\s*\d+(?:\s*[×x]\s*\d+)?(?:\s*in)?/gi, ' ').replace(/\s+/g, ' ').trim();
  const productHay = `${theirProduct} ${theirName}`;
  const productMatched = !!theirProduct && productTokens(ourProduct).some((token) => wordIn(productHay, token));

  const theirSize = sizeIn(part?.description) || sizeIn(theirName);
  const ourSize = (order.dimensions || '').trim();
  const sizeMatched = same(theirSize.replace(/\s+/g, ''), ourSize.replace(/\s+/g, ''));

  const materialBits = [order.material, order.color].map((value) => (value || '').trim()).filter(Boolean);
  const blob = norm(`${part?.description ?? ''} ${theirName}`);
  const found = materialBits.filter((bit) => blob.includes(norm(bit)));
  const materialMatched = found.length > 0;

  const realParts = board.parts.filter((row) => row.description && !isJobCodeLabel(row.description));
  const theirParts = realParts.length === 0
    ? ''
    : realParts.length === 1
      ? '1 part'
      : `${realParts.length} parts`;

  const jobCodes = [...board.jobCodes, board.suggestions[0]?.jobCode ?? ''].map((code) => code?.trim()).filter(Boolean) as string[];
  const numberInName = theirName.match(/\b\d{3,}\b/)?.[0] ?? '';
  const theirJob = [...new Set(jobCodes)].join(', ') || numberInName;
  const ourJob = ourJobLabel(order.orderNumber);
  const ourDigits = ourJob.replace(/\D/g, '').replace(/^0+/, '');
  const jobMatched = !!ourDigits && (
    theirJob.replace(/\D/g, '').includes(ourDigits) || theirName.replace(/\D/g, '').includes(ourDigits)
  );

  const theirBatch = board.batchCodes.map((code) => code.trim()).filter(Boolean).join(', ');
  const theirDelivery = board.deliveryDate
    ? (formatStageDate(board.deliveryDate) ?? board.deliveryDate)
    : (board.deliveryEstimate?.trim() || '');
  const ourDelivery = order.dueDate ? (formatStageDate(order.dueDate) ?? order.dueDate) : '';

  const ourStatus = order.stoneStatus === IN_STOCK
    ? 'In stock'
    : order.stoneStatus === MARKED_ORDERED
      ? 'Ordered'
      : NOT_ORDERED_YET;

  return [
    { label: 'Name', ours: dash(people.line), theirs: dash(theirName), matched: nameMatched },
    { label: 'Product', ours: dash(ourProduct), theirs: dash(theirProduct), matched: productMatched },
    { label: 'Size', ours: dash(ourSize), theirs: dash(theirSize), matched: sizeMatched },
    { label: 'Material', ours: dash(materialBits.join(' · ')), theirs: dash(found.join(' · ')), matched: materialMatched },
    { label: 'Parts', ours: DASH, theirs: dash(theirParts), matched: false },
    { label: 'Job code', ours: dash(ourJob), theirs: dash(theirJob), matched: jobMatched },
    { label: 'Batch', ours: DASH, theirs: dash(theirBatch), matched: false },
    { label: 'Status', ours: ourStatus, theirs: MATCH_CONFIRM, matched: false },
    { label: 'Delivery', ours: dash(ourDelivery), theirs: dash(theirDelivery), matched: !!ourDelivery && same(ourDelivery, theirDelivery) },
  ];
}

/** Plain sentence of the fields that actually agree. Status is never a reason. */
export function supplierMatchWhy(fields: SupplierMatchField[]): string {
  const hit = fields.filter((field) => field.matched).map((field) => field.label.toLowerCase());
  if (hit.length === 0) return 'Why we think it matches: no shared fields.';
  return `Why we think it matches: ${hit.join(', ')}.`;
}

export function matchLinkId(board: SupplierRollup | null | undefined): string | null {
  return board?.suggestions[0]?.linkId ?? null;
}
