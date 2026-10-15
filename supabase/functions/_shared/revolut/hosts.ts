/** Revolut Business hosts. Sandbox is selected with REVOLUT_SANDBOX=true. */

export interface RevolutHosts {
  api: string;
  consent: string;
  environment: 'sandbox' | 'production';
}

export function revolutSandboxEnabled(flag: string | null | undefined): boolean {
  return ['1', 'true', 'yes', 'sandbox'].includes((flag ?? '').trim().toLowerCase());
}

export function revolutHosts(sandbox: boolean): RevolutHosts {
  return sandbox
    ? {
        api: 'https://sandbox-b2b.revolut.com',
        consent: 'https://sandbox-business.revolut.com',
        environment: 'sandbox',
      }
    : {
        api: 'https://b2b.revolut.com',
        consent: 'https://business.revolut.com',
        environment: 'production',
      };
}

/** iss claim: redirect URI host, no scheme. REVOLUT_JWT_ISSUER overrides when set. */
export function revolutJwtIssuer(redirectUrl: string, override?: string | null): string {
  const explicit = override?.trim();
  if (explicit) return explicit.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return new URL(redirectUrl).host;
}

export const REVOLUT_REFRESH_TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;
export const REVOLUT_REFRESH_WARNING_DAYS = 14;

export function refreshTokenExpiresAt(fromMs: number, expiresInSeconds?: number | null): string {
  const ms = expiresInSeconds && expiresInSeconds > 0
    ? expiresInSeconds * 1000
    : REVOLUT_REFRESH_TOKEN_LIFETIME_MS;
  return new Date(fromMs + ms).toISOString();
}
