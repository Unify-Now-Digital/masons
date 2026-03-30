# Add Sentry to Mason App Frontend (Minimal, Privacy-Safe)

## Overview
**Context:**
- Mason App frontend is a React + TypeScript (Vite) app.
- Deployments are on Cloudflare Pages.
- We want a minimal, production-focused Sentry setup.
- Scope is frontend-only (no backend / Supabase Edge Function monitoring).
- Privacy is critical because the app contains sensitive customer messages (Inbox) and payment/invoicing information.

**Goal:**
- Add production error monitoring.
- Add performance tracing (browser transactions).
- Keep the setup conservative and privacy-safe.

---
## Current State Analysis
### Frontend App Bootstrapping
**Table:** N/A (frontend codebase)

**Current Structure:**
- The React root is mounted in `src/main.tsx` using `createRoot(...).render(<App />)`.
- The app-level bootstrap wrapper is `src/app/App.tsx`, which renders:
  - `Providers` (`src/app/providers.tsx`) for React Query + UI toasters
  - `BrowserRouter`
  - `AppRouter` for route rendering
- There is a route-level error UI component `src/app/components/RouteErrorFallback.tsx` used as `errorElement` in `src/app/router.tsx`.

**Observations:**
- There is currently no Sentry initialization anywhere in `src/`.
- There is no existing global error boundary component that would integrate with Sentry.
- Route errors show a “Reload page” UX but are not currently reported to Sentry.

### Build / Vite Configuration
**Table:** N/A (build tooling)

**Current Structure:**
- Vite config is in `vite.config.ts`.
- `vite.config.ts` currently sets:
  - React plugin (`@vitejs/plugin-react-swc`)
  - `@` alias to `src/`
- Sourcemaps are not explicitly configured for production builds (required for Sentry source map upload).

**Observations:**
- There is no `@sentry/vite-plugin` integration yet.
- There is no “upload source maps to Sentry” flow yet.

### Error / Data Capture Risk Surface
**Current Relationship:**
- Sentry can collect event user info, request details, and custom contexts.

**Gaps/Issues:**
- Without explicit scrubbing, sensitive values can leak via:
  - `event.user` (if set)
  - `event.request` (URL/query headers)
  - any custom `tags`, `contexts`, `extra`, or breadcrumb data
- The app includes sensitive data in runtime contexts (Inbox messages, invoicing/payment UI), so we must avoid adding any Sentry calls that attach that data.

---
## Recommended Schema Adjustments
No database changes.

---
## Implementation Approach

### Phase 1: Add Sentry runtime dependencies
- **Modify:** `package.json`
  - Add minimal frontend SDK deps:
    - `@sentry/react`
    - `@sentry/tracing`
  - Add Vite sourcemap upload plugin as a dev dependency:
    - `@sentry/vite-plugin`

Dependencies should be added as latest versions via the package manager (no custom pins required for this v1 spec).

---
### Phase 2: Create a reusable, early Sentry initialization module
- **Create:** `src/sentry.client.ts`
  - Exports no UI; this is a side-effect module that initializes Sentry when imported.
  - Initialization rules (must be implemented exactly):
    - Only run in production:
      - Guard with `if (!import.meta.env.PROD) return;`
    - Only run when DSN is present:
      - Guard with `if (!import.meta.env.VITE_SENTRY_DSN) return;`
    - Privacy-safe defaults:
      - Ensure PII is not enabled:
        - `sendDefaultPii: false` (explicit)
      - Do not set `Sentry.setUser(...)`
      - Do not attach message bodies or message contents to events/tags/contexts.
    - Enable browser tracing:
      - `integrations: [Sentry.browserTracingIntegration()]`
      - `tracesSampleRate: <recommended value from Phase 5>`
    - Add `beforeSend` scrubbing (detailed in Phase 4).

Exact module responsibilities:
- `import * as Sentry from "@sentry/react";`
- Call `Sentry.init({...})` exactly once from this module.

Sentry init config items to include:
- `dsn: import.meta.env.VITE_SENTRY_DSN`
- `environment: import.meta.env.VITE_SENTRY_ENV ?? "production"`
- `beforeSend(event) { ... }`
- `sendDefaultPii: false`
- `integrations: [...]` enabling browser tracing
- No session replay integration.
- No release tracking features (see Phase 3/4 notes).

