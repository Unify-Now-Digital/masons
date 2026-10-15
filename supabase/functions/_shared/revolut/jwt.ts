/**
 * Revolut Business client-assertion JWT (RS256).
 * https://developer.revolut.com/docs/guides/manage-accounts/get-started/make-your-first-api-request
 *
 * Payload is exactly iss, sub, aud, exp. iss is the redirect-URI host (no scheme).
 * sub is the client id. aud is https://revolut.com. exp is a number of seconds, not a string.
 * openssl genrsa emits PKCS#1; WebCrypto imports PKCS#8, so PKCS#1 is wrapped here.
 */

const RSA_ENCRYPTION_OID = new Uint8Array([
  0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
]);
const ASN_NULL = new Uint8Array([0x05, 0x00]);
const PKCS8_VERSION = new Uint8Array([0x02, 0x01, 0x00]);

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function derLength(n: number): Uint8Array {
  if (n < 0x80) return new Uint8Array([n]);
  const bytes: number[] = [];
  let x = n;
  while (x > 0) {
    bytes.unshift(x & 0xff);
    x = Math.floor(x / 256);
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function derWrap(tag: number, content: Uint8Array): Uint8Array {
  return concatBytes([new Uint8Array([tag]), derLength(content.length), content]);
}

/** Wrap a PKCS#1 RSA private key in PKCS#8 so crypto.subtle.importKey can read it. */
export function pkcs1PrivateKeyToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const algorithm = derWrap(0x30, concatBytes([RSA_ENCRYPTION_OID, ASN_NULL]));
  const privateKey = derWrap(0x04, pkcs1);
  return derWrap(0x30, concatBytes([PKCS8_VERSION, algorithm, privateKey]));
}

export function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function pemBody(pem: string): string {
  const normalised = pem.replace(/\\n/g, '\n').trim();
  return normalised
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s/g, '');
}

function decodePem(pem: string): Uint8Array {
  const body = pemBody(pem);
  if (!body) throw new Error('REVOLUT_PRIVATE_KEY is empty');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function privateKeyPkcs8Bytes(pem: string): Uint8Array {
  const normalised = pem.replace(/\\n/g, '\n');
  const der = decodePem(normalised);
  if (/BEGIN RSA PRIVATE KEY/.test(normalised)) return pkcs1PrivateKeyToPkcs8(der);
  if (/BEGIN PRIVATE KEY/.test(normalised)) return der;
  throw new Error('REVOLUT_PRIVATE_KEY must be a PKCS#1 or PKCS#8 PEM');
}

export interface RevolutClientAssertionInput {
  privateKeyPem: string;
  clientId: string;
  issuer: string;
  /** Unix seconds. Defaults to now. */
  nowSeconds?: number;
  /** Short on purpose: long enough to exchange a code, not a standing credential. */
  expiresInSeconds?: number;
}

export async function buildRevolutClientAssertion(input: RevolutClientAssertionInput): Promise<string> {
  const clientId = input.clientId.trim();
  const issuer = input.issuer.trim();
  if (!clientId) throw new Error('REVOLUT_CLIENT_ID is empty');
  if (!issuer || issuer.includes('://')) throw new Error('Revolut JWT issuer must be the redirect host, without a scheme');

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const exp = now + (input.expiresInSeconds ?? 300);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iss: issuer, sub: clientId, aud: 'https://revolut.com', exp };
  const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyPkcs8Bytes(input.privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}
