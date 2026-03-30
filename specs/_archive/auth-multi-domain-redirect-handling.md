# Auth Redirect Handling for Multi-Domain Deployments

## Overview

Mason App needs domain-agnostic auth redirect handling so the same Supabase project can serve both production and staging Cloudflare deployments without sending users back to a fixed app URL.

**Context:**
- Two separate frontend deployments use the same Supabase project and database:
  - Production: `https://mason.unifynow.digital`
  - Staging: `https://staging.unifynow.digital`
- The app currently relies on a fixed app URL helper for auth redirects.
- Supabase auth redirects must return users to the same domain they were using when they initiated sign-in / sign-up / recovery flows.
- Existing auth callback routing already exists and should remain the entry point if possible.

**Goal:**
- Replace fixed-domain auth redirect behavior with runtime-origin-based redirects.
- Ensure OAuth, magic link, reset password, and OTP-related flows resolve back to `${window.location.origin}/auth/callback`.
- Keep normal email/password sign-in as in-app navigation only.
- Minimize changes outside auth-related code.

---

## Current State Analysis

### Auth Callback Route

**Route:** `src/app/router.tsx`

**Current Structure:**
- `/auth/callback` is already registered and points to `AuthCallbackPage`.
- The callback page currently completes the session and navigates to `/dashboard`.

**Observations:**
- The callback route exists and can likely remain unchanged.
- The route is domain-agnostic already because it is a relative app route.

### Auth Pages and URL Helper

#### `src/shared/lib/appUrl.ts`

**Current Structure:**
- Exposes `getAppUrl()`.
- Uses `import.meta.env.VITE_APP_URL || DEFAULT_APP_URL`.
- `DEFAULT_APP_URL` is hardcoded as `localhost:8080`.
- The helper explicitly avoids `window.location.origin` for auth redirects.

**Observations:**
- This helper is the main source of fixed-domain redirect behavior.
- It is currently designed to force redirects to a configured app URL, not the current origin.

#### `src/modules/auth/pages/LoginPage.tsx`

**Current Redirect Logic:**
- Normal email/password login:
  - `supabase.auth.signInWithPassword({ email, password })`
  - On success, client redirects with:
    - `window.location.assign(`${getAppUrl()}/dashboard/inbox`)`
- OAuth login:
  - `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${getAppUrl()}/auth/callback` } })`
- Comment indicates the app expects a fixed callback domain.

**Observations:**
- Email/password login is currently doing a full-page redirect to a fixed domain.
- OAuth is tied to `getAppUrl()` instead of current origin.

#### `src/modules/auth/pages/RegisterPage.tsx`

**Current Redirect Logic:**
- `supabase.auth.signUp({ ..., options: { emailRedirectTo: `${getAppUrl()}/auth/callback` } })`

**Observations:**
- Confirmation email links are also tied to a fixed app URL helper.

### Other Auth-Related Redirect Flows

**Search results currently found:**
- `VITE_APP_URL` / `getAppUrl()` / `redirectTo` are used in:
  - `src/shared/lib/appUrl.ts`
  - `src/modules/auth/pages/LoginPage.tsx`
  - `src/modules/auth/pages/RegisterPage.tsx`

**No matches found in the current codebase for:**
- `resetPasswordForEmail`
- `verifyOtp`
- `signInWithOtp`
- explicit magic-link / OTP pages

**Observations:**
- There are no dedicated reset-password or OTP pages currently found in the app source.
- If those flows exist later, they will likely need to adopt the same origin-based redirect pattern.

### Relationship Analysis

**Current Relationship:**
- Auth initiation flow uses a fixed helper (`getAppUrl()`) to determine the redirect destination.
- Supabase callback handling is already centralized in `/auth/callback`.

**Gaps / Issues:**
- Redirect destination is domain-fixed instead of origin-based.
- Both staging and production deployments share the same Supabase project, so a fixed redirect target causes users to land on the wrong domain.
- Email/password login should not require a fixed-domain full-page redirect at all.

### Data Access / Redirect Patterns

**How redirects are currently formed:**
- OAuth callback:
  - `${getAppUrl()}/auth/callback`
- Email confirmation:
  - `${getAppUrl()}/auth/callback`
- Post-password login:
  - `${getAppUrl()}/dashboard/inbox`

**How they should behave:**
- OAuth / magic link / reset password / OTP:
  - `${window.location.origin}/auth/callback`
- Normal email/password login:
  - stay in-app and navigate using client routing, or otherwise avoid a fixed-domain full-page redirect

---

## Recommended Implementation Approach

### Phase 1: Remove fixed-domain redirect dependency from auth initiation
- Replace `getAppUrl()` usage in auth pages with runtime origin for auth callback URLs.
- Keep `/auth/callback` route as the shared callback landing page.
- Keep login success flow local to the current app domain.

### Phase 2: Simplify or retire the app URL helper
- Determine whether `src/shared/lib/appUrl.ts` is still needed after auth redirect changes.
- If no other code uses it for auth, remove it from auth flows.
- If it remains useful for non-auth navigation, keep it but stop using it for auth redirects.

### Safety Considerations
- Keep `/auth/callback` route intact so Supabase can return from OAuth/email flows.
- Validate that both staging and production resolve their own origin at runtime.
- Keep email/password login navigation within the same domain to avoid unnecessary page reloads.
- Make sure the Supabase project’s allowed redirect URLs include both domains’ callback routes if required.

---

## What NOT to Do

- Do not hardcode either production or staging domain into auth redirect flows.
- Do not remove the shared Supabase backend.
- Do not change unrelated non-auth navigation logic.
- Do not add new callback routes unless the existing callback route is insufficient.
- Do not broaden the scope to general app routing or non-auth Cloudflare configuration.

---

## Open Questions / Considerations

- Does Supabase require explicit allow-listing of both `https://mason.unifynow.digital/auth/callback` and `https://staging.unifynow.digital/auth/callback`?
- Is `src/shared/lib/appUrl.ts` still used anywhere outside auth, or can it be removed entirely after the auth redirect change?
- Should the email/password sign-in success path remain a `window.location.assign` or be converted to router navigation for a smoother in-app transition?
- Are there any future reset-password / OTP pages planned that should be included now, even though none were found in the current source search?

