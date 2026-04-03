/**
 * Base URL for the app used in auth redirects (login, OAuth callback, password reset).
 * Uses the current browser origin so redirects always stay on the same domain
 * (staging, production, etc). Falls back to VITE_APP_URL env var, then to staging.
 * For localhost dev, forces staging so Google OAuth never redirects to localhost.
 */
const STAGING_URL = 'https://staging.unifynow.digital';

function isLocalhost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '';
  } catch {
    return true;
  }
}

export function getAppUrl(): string {
  // Prefer current origin so we stay on whichever domain the user is on
  if (typeof window !== 'undefined' && window.location?.origin && !isLocalhost(window.location.origin)) {
    return window.location.origin;
  }
  // Fall back to env var or staging default
  const raw = import.meta.env.VITE_APP_URL || STAGING_URL;
  const url = typeof raw === 'string' ? raw.replace(/\/$/, '') : STAGING_URL;
  return isLocalhost(url) ? STAGING_URL : url;
}
