import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { buildRevolutClientAssertion } from '../../../../supabase/functions/_shared/revolut/jwt';

describe('Revolut client assertion', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const pkcs1 = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  async function signed(pem: string) {
    return buildRevolutClientAssertion({
      privateKeyPem: pem,
      clientId: 'client_123',
      issuer: 'example.com',
      nowSeconds: 1_700_000_000,
      expiresInSeconds: 300,
    });
  }

  function payloadOf(token: string) {
    const part = token.split('.')[1];
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json) as { iss: string; sub: string; aud: string; exp: number };
  }

  function verifies(token: string): boolean {
    const [header, body, sig] = token.split('.');
    const verify = createVerify('RSA-SHA256');
    verify.update(`${header}.${body}`);
    verify.end();
    const signature = Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    return verify.verify(publicPem, signature);
  }

  it('signs iss, sub, aud and a numeric exp with a PKCS#1 key from openssl genrsa', async () => {
    const token = await signed(pkcs1);
    expect(payloadOf(token)).toEqual({
      iss: 'example.com',
      sub: 'client_123',
      aud: 'https://revolut.com',
      exp: 1_700_000_300,
    });
    expect(typeof payloadOf(token).exp).toBe('number');
    expect(verifies(token)).toBe(true);
  });

  it('also signs a PKCS#8 key', async () => {
    expect(verifies(await signed(pkcs8))).toBe(true);
  });

  it('accepts a one-line PEM with escaped newlines', async () => {
    const oneLine = pkcs1.replace(/\n/g, '\\n');
    expect(verifies(await signed(oneLine))).toBe(true);
  });

  it('rejects an issuer that still has a scheme', async () => {
    await expect(buildRevolutClientAssertion({
      privateKeyPem: pkcs8,
      clientId: 'client_123',
      issuer: 'https://example.com',
    })).rejects.toThrow(/issuer/);
  });
});
