/**
 * Stage tone, glyph, short label and hover facts for an order (IA-8.2, IA-10.8).
 * Every stored status is mapped explicitly. The only fallback is `none`.
 * Missing dates are omitted. This module never prints a placeholder mark.
 *
 * Stone does not wait on proof or permit. There is no council turnaround,
 * so a permit is never marked overdue from age alone.
 */

export type StageKey = 'permit' | 'proof' | 'stone' | 'fixing';
export type StageToneName = 'done' | 'waiting' | 'needs' | 'overdue' | 'none';
export type GlyphState = 'done' | 'preapproved' | 'needs' | 'waiting' | 'overdue' | 'none';

/** Stone not ordered is overdue this many days after the deposit (IA-10.3). */
export const STONE_OVERDUE_AFTER_DAYS = 21;

export interface StageInput {
  permitStatus?: string | null;
  /** UI-only until a column exists. Standing cemetery approval for this product or size. */
  permitPreapproved?: boolean | null;
  permitFormSentAt?: string | null;
  permitSubmittedAt?: string | null;
  permitApprovedAt?: string | null;
  cemeteryName?: string | null;
  location?: string | null;
  proofStatus?: string | null;
  /** Not stored. Passed through so a future version can escalate the tone. */
  proofVersion?: number | null;
  proofUploadedAt?: string | null;
  inscriptionText?: string | null;
  inscriptionStatus?: string | null;
  stoneStatus?: string | null;
  /** Not stored. */
  stoneOrderedAt?: string | null;
  /** Not stored. */
  stoneEta?: string | null;
  /** Not stored. */
  stoneDeliveredAt?: string | null;
  depositDate?: string | null;
  jobPaidAt?: string | null;
  installationDate?: string | null;
}

export interface HoverRow {
  label: string;
  value: string;
}

export interface StageView {
  tone: StageToneName;
  glyph: GlyphState;
  symbol: string;
  word: string;
  /** Pill detail. Null when the date or version is not stored. */
  detail: string | null;
  detailBold: boolean;
  /** Inscription tag replaces the detail when the text is missing. */
  inscriptionMissing: boolean;
  aria: string;
  hover: HoverRow[];
}

const DAY = 86_400_000;

export function depositAgeDays(
  depositDate: string | null | undefined,
  jobPaidAt: string | null | undefined,
  now: Date,
): number | null {
  const raw = (depositDate && depositDate.trim()) || (jobPaidAt && jobPaidAt.trim()) || '';
  if (!raw) return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / DAY);
}

function parseIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** `6 Nov`. Null when the value is missing or unparseable. */
export function formatStageDate(iso: string | null | undefined): string | null {
  if (!iso || !iso.trim()) return null;
  const d = parseIso(iso);
  if (!d) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
}

/** `3 October`, for the button aria-label. */
export function formatStageDateLong(iso: string | null | undefined): string | null {
  if (!iso || !iso.trim()) return null;
  const d = parseIso(iso);
  if (!d) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(d);
}

export function stageGlyph(state: GlyphState): { symbol: string; tone: StageToneName } {
  switch (state) {
    case 'done': return { symbol: '✓', tone: 'done' };
    case 'preapproved': return { symbol: '★', tone: 'done' };
    case 'needs': return { symbol: '●', tone: 'needs' };
    case 'waiting': return { symbol: '◷', tone: 'waiting' };
    case 'overdue': return { symbol: '!', tone: 'overdue' };
    case 'none': return { symbol: '○', tone: 'none' };
  }
}

function permitTone(status: string | null | undefined, preapproved: boolean): StageToneName {
  if (preapproved) return 'done';
  switch (status) {
    case 'approved': return 'done';
    case 'pending': return 'waiting';
    case 'form_sent': return 'waiting';
    case 'customer_completed': return 'needs';
    case 'ready_to_submit': return 'needs';
    case 'returned_incomplete': return 'needs';
    case 'not_started': return 'none';
    case 'NA': return 'none';
    case '': return 'none';
    case null: return 'none';
    case undefined: return 'none';
    default: return 'none';
  }
}

