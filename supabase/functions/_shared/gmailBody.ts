/**
 * Shared Gmail body extraction for sync and refresh/backfill.
 * Uses UTF-8-safe base64url decoding so non-ASCII (e.g. Georgian) displays correctly.
 */

export interface GmailPayload {
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string };
  parts?: Array<{
    mimeType?: string;
    body?: { data?: string };
    parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
  }>;
}

/**
 * Decode Gmail base64url body data to a UTF-8 string.
 * Normalizes alphabet, adds padding, decodes to bytes, then decodes bytes as UTF-8.
 * Returns empty string on any failure.
 */
function decodeBase64UrlToUtf8(data: string): string {
  if (!data || typeof data !== 'string') return '';
  try {
    const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    const padded = padding === 0 ? normalized : normalized + '='.repeat(4 - padding);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

/**
 * Extract plain-text body from a Gmail API message payload.
 * Prefers top-level body, then text/plain part, then nested text/plain.
 * Decodes each candidate with UTF-8-safe base64url decoding.
 */
export function extractBodyText(payload: GmailPayload): string {
  if (payload.body?.data) {
    const decoded = decodeBase64UrlToUtf8(payload.body.data);
    if (decoded) return decoded;
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        const decoded = decodeBase64UrlToUtf8(part.body.data);
        if (decoded) return decoded;
      }
      if (part.parts) {
        for (const p of part.parts) {
          if (p.mimeType === 'text/plain' && p.body?.data) {
            const decoded = decodeBase64UrlToUtf8(p.body.data);
            if (decoded) return decoded;
          }
        }
      }
    }
  }
  return '';
}

/**
 * Extract HTML body from a Gmail API message payload.
 * Prefers text/html part, then nested text/html parts.
 * Decodes each candidate with UTF-8-safe base64url decoding.
 */
export function extractBodyHtml(payload: GmailPayload): string {
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const decoded = decodeBase64UrlToUtf8(part.body.data);
        if (decoded) return decoded;
      }
      if (part.parts) {
        for (const p of part.parts) {
          if (p.mimeType === 'text/html' && p.body?.data) {
            const decoded = decodeBase64UrlToUtf8(p.body.data);
            if (decoded) return decoded;
          }
        }
      }
    }
  }
  return '';
}
