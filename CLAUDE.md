# CLAUDE.md

Guidance for Claude Code working in this repository. Read the multi-tenancy guardrails first.

## ⚠️ Multi-tenancy guardrails (read first)

This is a **multi-tenant** app. Every business row is scoped by `organization_id`. Two real orgs:

- **Churchill** — LIVE production data. Treat as customer-facing.
- **Sears Melvin** — pre-launch.

Rules — no exceptions without my explicit approval:
- **Never write directly to Churchill or Sears Melvin data** (no INSERT/UPDATE/DELETE, no
  data-touching migration) without my explicit per-change approval.
- **Always show diffs before applying** anything.
- **No `supabase db push`.** Schema changes are applied by hand.
- **Migrations → Supabase Dashboard SQL editor only** (paste and run). Keep the migration file
  in `supabase/migrations/` as the record of truth, but I run it in the dashboard.
- **Edge functions → Supabase CLI only** (`supabase functions deploy <name>`).
- Real org UUIDs, prod project ref, and test-org IDs live in `CLAUDE.local.md` (gitignored).

## Project overview

Memorial Mason Management — business management app for memorial masons (unified inbox, orders,
map, invoicing/finance, payments reconciliation, reporting, permit tracking). React + TypeScript
+ Vite frontend; Supabase (Postgres + Edge Functions + Auth) backend.

## Stack

- **Frontend**: React 18, TypeScript, Vite (SWC)
- **UI**: shadcn/ui, Tailwind CSS, Radix UI
- **State/Data**: TanStack React Query, React Hook Form + Zod
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth); Stripe, Revolut, GHL, WhatsApp,
  Gmail integrations
- **Routing**: React Router DOM v6 (nested routes)
- **Maps**: Google Maps + Leaflet

## Commands

```bash
npm run dev       # dev server
npm run build     # production build — NOTE: does NOT typecheck
npm run lint      # ESLint
npx tsc --noEmit  # typecheck — run this SEPARATELY before staging merges
```

## Branching

- Trunk / integration branch is **`staging`** (not `main`). PRs and merges target `staging`.

## Build discipline

`vite build` transpiles but does **not** run the TypeScript type checker. A build passing green
tells you nothing about type errors. **Run `npx tsc --noEmit` separately and get it clean before
merging to `staging`.**

## Migration evidence discipline

The migration file is the record of truth — which only works if what it records is true.

- **Backfill migrations must record evidence at apply time.** Capture the rows-affected count
  and paste the read-back SELECT output into the migration's comment block. Dashboard "Success"
  on a 0-row UPDATE looks identical to a real backfill — "applied" ≠ "rows affected".
- **Migration comments citing specific data must include proof.** Any comment referencing
  concrete records (invoice numbers, amounts, "verified preconditions") must include the
  verifying query and its actual output — narrative claims alone have already produced one
  false record (see the correction note in `20260607152534`).

## Money units (easy to get wrong)

Invoice/payment amounts mix two units:
- `amount` — decimal **GBP pounds** (e.g. `58236.20`).
- `intended_deposit_pence`, `amount_remaining`, `amount_paid` — **bigint pence**, returned from
  Supabase as **JS strings**. Always `Number()` them before math, and remember they are already
  in pence (don't multiply by 100 again).

Canonical helpers live in `src/modules/finance/utils/invoiceRemaining.ts` — reuse
`invoiceRemainingPence` / `formatInvoiceRemaining` rather than re-deriving balances.

## Import alias

`@/` → `src/`:
```typescript
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
```

## Repo structure

- `src/pages/` — route shells (`Dashboard.tsx` hosts nested routes)
- `src/modules/` — feature modules (inbox, orders, finance, invoicing, payments, reporting,
  permitTracker, hub, …), each with `api/`, `components/`, `hooks/`, `types/`
- `src/components/ui/` — shadcn primitives
- `src/integrations/supabase/` — client + generated types
- `supabase/` — migrations, edge functions, config (see `supabase/CLAUDE.md`)

## Security

Cross-tenant isolation findings and the RLS `security_invoker` fix are documented in
`specs/rls-isolation-findings.md`. Read it before touching org-scoped views or RLS.