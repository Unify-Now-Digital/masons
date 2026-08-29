# Findings
Updated: 2026-08-30

- F-001: Seven rows in organizations; two live, one E2E, four test/leftover (see CLAUDE.local.md). Data volume in leftovers unknown. Classify and archive in schema cleanup (Day 9). Until then real-data queries include only the two live orgs.
- F-002: Gmail integration reads three differently named client-id/secret env pairs (GOOGLE_OAUTH_*, GMAIL_OAUTH_*, GMAIL_CLIENT_*). Drift; consolidate.
- F-003: STRIPE_CREDENTIALS_ENCRYPTION_KEY is the single key decrypting every org's Stripe credentials; rotation invalidates all at once. Document a rotation procedure before ever rotating.
- F-004: Sentry env names differ between vite.config.ts (SENTRY_ORG, SENTRY_PROJECT) and sentry-proxy (SENTRY_ORG_SLUG, SENTRY_PROJECT_SLUG). Harmless; note only.
- F-005: bare `npx tsc --noEmit` may check nothing in this repo; confirm the correct tsconfig for gate:tsc in A2.
