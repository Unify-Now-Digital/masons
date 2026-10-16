/** Inline email image we can retarget when the message recorded an attachment URL. */
export interface CidAttachment {
  contentId?: string | null;
  cid?: string | null;
  url?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/** Pull content-id → URL pairs out of message.meta when a sync stored them. */
export function attachmentsFromMeta(meta: unknown): CidAttachment[] {
  const root = asRecord(meta);
  if (!root) return [];
  const gmail = asRecord(root.gmail);
  const buckets = [root.attachments, root.inlineAttachments, root.inline, gmail?.attachments, gmail?.inline];
  const out: CidAttachment[] = [];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      const row = asRecord(item);
      if (!row) continue;
      out.push({
        contentId: pickString(row, ['contentId', 'content_id', 'cid', 'contentID']),
        url: pickString(row, ['url', 'downloadUrl', 'download_url', 'publicUrl', 'public_url']),
      });
    }
  }
  return out;
}

function cidToken(src: string): string {
  return src.replace(/^cid:/i, '').replace(/^<|>$/g, '').trim().toLowerCase();
}

/** https, blob, or a data-image URL. cid: is not loadable inside the preview frame. */
function safeImageUrl(url: string): boolean {
  if (/["'<>\s]/.test(url)) return false;
  return /^https:\/\//i.test(url) || /^blob:/i.test(url) || /^data:image\/[a-z0-9.+-]+;/i.test(url);
}

const SRC_ATTR = /\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i;

/**
 * Point cid: images at a stored attachment URL. Anything still cid: is hidden
 * so the preview frame never requests it (the CSP would block it and log an error).
 */
export function rewriteCidImages(html: string, attachments?: readonly CidAttachment[] | null): string {
  if (!html || !/cid:/i.test(html)) return html;
  const byCid = new Map<string, string>();
  for (const item of attachments ?? []) {
    const id = cidToken(String(item.contentId ?? item.cid ?? ''));
    const url = (item.url ?? '').trim();
    if (id && safeImageUrl(url)) byCid.set(id, url);
  }
  const withoutCssCid = html.replace(/url\(\s*(['"]?)cid:[^)'"]+\1\s*\)/gi, 'none');
  return withoutCssCid.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch = tag.match(SRC_ATTR);
    if (!srcMatch) return tag;
    const src = (srcMatch[2] ?? srcMatch[3] ?? srcMatch[4] ?? '').trim();
    if (!src.toLowerCase().startsWith('cid:')) return tag;
    const url = byCid.get(cidToken(src));
    if (url) {
      const quoted = srcMatch[1].startsWith("'") ? `'${url}'` : `"${url}"`;
      return tag.replace(srcMatch[0], `src=${quoted}`);
    }
    const withoutSrc = tag.replace(SRC_ATTR, '').replace(/\s*\/?>$/, '');
    return `${withoutSrc} alt="" hidden>`;
  });
}
