/**
 * GHL webhook signature verification (posture A — asymmetric only).
 * Keys from https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/#security-verifying-webhook-authenticity
 */

const GHL_ED25519_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

const GHL_RSA_PEM = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSCFrm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfBcsedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpvuxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKUJ062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXpIocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzNh/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhCHULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJPQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAykT1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

let ed25519KeyPromise: Promise<CryptoKey> | null = null;
let rsaKeyPromise: Promise<CryptoKey> | null = null;

function pemToSpkiBytes(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function base64ToBytes(b64: string): Uint8Array | null {
  if (!b64 || b64 === 'N/A') return null;
  try {
    const binary = atob(b64);
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function getEd25519Key(): Promise<CryptoKey> {
  if (!ed25519KeyPromise) {
    const spkiBytes = pemToSpkiBytes(GHL_ED25519_PEM);
    ed25519KeyPromise = crypto.subtle.importKey(
      'spki',
      spkiBytes,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
  }
  return ed25519KeyPromise;
}

function getRsaKey(): Promise<CryptoKey> {
  if (!rsaKeyPromise) {
    const spkiBytes = pemToSpkiBytes(GHL_RSA_PEM);
    rsaKeyPromise = crypto.subtle.importKey(
      'spki',
      spkiBytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  }
  return rsaKeyPromise;
}

async function verifyEd25519(payload: string, signatureB64: string): Promise<boolean> {
  const signatureBytes = base64ToBytes(signatureB64);
  if (!signatureBytes) return false;
  try {
    const key = await getEd25519Key();
    const payloadBytes = new TextEncoder().encode(payload);
    return await crypto.subtle.verify('Ed25519', key, signatureBytes, payloadBytes);
  } catch {
    return false;
  }
}

async function verifyLegacyRsa(payload: string, signatureB64: string): Promise<boolean> {
  const signatureBytes = base64ToBytes(signatureB64);
  if (!signatureBytes) return false;
  try {
    const key = await getRsaKey();
    const payloadBytes = new TextEncoder().encode(payload);
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signatureBytes,
      payloadBytes,
    );
  } catch {
    return false;
  }
}

export async function verifyGhlWebhook(rawBody: string, req: Request): Promise<boolean> {
  const ghlSig = req.headers.get('X-GHL-Signature') ?? req.headers.get('x-ghl-signature');
  const whSig = req.headers.get('X-WH-Signature') ?? req.headers.get('x-wh-signature');

  if (ghlSig) return verifyEd25519(rawBody, ghlSig);
  if (whSig) return verifyLegacyRsa(rawBody, whSig);
  return false;
}
