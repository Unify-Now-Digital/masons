/**
 * Ogee supplier board (Monday.com) → one status label per Mason order.
 * Pure: the edge function and the Orders UI both use this file.
 *
 * Board 895721886. A job reference like "233 LINDSEY SM" matches an order
 * number and/or a surname. High confidence (number + surname + SM) links
 * itself. Anything weaker waits for a person to confirm it.
 * The order label is the most advanced part. "+N parts" counts the others.
 * A delivery date is shown only when DELIVERY SCH is a real date.
 */

export const OGEE_BOARD_ID = '895721886';

export type NormalizedStatus = 'waiting' | 'production' | 'transit' | 'arrived';
export type MatchConfidence = 'high' | 'medium' | 'low';
export type LinkStatus = 'auto' | 'confirmed' | 'suggested' | 'rejected';

export const STATUS_RANK: Record<NormalizedStatus, number> = {
  waiting: 1,
  production: 2,
  transit: 3,
  arrived: 4,
};

export const STATUS_LABEL: Record<NormalizedStatus, string> = {
  waiting: 'Waiting',
  production: 'In production',
  transit: 'In transit',
  arrived: 'Arrived',
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const JOB_CODE_RE = /\b(M\d+R\d+)\b/i;

export interface ParsedReference {
  orderNumber: number | null;
  hasSm: boolean;
  tokens: string[];
  surname: string | null;
}

export interface MasonOrderRef {
  id: string;
  orderNumber: number | null;
  /** Deceased name (orders.customer_name). */
  customerName: string | null;
  /** Living customer (orders.person_name). */
  personName: string | null;
  productName: string | null;
}

export interface PlannedLink {
  orderId: string;
  confidence: MatchConfidence;
  rule: string;
  linkStatus: 'auto' | 'suggested';
}

export interface RawBoardItem {
  id?: string | number | null;
  name?: string | null;
  group?: string | { id?: string; title?: string | null } | null;
  parent_id?: string | number | null;
  parentId?: string | number | null;
  job_code?: string | null;
  status?: string | null;
  batch?: string | null;
  container?: string | null;
  delivery_sch?: string | null;
  reference?: string | null;
  customer_reference?: string | null;
  columns?: { title?: string | null; text?: string | null; column?: { title?: string | null } | null }[] | null;
  column_values?: { title?: string | null; text?: string | null; column?: { title?: string | null } | null }[] | null;
  subitems?: RawBoardItem[] | null;
}

export interface ParsedItem {
  boardItemId: string;
  parentId: string | null;
  name: string;
  jobCode: string | null;
  statusRaw: string | null;
  normalizedStatus: NormalizedStatus | null;
  batchCode: string | null;
  containerCode: string | null;
  deliverySch: string | null;
  deliveryDate: string | null;
  deliveryEstimate: string | null;
  reference: string | null;
  groupTitle: string | null;
}

export interface PartDraft {
  boardItemId: string;
  description: string;
  statusRaw: string | null;
  normalizedStatus: NormalizedStatus | null;
}

export interface JobDraft {
  boardItemId: string;
  jobCode: string | null;
  customerReference: string | null;
  batchCode: string | null;
  containerCode: string | null;
  deliverySch: string | null;
  deliveryDate: string | null;
  deliveryEstimate: string | null;
  groupTitle: string | null;
  normalizedStatus: NormalizedStatus | null;
  parts: PartDraft[];
}

export interface RollupPart {
  description: string;
  jobCode: string | null;
  statusLabel: string;
  tone: NormalizedStatus | 'possible';
  drives: boolean;
}

export interface RollupSuggestion {
  linkId: string;
  confidence: MatchConfidence;
  rule: string;
  jobCode: string | null;
  reference: string | null;
}

export interface SupplierRollup {
  kind: 'linked' | 'suggested' | 'none';
  status: NormalizedStatus | null;
  statusLabel: string;
  tone: NormalizedStatus | 'possible';
  otherParts: number;
  deliveryDate: string | null;
  deliveryEstimate: string | null;
  stale: boolean;
  syncedAt: string | null;
  jobCodes: string[];
  batchCodes: string[];
  containerCodes: string[];
  parts: RollupPart[];
  suggestions: RollupSuggestion[];
}

export interface JobForRollup {
  id: string;
  jobCode: string | null;
  customerReference: string | null;
  batchCode: string | null;
  containerCode: string | null;
  normalizedStatus: NormalizedStatus | null;
  deliveryDate: string | null;
  deliveryEstimate: string | null;
  syncedAt: string | null;
  stale: boolean;
  parts: { description: string | null; normalizedStatus: NormalizedStatus | null }[];
}

export interface LinkForRollup {
  id: string;
  orderId: string;
  jobId: string;
  confidence: MatchConfidence;
  rule: string;
  linkStatus: LinkStatus;
}

export function normalizeStatus(raw: string | null | undefined): NormalizedStatus | null {
  const text = (raw ?? '').trim().toLowerCase();
  if (!text) return null;
  if (/arriv|deliver|received|landed|\bdone\b|complete/.test(text)) return 'arrived';
  if (/transit|ship|despatch|dispatch/.test(text)) return 'transit';
  if (/prod|work|mak|progress|\bcut\b/.test(text)) return 'production';
  if (/wait|hold|queue|not started|pending|block/.test(text)) return 'waiting';
  return null;
}

function ymd(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** A confirmed date, or free text kept as an estimate. Estimates are never dates. */
export function parseDelivery(raw: string | null | undefined): { date: string | null; estimate: string | null } {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { date: null, estimate: null };
  const iso = /^(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) {
    const date = ymd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (date) return { date, estimate: null };
  }
  const uk = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (uk) {
    const date = ymd(Number(uk[3]), Number(uk[2]), Number(uk[1]));
    if (date) return { date, estimate: null };
  }
  const long = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(text);
  if (long) {
    const month = MONTHS[long[2].slice(0, 3).toLowerCase()];
    const date = month ? ymd(Number(long[3]), month, Number(long[1])) : null;
    if (date) return { date, estimate: null };
  }
  return { date: null, estimate: text.slice(0, 80) };
}

export function parseReference(raw: string | null | undefined): ParsedReference {
  const text = (raw ?? '').trim();
  const hasSm = /\bSM\b/i.test(text);
  const stripped = text.replace(/\bSM\b/gi, ' ');
  const tokens = stripped
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((token) => /[A-Z]/.test(token) && !/^\d+$/.test(token));
  let orderNumber: number | null = null;
  const lead = /^(\d{2,6})\b/.exec(stripped.trim());
  if (lead) orderNumber = Number(lead[1]);
  else {
    const numeric = stripped.toUpperCase().split(/[^A-Z0-9]+/).find((token) => /^\d{2,6}$/.test(token));
    if (numeric) orderNumber = Number(numeric);
  }
  return {
    orderNumber,
    hasSm,
    tokens,
    surname: tokens.length ? tokens[tokens.length - 1] : null,
  };
}

export function shouldKeepReference(reference: string | null | undefined): boolean {
  const parsed = parseReference(reference);
  return parsed.hasSm || parsed.orderNumber != null;
}

function alphaTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((token) => /[A-Z]/.test(token) && token.length >= 2 && !/^\d+$/.test(token));
}

function lastToken(value: string | null | undefined): string | null {
  const tokens = alphaTokens(value);
  return tokens.length ? tokens[tokens.length - 1] : null;
}

function firstToken(value: string | null | undefined): string | null {
  const tokens = alphaTokens(value);
  return tokens.length ? tokens[0] : null;
}

function firstNameHit(token: string, first: string | null): boolean {
  if (!first || token.length < 3 || first.length < 3) return false;
  return token === first || first.startsWith(token) || token.startsWith(first);
}

interface Scored {
  orderId: string;
  confidence: MatchConfidence;
  rule: string;
}

export function scoreOrder(reference: string | null | undefined, order: MasonOrderRef): Scored | null {
  const parsed = parseReference(reference);
  if (!parsed.hasSm && parsed.orderNumber == null) return null;
  const surnames = [lastToken(order.customerName), lastToken(order.personName)].filter((token): token is string => !!token);
  const firsts = [firstToken(order.customerName), firstToken(order.personName)].filter((token): token is string => !!token);
  const products = alphaTokens(order.productName).filter((token) => token.length >= 4);
  const surnameHit = parsed.tokens.some((token) => surnames.includes(token));
  const productHit = parsed.tokens.some((token) => products.includes(token));
  const firstHit = parsed.tokens.some((token) => firsts.some((first) => firstNameHit(token, first)));
  const orderNoHit = parsed.orderNumber != null && order.orderNumber != null && parsed.orderNumber === order.orderNumber;
  if (!orderNoHit && !surnameHit && !productHit && !firstHit) return null;

  if (orderNoHit && surnameHit && parsed.hasSm) return { orderId: order.id, confidence: 'high', rule: 'order+surname+sm' };
  if (orderNoHit && surnameHit) return { orderId: order.id, confidence: 'medium', rule: 'order+surname' };
  if (orderNoHit && parsed.hasSm) return { orderId: order.id, confidence: 'medium', rule: 'order+sm' };
  if (orderNoHit) return { orderId: order.id, confidence: 'medium', rule: 'order_number' };
  if (surnameHit && parsed.hasSm && productHit) return { orderId: order.id, confidence: 'medium', rule: 'product+surname+sm' };
  if (productHit && firstHit && parsed.hasSm) return { orderId: order.id, confidence: 'medium', rule: 'product+first+sm' };
  if (surnameHit && parsed.hasSm) return { orderId: order.id, confidence: 'medium', rule: 'surname+sm' };
  if (productHit && surnameHit) return { orderId: order.id, confidence: 'medium', rule: 'product+surname' };
  if (surnameHit) return { orderId: order.id, confidence: 'low', rule: 'surname' };
  if (firstHit) return { orderId: order.id, confidence: 'low', rule: 'first_name' };
  return null;
}

const CONF_RANK: Record<MatchConfidence, number> = { high: 3, medium: 2, low: 1 };

/** One auto link when a single order is high. Ties and weaker hits stay suggested. */
export function planLinks(reference: string | null | undefined, orders: MasonOrderRef[]): PlannedLink[] {
  const scored = orders
    .map((order) => scoreOrder(reference, order))
    .filter((row): row is Scored => !!row);
  const highs = scored.filter((row) => row.confidence === 'high');
  if (highs.length === 1) {
    return [{ orderId: highs[0].orderId, confidence: 'high', rule: highs[0].rule, linkStatus: 'auto' }];
  }
  if (highs.length > 1) {
    return highs.map((row) => ({
      orderId: row.orderId,
      confidence: 'medium',
      rule: `${row.rule}+ambiguous`,
      linkStatus: 'suggested',
    }));
  }
  if (!scored.length) return [];
  const best = Math.max(...scored.map((row) => CONF_RANK[row.confidence]));
  const tied = scored.filter((row) => CONF_RANK[row.confidence] === best);
  if (tied.length > 4) return [];
  return tied.map((row) => ({
    orderId: row.orderId,
    confidence: row.confidence,
    rule: row.rule,
    linkStatus: 'suggested',
  }));
}

function normTitle(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function columnText(item: RawBoardItem, titles: string[]): string | null {
  const cols = [...(item.columns ?? []), ...(item.column_values ?? [])];
  for (const col of cols) {
    const title = normTitle(col.title || col.column?.title);
    if (!titles.includes(title)) continue;
    const text = (col.text ?? '').trim();
    if (text) return text;
  }
  return null;
}

function firstText(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const text = (value ?? '').trim();
    if (text) return text;
  }
  return null;
}

function groupTitleOf(group: RawBoardItem['group']): string | null {
  if (!group) return null;
  if (typeof group === 'string') return group.trim() || null;
  return (group.title ?? '').trim() || null;
}

export function parseBoardItem(item: RawBoardItem, parentId: string | null): ParsedItem | null {
  const boardItemId = item.id == null ? '' : String(item.id).trim();
  if (!boardItemId) return null;
  const name = (item.name ?? '').trim();
  const groupTitle = groupTitleOf(item.group);
  const jobFromName = JOB_CODE_RE.exec(name)?.[1] ?? null;
  const jobCode = (
    firstText(item.job_code, columnText(item, ['job code', 'job no', 'job number', 'job']), jobFromName) ?? ''
  ).toUpperCase() || null;
  const statusRaw = firstText(item.status, columnText(item, ['status', 'state']));
  const batchRaw = firstText(item.batch, columnText(item, ['shipping batch', 'batch', 'shipment']));
  const containerRaw = firstText(item.container, columnText(item, ['container', 'container no', 'container number']));
  const deliveryRaw = firstText(item.delivery_sch, columnText(item, ['delivery sch', 'delivery schedule', 'delivery date', 'delivery']));
  const delivery = parseDelivery(deliveryRaw);
  const groupDelivery = delivery.date ? { date: null, estimate: null } : parseDelivery(groupTitle);
  const reference = firstText(
    item.reference,
    item.customer_reference,
    columnText(item, ['customer reference', 'customer ref', 'reference', 'cust ref']),
  );
  const ownParent = item.parent_id ?? item.parentId;
  return {
    boardItemId,
    parentId: parentId || (ownParent == null ? null : String(ownParent).trim() || null),
    name: name || jobCode || boardItemId,
    jobCode: jobCode && JOB_CODE_RE.test(jobCode) ? (JOB_CODE_RE.exec(jobCode)?.[1] ?? jobCode).toUpperCase() : jobCode,
    statusRaw,
    normalizedStatus: normalizeStatus(statusRaw),
    batchCode: batchRaw,
    containerCode: containerRaw,
    deliverySch: deliveryRaw,
    deliveryDate: delivery.date,
    deliveryEstimate: delivery.date ? null : (delivery.estimate ?? groupDelivery.estimate),
    reference,
    groupTitle,
  };
}

export function parseBoardItems(raw: RawBoardItem[]): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const item of raw) {
    const parsed = parseBoardItem(item, null);
    if (parsed) out.push(parsed);
    for (const sub of item.subitems ?? []) {
      const child = parseBoardItem(sub, parsed?.boardItemId ?? null);
      if (child) out.push(child);
    }
  }
  return out;
}