function proofTone(status: string | null | undefined): StageToneName {
  switch (status) {
    case 'Approved': return 'done';
    case 'Lettered': return 'done';
    case 'Sent': return 'waiting';
    case 'Not_Received': return 'needs';
    case 'Received': return 'needs';
    case 'In_Progress': return 'needs';
    case 'Revision': return 'needs';
    case 'NA': return 'none';
    case '': return 'none';
    case null: return 'none';
    case undefined: return 'none';
    default: return 'none';
  }
}

function stoneTone(order: StageInput, now: Date): StageToneName {
  switch (order.stoneStatus) {
    case 'In Stock': return 'done';
    case 'Ordered': return 'waiting';
    case 'NA':
    case '':
    case null:
    case undefined: {
      const age = depositAgeDays(order.depositDate, order.jobPaidAt, now);
      return age != null && age > STONE_OVERDUE_AFTER_DAYS ? 'overdue' : 'needs';
    }
    default: return 'none';
  }
}

function fixingTone(order: StageInput, now: Date): StageToneName {
  const raw = order.installationDate?.trim();
  if (!raw) return 'none';
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return 'none';
  const ahead = t - now.getTime();
  if (ahead < -DAY) return 'done';
  if (ahead <= 14 * DAY) return 'needs';
  return 'none';
}

export function stageTone(order: StageInput, stage: StageKey, now: Date = new Date()): StageToneName {
  switch (stage) {
    case 'permit': return permitTone(order.permitStatus, order.permitPreapproved === true);
    case 'proof': return proofTone(order.proofStatus);
    case 'stone': return stoneTone(order, now);
    case 'fixing': return fixingTone(order, now);
  }
}

/** ≤ 16 characters. Covers every permit, proof and stone status the app stores. */
export function stageShortLabel(
  stage: StageKey,
  status: string | null | undefined,
  flags?: { preapproved?: boolean; overdue?: boolean },
): string {
  if (stage === 'permit' && flags?.preapproved) return 'Pre-approved';
  if (stage === 'permit') {
    switch (status) {
      case 'approved': return 'Approved';
      case 'pending': return 'Council';
      case 'form_sent': return 'Family';
      case 'customer_completed': return 'Submit';
      case 'ready_to_submit': return 'Submit';
      case 'returned_incomplete': return 'Submit';
      case 'not_started': return 'Send form';
      case 'NA': return 'Send form';
      case '': return 'Send form';
      case null: return 'Send form';
      case undefined: return 'Send form';
      default: return 'Send form';
    }
  }
  if (stage === 'stone') {
    switch (status) {
      case 'In Stock': return 'Delivered';
      case 'Ordered': return 'Ordered';
      case 'NA':
      case '':
      case null:
      case undefined: return flags?.overdue ? 'Order now' : 'Order';
      default: return 'Order';
    }
  }
  if (stage === 'proof') {
    switch (status) {
      case 'Approved': return 'Approved';
      case 'Lettered': return 'Approved';
      case 'Sent': return 'Family';
      case 'Not_Received': return 'Drafting';
      case 'Received': return 'Drafting';
      case 'In_Progress': return 'Drafting';
      case 'Revision': return 'Drafting';
      case 'NA': return 'Drafting';
      case '': return 'Drafting';
      case null: return 'Drafting';
      case undefined: return 'Drafting';
      default: return 'Drafting';
    }
  }
  return 'Fixing';
}

function inscriptionRecorded(order: StageInput): boolean {
  return !!order.inscriptionText && order.inscriptionText.trim().length > 0;
}

function inscriptionHover(order: StageInput): string {
  const text = order.inscriptionText?.trim() ?? '';
  if (!text) return 'Not recorded';
  const n = text.length;
  const status = (order.inscriptionStatus ?? '').toLowerCase();
  const approved = status === 'confirmed' || status === 'final' || order.proofStatus === 'Approved' || order.proofStatus === 'Lettered';
  return `${n} letters · ${approved ? 'approved' : 'not approved'}`;
}