---
### Phase 3: Enable Sentry only for production builds (Cloudflare Pages)
- **Modify:** `vite.config.ts`
  - Add production-only sourcemap generation + Sentry plugin.
  - Update build config:
    - set `build.sourcemap` to `'hidden'` (required for Sentry Vite plugin usage).
  - Add `@sentry/vite-plugin` with correct plugin placement:
    - Put `sentryVitePlugin(...)` **after** `react()` (and after any other plugins), i.e. at the end of the `plugins` array.
  - Ensure the plugin is only included for production builds:
    - inside the `defineConfig(({ mode }) => ...)` callback, gate with `mode === "production"`.
  - Configure the plugin for safe sourcemap upload:
    - Use org/project/token from build-time environment variables (see Phase 6).
    - Configure `sourcemaps.filesToDeleteAfterUpload` so maps are removed after upload.

Exact Vite integration requirements:
- Add `import { sentryVitePlugin } from "@sentry/vite-plugin";`
- Add the plugin to `plugins: [...]` only when `mode === "production"` and when required build-time env vars are present:
  - `VITE_SENTRY_ORG`, `VITE_SENTRY_PROJECT`, `VITE_SENTRY_AUTH_TOKEN`, `VITE_SENTRY_RELEASE`
- Use the Sentry Vite plugin with `release` set to `process.env.VITE_SENTRY_RELEASE`.

Required build-time env vars referenced by Vite plugin:
- `VITE_SENTRY_ORG`
- `VITE_SENTRY_PROJECT`
- `VITE_SENTRY_AUTH_TOKEN`
- `VITE_SENTRY_RELEASE` (release identifier for mapping uploaded sourcemaps)

Release tracking explicitly out-of-scope:
- Do NOT add any CLI steps or automated release tracking tooling beyond sourcemap upload.
- Do NOT set up commit association / release health / release tracking features.
- If a `release` string is used for sourcemap mapping, it must be treated strictly as a mapping key, not as “release tracking”.

---
### Phase 4: Privacy-safe scrubbing (`beforeSend`)
- **Modify:** `src/sentry.client.ts`
  - Implement a conservative `beforeSend(event)` that:
    - Removes user identity fields:
      - `delete event.user` (or `event.user = undefined`)
    - Removes request details:
      - Conservative approach for v1: delete `event.request` entirely.
    - Clears event extras and custom contexts:
      - `delete event.extra`
      - delete `event.contexts` (and ensure we do not add custom contexts in our code)
    - Clears breadcrumbs:
      - `event.breadcrumbs = []` to avoid accidental leakage via logs/breadcrumbs
    - Scrubs exception values for common sensitive patterns:
      - If `event.exception.values[0].value` contains email-like or phone-like strings, redact them with `[REDACTED]`.
      - Do not attempt to scrub arbitrary stack trace frames beyond that.

Implementation detail guidance (privacy-safe):
- Email regex (example): `/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi`
- Phone regex (example): `/\+?\d[\d\s().-]{7,}\d/`
- Only run scrubbing if the value exists and is a string; never stringify large objects.

Critical “do not do” constraints:
- Do not add any code that:
  - calls `Sentry.setTag` / `Sentry.setContext` with message bodies, customer identifiers (`person_id`), email addresses, phone numbers, invoice amounts, or anything payment-related.
  - logs Inbox message contents to Sentry (breadcrumbs/logs).

---
### Phase 5: Recommended production tracing sampling
- **Modify:** `src/sentry.client.ts`
  - Set `tracesSampleRate` to a conservative production v1 value:
    - Recommended: `0.1` (10% sampling)

Rationale:
- Minimizes overhead and reduces the chance of collecting sensitive request metadata at scale.
- Still provides enough signal for tracing/debugging.

---
### Phase 6: Environment variable conventions (repo + Cloudflare Pages)
Conventions to follow:
- Existing repo uses `VITE_*` in `.env`, referenced via `import.meta.env.*`.

New env vars to introduce for frontend:
- `VITE_SENTRY_DSN` (public DSN; Cloudflare Pages env var)
- `VITE_SENTRY_ENV` (optional; default to `"production"`)

Build-only vars for sourcemap upload (must be secret in CI/build environment):
- `VITE_SENTRY_ORG`
- `VITE_SENTRY_PROJECT`
- `VITE_SENTRY_AUTH_TOKEN`
- `VITE_SENTRY_RELEASE` (static mapping key for this build/version)