function referenceRank(reference: string): number {
  const parsed = parseReference(reference);
  return (parsed.orderNumber != null ? 4 : 0) + (parsed.hasSm ? 2 : 0) + (parsed.tokens.length ? 1 : 0);
}

function earliest(dates: (string | null | undefined)[]): string | null {
  const ok = dates.filter((date): date is string => !!date).sort();
  return ok[0] ?? null;
}

function mostAdvanced(statuses: (NormalizedStatus | null | undefined)[]): NormalizedStatus | null {
  let best: NormalizedStatus | null = null;
  for (const status of statuses) {
    if (!status) continue;
    if (!best || STATUS_RANK[status] > STATUS_RANK[best]) best = status;
  }
  return best;
}

export function groupJobs(items: ParsedItem[]): JobDraft[] {
  const groups = new Map<string, ParsedItem[]>();
  for (const item of items) {
    const key = item.parentId
      ? `parent:${item.parentId}`
      : item.jobCode
        ? `job:${item.jobCode}`
        : `item:${item.boardItemId}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const drafts: JobDraft[] = [];
  for (const [key, list] of groups) {
    const references = list.map((item) => item.reference).filter((ref): ref is string => !!ref);
    references.sort((a, b) => referenceRank(b) - referenceRank(a));
    const customerReference = references[0] ?? null;
    if (!shouldKeepReference(customerReference)) continue;
    const jobCode = list.find((item) => item.jobCode)?.jobCode ?? null;
    const deliveryDate = earliest(list.map((item) => item.deliveryDate));
    const deliveryEstimate = deliveryDate ? null : (list.find((item) => item.deliveryEstimate)?.deliveryEstimate ?? null);
    drafts.push({
      boardItemId: key,
      jobCode,
      customerReference,
      batchCode: list.find((item) => item.batchCode)?.batchCode ?? null,
      containerCode: list.find((item) => item.containerCode)?.containerCode ?? null,
      deliverySch: list.find((item) => item.deliverySch)?.deliverySch ?? null,
      deliveryDate,
      deliveryEstimate,
      groupTitle: list.find((item) => item.groupTitle)?.groupTitle ?? null,
      normalizedStatus: mostAdvanced(list.map((item) => item.normalizedStatus)),
      parts: list.map((item) => ({
        boardItemId: item.boardItemId,
        description: item.name,
        statusRaw: item.statusRaw,
        normalizedStatus: item.normalizedStatus,
      })),
    });
  }
  return drafts;
}

function partRows(job: JobForRollup): { description: string; jobCode: string | null; normalizedStatus: NormalizedStatus | null; deliveryDate: string | null }[] {
  const parts = job.parts.length
    ? job.parts
    : [{ description: job.jobCode, normalizedStatus: job.normalizedStatus }];
  return parts.map((part) => ({
    description: (part.description ?? '').trim() || job.jobCode || 'Part',
    jobCode: job.jobCode,
    normalizedStatus: part.normalizedStatus ?? job.normalizedStatus,
    deliveryDate: job.deliveryDate,
  }));
}

export function emptyRollup(): SupplierRollup {
  return {
    kind: 'none',
    status: null,
    statusLabel: 'Not on supplier board',
    tone: 'waiting',
    otherParts: 0,
    deliveryDate: null,
    deliveryEstimate: null,
    stale: false,
    syncedAt: null,
    jobCodes: [],
    batchCodes: [],
    containerCodes: [],
    parts: [],
    suggestions: [],
  };
}

/** One label for an order. Confirmed and auto links drive it; suggestions never do. */
export function rollupForOrder(orderId: string, links: LinkForRollup[], jobs: JobForRollup[]): SupplierRollup {
  const mine = links.filter((link) => link.orderId === orderId && link.linkStatus !== 'rejected');
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const usable = mine.filter((link) => link.linkStatus === 'auto' || link.linkStatus === 'confirmed');
  const chosen = usable.length ? usable : mine.filter((link) => link.linkStatus === 'suggested');
  if (!chosen.length) return emptyRollup();
  const kind: SupplierRollup['kind'] = usable.length ? 'linked' : 'suggested';
  const related = chosen
    .map((link) => byId.get(link.jobId))
    .filter((job): job is JobForRollup => !!job);
  if (!related.length) return emptyRollup();
  const flat = related.flatMap(partRows);
  const driving = [...flat].sort((a, b) => {
    const rankA = a.normalizedStatus ? STATUS_RANK[a.normalizedStatus] : 0;
    const rankB = b.normalizedStatus ? STATUS_RANK[b.normalizedStatus] : 0;
    if (rankA !== rankB) return rankB - rankA;
    return (a.deliveryDate ?? '9999-99-99').localeCompare(b.deliveryDate ?? '9999-99-99');
  })[0];
  const status = driving?.normalizedStatus ?? null;
  const suggestedLabel = 'Possible match · confirm?';
  const synced = related.map((job) => job.syncedAt).filter((value): value is string => !!value).sort();
  return {
    kind,
    status,
    statusLabel: kind === 'suggested' ? suggestedLabel : (status ? STATUS_LABEL[status] : 'Waiting'),
    tone: kind === 'suggested' ? 'possible' : (status ?? 'waiting'),
    otherParts: Math.max(0, flat.length - 1),
    deliveryDate: earliest(related.map((job) => job.deliveryDate)),
    deliveryEstimate: earliest(related.map((job) => job.deliveryDate))
      ? null
      : (related.find((job) => job.deliveryEstimate)?.deliveryEstimate ?? null),
    stale: related.some((job) => job.stale),
    syncedAt: synced.length ? synced[synced.length - 1] : null,
    jobCodes: [...new Set(related.map((job) => job.jobCode).filter((code): code is string => !!code))],
    batchCodes: [...new Set(related.map((job) => job.batchCode).filter((code): code is string => !!code))],
    containerCodes: [...new Set(related.map((job) => job.containerCode).filter((code): code is string => !!code))],
    parts: flat.map((part) => ({
      description: part.description,
      jobCode: part.jobCode,
      statusLabel: part.normalizedStatus ? STATUS_LABEL[part.normalizedStatus] : 'Waiting',
      tone: part.normalizedStatus ?? 'waiting',
      drives: part === driving,
    })),
    suggestions: kind === 'suggested'
      ? chosen.map((link) => {
          const job = byId.get(link.jobId);
          return {
            linkId: link.id,
            confidence: link.confidence,
            rule: link.rule,
            jobCode: job?.jobCode ?? null,
            reference: job?.customerReference ?? null,
          };
        })
      : [],
  };
}
