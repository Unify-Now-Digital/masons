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

function cidKey(token: string): string {
  return token.replace(/^cid:/i, '').replace(/^<|>$/g, '').trim().toLowerCase();
}

/** https, blob, or a data-image URL. cid: is not loadable inside the preview frame. */
function safeImageUrl(url: string): boolean {
  if (/["'<>\s]/.test(url)) return false;
  return /^https:\/\//i.test(url) || /^blob:/i.test(url) || /^data:image\/[a-z0-9.+-]+;/i.test(url);
}

/** `cid:…` token. Stops before quotes, markup, commas (srcset) and CSS closers. */
const CID_TOKEN = /cid:[^\s"'<>)\\,;]+/gi;

function attachmentMap(attachments?: readonly CidAttachment[] | null): Map<string, string> {
  const byCid = new Map<string, string>();
  for (const item of attachments ?? []) {
    const id = cidKey(String(item.contentId ?? item.cid ?? ''));
    const url = (item.url ?? '').trim();
    if (id && safeImageUrl(url)) byCid.set(id, url);
  }
  return byCid;
}

function resolveCid(token: string, byCid: Map<string, string>): string | null {
  return byCid.get(cidKey(token)) ?? null;
}

/**
 * Entity-encoded and quoted-printable colons still parse as the cid: scheme
 * once the frame decodes the attribute (`cid&#58;ii_…`, `cid=3Aii_…`).
 */
function normalizeCidScheme(html: string): string {
  return html
    .replace(/cid(?:&#0*58;|&#x0*3a;|&colon;)/gi, 'cid:')
    .replace(/cid=3a/gi, 'cid:');
}

function rewriteCssUrls(html: string, byCid: Map<string, string>): string {
  return html.replace(
    /url\(\s*(?:&quot;|&#0*34;|&#x0*22;|&apos;|&#0*39;|&#x0*27;|['"])?\s*(cid:[^)'"&\s]+)\s*(?:&quot;|&#0*34;|&#x0*22;|&apos;|&#0*39;|&#x0*27;|['"])?\s*\)/gi,
    (_full, cid: string) => {
      const url = resolveCid(cid, byCid);
      return url ? `url("${url}")` : 'none';
    },
  );
}

const URL_ATTR =
  /\b((?:data-)?srcset|src|background|poster|data-src|xlink:href|href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function rewriteSrcset(value: string, byCid: Map<string, string>): string {
  const kept: string[] = [];
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (!/cid:/i.test(trimmed)) {
      kept.push(trimmed);
      continue;
    }
    const next = trimmed.replace(CID_TOKEN, (token) => resolveCid(token, byCid) ?? '').trim();
    if (!next || /cid:/i.test(next) || /^[\d.]+[wx]$/i.test(next)) continue;
    kept.push(next);
  }
  return kept.join(', ');
}

function rewriteUrlAttributes(html: string, byCid: Map<string, string>): string {
  return html.replace(URL_ATTR, (full, name: string, _quoted: string, dq?: string, sq?: string, uq?: string) => {
    const raw = (dq ?? sq ?? uq ?? '').trim();
    if (!/cid:/i.test(raw)) return full;
    const lower = name.toLowerCase();
    if (lower === 'srcset' || lower === 'data-srcset') {
      const next = rewriteSrcset(raw, byCid);
      return next ? `${name}="${next}"` : '';
    }
    const next = raw.replace(CID_TOKEN, (token) => resolveCid(token, byCid) ?? '').trim();
    if (!next || /cid:/i.test(next) || !safeImageUrl(next)) return '';
    return `${name}="${next}"`;
  });
}

/** Any cid: the attribute and CSS passes missed, including text the frame would still request. */
function scrubLeftoverCid(html: string, byCid: Map<string, string>): string {
  return html.replace(
    /(^|[\s"'=(,;])(cid:[^\s"'<>)\\,;]+)/gi,
    (_full, prefix: string, token: string) => prefix + (resolveCid(token, byCid) ?? ''),
  );
}

function hideSourcelessImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bsrc\s*=/i.test(tag) || /\bhidden\b/i.test(tag)) return tag;
    return tag.replace(/\s*\/?>$/, ' hidden>');
  });
}

/**
 * Point cid: images at a stored attachment URL. Anything still cid: is removed
 * so the preview frame never requests it (the CSP blocks cid: and logs an error).
 * Case-insensitive. Covers src, srcset, background, poster, href, CSS url(),
 * and entity-encoded quotes such as url(&quot;cid:ii_…&quot;).
 */
export function rewriteCidImages(html: string, attachments?: readonly CidAttachment[] | null): string {
  if (!html || !/cid(?:[=:]|&#|%3a)/i.test(html)) return html;
  const byCid = attachmentMap(attachments);
  const normalized = normalizeCidScheme(html);
  const css = rewriteCssUrls(normalized, byCid);
  const attrs = rewriteUrlAttributes(css, byCid);
  const scrubbed = scrubLeftoverCid(attrs, byCid);
  return hideSourcelessImages(scrubbed);
}
