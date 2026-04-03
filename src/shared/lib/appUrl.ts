/**
 * Base URL for the app used in auth redirects (login, OAuth callback, password reset).
 * Set VITE_APP_URL in .env so both staging and local login redirect to the same target
 * (e.g. https://staging.unifynow.digital). Never use window.location.origin for auth
 * redirects so that local dev and staging both end on the configured URL.
 * If the resolved URL is localhost, we force the staging default so Google OAuth
 * and other auth flows never redirect to localhost.
 */
const DEFAULT_APP_URL = 'https://staging.unifynow.digital';

function isLocalhost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '';
  } catch {
    return true;
  }
}

export function getAppUrl(): string {
  const raw = import.meta.env.VITE_APP_URL || DEFAULT_APP_URL;
  const url = typeof raw === 'string' ? raw.replace(/\/$/, '') : DEFAULT_APP_URL;
  return isLocalhost(url) ? DEFAULT_APP_URL : url;
}
