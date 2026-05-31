# Implementation Plan: GHL Inbox — Multi-org support

**Branch**: `010-ghl-multi-org` | **Date**: 2026-05-21  
**Spec**: [spec.md](./spec.md) | **Prior art**: [009-ghl-inbox-readonly](../009-ghl-inbox-readonly/plan.md)

## Summary

Move GHL Private Integration Tokens from a global Edge secret to **per-org encrypted storage** on `public.ghl_connections`, decrypted only inside Edge Functions via a **SECURITY DEFINER** RPC that accepts `encryption_key` from `GHL_API_KEY_ENCRYPTION_KEY` (single source of truth — no Postgres GUC). Remove pilot guardrails (`GHL_LOCATION_ID` env check, global `GHL_API_KEY`). Frontend unchanged except explicit `select` columns excluding `ghl_api_key`.

## Technical Context

**Language**: TypeScript 5.x (React 18); Deno Edge Functions; SQL/PLpgSQL migrations  
**Storage**: `public.ghl_connections` + `extensions.pgcrypto`  
**Target**: Supabase `bfwohzcugtwbhhxdqgme`  
**Testing**: Manual quickstart smoke; `npm run build` + grep for PIT leakage  

## Project Structure

```text
supabase/migrations/
  └── YYYYMMDDHHmmss_ghl_connections_api_key.sql
supabase/functions/
  ├── _shared/ghlClient.ts          # refactor
  ├── ghl-fetch/index.ts            # call-site updates
  ├── ghl-mark-read/index.ts        # call-site updates
  └── ghl-webhook/index.ts          # no outbound GHL — audit only
src/modules/ghl-inbox/
  └── api/ghlInbox.api.ts           # explicit select columns
specs/010-ghl-multi-org/
  ├── spec.md, plan.md, data-model.md, quickstart.md, tasks.md
```

## Constitution check

| Principle | Status |
|-----------|--------|
| RLS / no PIT in browser | Pass — column REVOKE + no client decrypt |
| Additive migration | Pass — add column + function |
| Module boundaries | Pass — edge + migration only |
