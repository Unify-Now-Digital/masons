# Feature Specification: GHL Inbox — Multi-org support

**Branch**: `010-ghl-multi-org` (off staging, includes Phase 1 `009-ghl-inbox-readonly`)  
**Status**: Refactor of Phase 1 pilot shortcuts

## Problem

Phase 1 assumed one GHL-connected org: a single `GHL_API_KEY` and `GHL_LOCATION_ID` Edge secret, plus `locationMatchesEnv` in `ghlClient.ts`. The client now has **Churchill** and **Sears Melvin**, each with its own GHL sub-account, PIT, and location ID.

## User Stories

### US1 — Per-org encrypted credential storage (Priority: P1)

Each `ghl_connections` row stores its own PIT encrypted at rest (pgcrypto). Decryption is server-only via `get_ghl_api_key(connection_id, encryption_key)`; never exposed to browser RLS.

**Independent test**: Service role can call `get_ghl_api_key` with the Edge encryption key for a seeded connection; authenticated client `select` on `ghl_connections` does not return `ghl_api_key`.

### US2 — Edge functions use connection-scoped PIT (Priority: P1)

`ghl-fetch` and `ghl-mark-read` load the active connection for `organizationId`, decrypt PIT, and pass it to `ghlFetch`. `locationMatchesEnv` and `Deno.env.get('GHL_API_KEY')` are removed. `ghl-webhook` unchanged (no outbound GHL calls).

**Independent test**: `listConversations` succeeds for org A and org B with different seeded PITs when env `GHL_API_KEY` is unset or dummy.

### US3 — Dual-org production readiness (Priority: P1)

Churchill row updated with encrypted PIT; Sears Melvin row inserted. Members of each org see only their org's GHL data; mark-as-read works on both.

**Independent test**: Manual smoke per quickstart.md (Churchill member, Sears Melvin member, RLS isolation, mark-as-read, no PIT in bundle).

### US4 — Secrets and documentation (Priority: P2)

Add `GHL_API_KEY_ENCRYPTION_KEY`; document deprecated `GHL_API_KEY` / `GHL_LOCATION_ID` (keep in Supabase, not read by code).

**Independent test**: quickstart.md lists new secret and deprecation note.

## Out of scope

- Supabase Vault vs pgcrypto debate (pgcrypto is final for v1)
- Multi-org webhook routing (Phase 1 already routes by `locationId`)
- Self-service connect UI
- Encryption key rotation

## Settled decisions

- Per-org PIT in `ghl_connections.ghl_api_key` (bytea, `pgp_sym_encrypt`)
- Encryption key: Edge secret `GHL_API_KEY_ENCRYPTION_KEY` only — passed as RPC parameter (no Postgres GUC)
- Remove `locationMatchesEnv`; location from connection row only
- Do not delete legacy Edge secrets (rollback safety)
- Seed/update SQL user-run in Dashboard; no PIT/location IDs in repo
