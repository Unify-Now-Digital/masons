/**
 * Revolut Business webhooks v2 signature.
 * https://developer.revolut.com/docs/guides/manage-accounts/webhooks/verify-the-payload-signature
 *
 * payload_to_sign = v1.{Revolut-Request-Timestamp}.{raw body}
 * header = v1={hex HMAC-SHA256}, comma-separated while two secrets are valid.
 * Timestamp is unix milliseconds. Reject anything outside five minutes.
 */

export const REVOLUT_WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;

export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  const len = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

export function revolutTimestampFresh(
  timestampHeader: string | null | undefined,
  nowMs: number = Date.now(),
  maxAgeMs: number = REVOLUT_WEBHOOK_MAX_AGE_MS,
): boolean {
  if (!timestampHeader) return false;
  const trimmed = timestampHeader.trim();
  if (!/^\d{10,16}$/.test(trimmed)) return false;
  const ts = Number(trimmed);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowMs - ts) <= maxAgeMs;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

export async function expectedRevolutSignature(
  rawBody: string,
  timestamp: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const payload = `v1.${timestamp}.${rawBody}`;
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `v1=${bytesToHex(new Uint8Array(mac))}`;
}

/** True when one of the header's v1 signatures matches. Uses the raw body unchanged. */
export async function verifyRevolutWebhookSignature(
  rawBody: string,
  timestampHeader: string | null | undefined,
  signatureHeader: string | null | undefined,
  secret: string,
  nowMs?: number,
): Promise<boolean> {
  if (!secret || !signatureHeader) return false;
  if (!revolutTimestampFresh(timestampHeader, nowMs)) return false;
  const expected = await expectedRevolutSignature(rawBody, timestampHeader!.trim(), secret);
  const presented = signatureHeader.split(',').map((part) => part.trim()).filter(Boolean);
  return presented.some((part) => timingSafeEqual(part, expected));
}