export function stageHoverRows(order: StageInput, stage: 'permit' | 'proof' | 'stone'): HoverRow[] {
  const rows: HoverRow[] = [];
  const push = (label: string, value: string | null | undefined) => {
    const v = value?.trim();
    if (v) rows.push({ label, value: v });
  };
  if (stage === 'permit') {
    push('Cemetery', order.cemeteryName || order.location || null);
    push('Sent to family', formatStageDateLong(order.permitFormSentAt));
    push('Submitted', formatStageDateLong(order.permitSubmittedAt));
    push('Approved', formatStageDateLong(order.permitApprovedAt));
    return rows;
  }
  if (stage === 'stone') {
    push('Ordered', formatStageDateLong(order.stoneOrderedAt));
    push('ETA', formatStageDateLong(order.stoneEta));
    push('Delivered', formatStageDateLong(order.stoneDeliveredAt));
    return rows;
  }
  push('Version', order.proofVersion != null && order.proofVersion > 0 ? `v${order.proofVersion}` : null);
  push('Sent', formatStageDateLong(order.proofUploadedAt));
  rows.push({ label: 'Inscription', value: inscriptionHover(order) });
  return rows;
}

function glyphFor(tone: StageToneName, preapproved: boolean): GlyphState {
  if (preapproved) return 'preapproved';
  switch (tone) {
    case 'done': return 'done';
    case 'waiting': return 'waiting';
    case 'needs': return 'needs';
    case 'overdue': return 'overdue';
    case 'none': return 'none';
  }
}

export function stagePresentation(order: StageInput, stage: 'permit' | 'proof' | 'stone', now: Date = new Date()): StageView {
  const preapproved = stage === 'permit' && order.permitPreapproved === true;
  let tone = stageTone(order, stage, now);
  const overdue = tone === 'overdue';
  const word = stageShortLabel(stage, stage === 'permit' ? order.permitStatus : stage === 'proof' ? order.proofStatus : order.stoneStatus, {
    preapproved,
    overdue,
  });

  let detail: string | null = null;
  let detailBold = false;
  if (stage === 'permit' && !preapproved) {
    if (order.permitStatus === 'approved') detail = formatStageDate(order.permitApprovedAt);
    else if (order.permitStatus === 'pending') detail = formatStageDate(order.permitSubmittedAt);
    else if (order.permitStatus === 'form_sent') detail = formatStageDate(order.permitFormSentAt);
  }
  if (stage === 'stone') {
    if (order.stoneStatus === 'Ordered') {
      const eta = formatStageDate(order.stoneEta);
      const ordered = formatStageDate(order.stoneOrderedAt);
      detail = eta ? `due ${eta}` : ordered ? `ord ${ordered}` : null;
    } else if (order.stoneStatus === 'In Stock') {
      detail = formatStageDate(order.stoneDeliveredAt);
    }
  }
  if (stage === 'proof' && order.proofVersion != null && order.proofVersion > 0 && tone !== 'done') {
    detail = `v${order.proofVersion}`;
    if (order.proofVersion >= 3) {
      detailBold = true;
      tone = 'needs';
    }
  }

  const inscriptionMissing = stage === 'proof' && !inscriptionRecorded(order);
  if (inscriptionMissing) detail = null;

  const glyph = glyphFor(tone, preapproved && tone === 'done');
  const symbol = stageGlyph(glyph).symbol;
  const ariaDetail = (() => {
    if (stage === 'permit' && order.permitStatus === 'approved' && order.permitApprovedAt) return formatStageDateLong(order.permitApprovedAt);
    if (stage === 'permit' && order.permitStatus === 'pending' && order.permitSubmittedAt) return formatStageDateLong(order.permitSubmittedAt);
    if (stage === 'permit' && order.permitStatus === 'form_sent' && order.permitFormSentAt) return formatStageDateLong(order.permitFormSentAt);
    if (stage === 'stone' && order.stoneStatus === 'Ordered' && order.stoneEta) return `due ${formatStageDateLong(order.stoneEta)}`;
    if (stage === 'stone' && order.stoneStatus === 'Ordered' && order.stoneOrderedAt) return `ord ${formatStageDateLong(order.stoneOrderedAt)}`;
    if (stage === 'stone' && order.stoneStatus === 'In Stock' && order.stoneDeliveredAt) return formatStageDateLong(order.stoneDeliveredAt);
    if (detail && detail.startsWith('v')) return detail;
    return null;
  })();
  const stageName = stage === 'permit' ? 'Permit' : stage === 'proof' ? 'Proof' : 'Stone';
  const aria = `${stageName}: ${word.toLowerCase()}${ariaDetail ? `, ${ariaDetail}` : ''}`;

  return {
    tone,
    glyph,
    symbol,
    word,
    detail,
    detailBold,
    inscriptionMissing,
    aria,
    hover: stageHoverRows(order, stage),
  };
}
