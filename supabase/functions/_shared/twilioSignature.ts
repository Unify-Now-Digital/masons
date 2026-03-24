function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function hmacSha1Base64(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64(new Uint8Array(sig));
}

export async function verifyTwilioSignatureForForm(req: Request, rawBody: string): Promise<boolean> {
  const expected = req.headers.get('X-Twilio-Signature') ?? req.headers.get('x-twilio-signature');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!expected || !authToken) return false;

  const params = new URLSearchParams(rawBody);
  const keys = Array.from(new Set(Array.from(params.keys()))).sort();
  let data = Deno.env.get('WHATSAPP_MANAGED_PROVIDER_WEBHOOK_PUBLIC_URL') ?? req.url;
  for (const key of keys) {
    const values = params.getAll(key);
    for (const value of values) {
      data += `${key}${value}`;
    }
  }

  const computed = await hmacSha1Base64(authToken, data);
  return computed === expected;
}