Important privacy note:
- Ensure `VITE_SENTRY_AUTH_TOKEN` is only read inside `vite.config.ts` (build-time) and never referenced from browser runtime code.

---
### Phase 7: Error reporting integration points (minimal)
Since there is currently no error boundary wrapper:
- **Modify (required for best signal):** `src/main.tsx` or `src/app/App.tsx`
  - Ensure Sentry is initialized before the React tree renders:
    - **Modify `src/main.tsx`** to add `import "@/sentry.client";` near the top of the file (before `createRoot(...).render(<App />)`).
  - Wrap the app router rendering with `Sentry.ErrorBoundary` (from `@sentry/react`) in production only.
  - Fallback UI must be generic and must not display error messages that might include sensitive data.
- **Modify (recommended, privacy-safe):** `src/app/components/RouteErrorFallback.tsx`
  - In production only, call `Sentry.captureException(error)` in `RouteErrorFallback`.
  - Rely on `beforeSend` scrubbing to prevent sensitive request/user/message info from being sent.

---
### Phase 8: Verification / Acceptance checks (no code in this spec)
Validation criteria for the final implementation:
- Sentry initializes only when:
  - `import.meta.env.PROD` is true
  - `VITE_SENTRY_DSN` is present
- No session replay is added.
- No release tracking tooling is added.
- `beforeSend` removes:
  - user identity
  - request details (v1: full deletion)
  - breadcrumbs/extras/custom contexts
- Performance tracing is enabled:
  - transactions appear in Sentry with sampling at the configured `tracesSampleRate`
- Source maps are uploaded during production builds:
  - `vite build` in production mode triggers upload
  - sourcemap files are deleted after upload
- No sensitive application data is added to Sentry context/tags:
  - no Inbox message bodies
  - no payment details
  - no email/phone numbers as custom contexts/tags

---
## Safety Considerations
- Default to collecting less rather than more when uncertain.
- Avoid attaching any app-specific data to events.
- Keep scrubbing logic conservative and deterministic.
- Ensure the auth token used for sourcemap upload is build-time only (never referenced in the browser bundle).

### Risks / Edge cases
- Sourcemap plugin misconfiguration:
  - If `VITE_SENTRY_AUTH_TOKEN`/org/project/release are missing in Cloudflare Pages build, the build could fail or upload could be skipped.
  - Mitigation: gate plugin inclusion on env var presence; fail gracefully by disabling the plugin when required vars are absent.
- Debuggability vs privacy:
  - Deleting `event.request` and clearing breadcrumbs reduces context in Sentry.
  - Mitigation: keep scrubbing conservative; only remove high-risk fields, not the entire event.
- Exceptions that contain sensitive values:
  - Some thrown errors could include inbox message snippets or payment details in their `Error.message`/stack.
  - Mitigation: `beforeSend` must redact common patterns (email/phone) and must avoid adding custom contexts/tags anywhere in app code.
- Performance overhead:
  - Tracing increases event volume and client-side overhead.
  - Mitigation: use `tracesSampleRate = 0.1` initially and adjust based on Sentry volume after first week.
- Double-initialization:
  - If `src/sentry.client.ts` is imported multiple times, Sentry init could run twice (depending on bundler behaviour).
  - Mitigation: ensure initialization module calls `Sentry.init` unconditionally but is only imported once from `src/main.tsx`.

Rollback strategy:
- If anything breaks, remove:
  - `src/sentry.client.ts` and its import from `src/main.tsx`
  - `@sentry/vite-plugin` integration from `vite.config.ts`
- Leave `RouteErrorFallback` capture integration unchanged if captureException is problematic, and rely on global/unhandled capture as fallback.

---
## What NOT to Do
- Do NOT add `@sentry/replay` or session replay integrations.
- Do NOT enable release tracking features / automatic release/commit association.
- Do NOT enable `sendDefaultPii` (keep it `false`).
- Do NOT capture or attach:
  - Inbox message contents
  - payment/invoicing details
  - emails/phone numbers as custom contexts/tags
- Do NOT add any debugging logs that could flow into Sentry breadcrumbs.

---
## Open Questions / Considerations
- Should we also capture handled promise rejections globally? (Sentry default behaviour can be verified during implementation.)
- Whether we want SPA navigation tracing enhancements beyond the minimal browser tracing integration (more complex; not required for v1).

