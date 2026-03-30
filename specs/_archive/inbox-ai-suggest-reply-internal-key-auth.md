# Inbox AI Suggest Reply: Internal Key Auth (Temporary)

## Overview

Allow the `inbox-ai-suggest-reply` Edge Function to work without a Supabase Auth session (e.g. on localhost where Mason has no login yet) by accepting a temporary internal key in addition to—or instead of—JWT auth.

**Context:**
- The function currently requires Supabase Auth (JWT); unauthenticated requests receive 401.
- Local/dev flows may not have a session; we need a temporary way to call the function.
- OpenAI and cache logic must remain unchanged; only the auth gate changes.

**Goal:**
- Accept requests when header `x-internal-key` matches a secret `INTERNAL_FUNCTION_KEY`.
- Return 401 when the key is missing or does not match.
- Frontend sends `x-internal-key` from `VITE_INTERNAL_FUNCTION_KEY` when invoking.
- Leave clear TODO notes to switch back to JWT auth once login is implemented.

---

## Current State Analysis

### Edge Function Auth

**File:** `supabase/functions/inbox-ai-suggest-reply/index.ts`

**Current behavior:**
- Requires `Authorization: Bearer <JWT>`.
- Uses anon client + `getUser()` to validate; returns 401 if missing or invalid.
- All DB and OpenAI logic runs only after auth succeeds.

**Observations:**
- On localhost without login, every suggest-reply request returns 401.
- No fallback for dev/unauthenticated scenarios.

### Frontend Invocation

**File:** `src/modules/inbox/hooks/useSuggestedReply.ts`

**Current behavior:**
- Calls `supabase.functions.invoke('inbox-ai-suggest-reply', { body: { message_id } })`.
- Relies on Supabase client session (no custom headers).

**Observations:**
- No way to pass an internal key when session is absent.

### Secrets / Env

**Current:**
- `OPENAI_API_KEY` is set in Supabase Edge Function secrets (server-side only; correct).
- No `INTERNAL_FUNCTION_KEY` or `VITE_INTERNAL_FUNCTION_KEY` in use.

---

## Requirements (Summary)

| Requirement | Detail |
|-------------|--------|
| Secret | Add `INTERNAL_FUNCTION_KEY` to Supabase Edge Function environment (secrets). |
| Edge Function | Accept request if header `x-internal-key` matches `INTERNAL_FUNCTION_KEY`. |
| 401 | If header missing or mismatch, return 401. |
| Logic | Keep existing OpenAI + cache logic unchanged. |
| Frontend | Send `x-internal-key` from env var `VITE_INTERNAL_FUNCTION_KEY` when invoking. |
| Security | Do NOT expose `OPENAI_API_KEY` client-side (unchanged). |
| Future | Leave TODO notes to switch back to JWT auth once login is implemented. |

---

## Implementation Approach

### Phase 1: Edge Function

**File:** `supabase/functions/inbox-ai-suggest-reply/index.ts`

- Read `INTERNAL_FUNCTION_KEY` from `Deno.env.get('INTERNAL_FUNCTION_KEY')`.
- Read request header `x-internal-key` (case-insensitive).
- **If** `INTERNAL_FUNCTION_KEY` is set and non-empty **and** `x-internal-key` equals it → treat as authorized; skip JWT check.
- **Else** (key missing or mismatch): return 401 with `{ error: 'Unauthorized' }`.
- **TODO (in code):** Once login is implemented, require JWT again and remove or deprecate internal-key auth.
- Leave all existing steps (body parse, message fetch, cache lookup, OpenAI call, insert, response) unchanged.

### Phase 2: Frontend

**File:** `src/modules/inbox/hooks/useSuggestedReply.ts`

- Read `VITE_INTERNAL_FUNCTION_KEY` from `import.meta.env.VITE_INTERNAL_FUNCTION_KEY` (or equivalent in the app’s env).
- When invoking `supabase.functions.invoke('inbox-ai-suggest-reply', ...)`, pass the key in headers if present:
  - e.g. `headers: { 'x-internal-key': import.meta.env.VITE_INTERNAL_FUNCTION_KEY }` when the env var is set.
- If env var is not set, do not send the header (existing behavior; will 401 when function requires key or JWT).

### Phase 3: Docs / Env (Optional)

**File:** `docs/quickstart.md` or `.env.example` / README

- Document `INTERNAL_FUNCTION_KEY` for Supabase Edge Function secrets.
- Document `VITE_INTERNAL_FUNCTION_KEY` for local/dev frontend (e.g. same value as `INTERNAL_FUNCTION_KEY` in dev only).
- Note that this is for local/dev until login exists; production should use JWT once implemented.

### Safety Considerations

- Use constant-time comparison for the internal key if available (e.g. avoid short-circuit string compare in hot path); otherwise simple equality is acceptable for a temporary internal key.
- Keep `INTERNAL_FUNCTION_KEY` and `VITE_INTERNAL_FUNCTION_KEY` out of version control; document in `.env.example` only as variable names, not values.

---

## What NOT to Do

- Do not expose `OPENAI_API_KEY` to the client.
- Do not change OpenAI request/response or cache (inbox_ai_suggestions) logic.
- Do not remove the existing JWT auth code without replacing it with a clear path to restore JWT-only auth when login is implemented.
- Do not commit actual key values in the repo.

---

## Open Questions / Considerations

- **Production:** Once login is implemented, decide whether to remove internal-key support or keep it for server-to-server/admin calls (with a TODO to restrict to JWT for normal users).
- **Key rotation:** If internal key is used beyond localhost, plan for rotation and env updates.

---

## Files

| File | Action |
|------|--------|
| `supabase/functions/inbox-ai-suggest-reply/index.ts` | Add internal-key auth branch; TODO for JWT-only later. |
| `src/modules/inbox/hooks/useSuggestedReply.ts` | Send `x-internal-key` from `VITE_INTERNAL_FUNCTION_KEY` when set. |
| `docs/quickstart.md` or `.env.example` | Optional: document both env vars. |
