# FR-007 Audit Note: Stripe Line-Item Label Implementations

**Date**: 2026-08-26 | **Phase**: A2 (documentation-only — zero code changes)
**Question**: do the four sync-by-comment implementations of the order line label rule
produce identical labels for the same order today?

## Verdict

**Base label rule: NO divergence.** All four implementations produce byte-identical base
labels for any given order, including edge cases (null/whitespace `order_type`, missing
product names, Renovation fallback). Verified by side-by-side read 2026-08-26.

**Full Stripe line-item string: ONE cosmetic divergence.** The order-reference prefix
separator differs between functions — `"ORD-000123 · "` (middle dot) in two functions vs
`"ORD-000123 "` (space only) in the third. Payers see slightly different strings depending
on which payment path produced the line. Detail below.

## The four implementations

| # | Location | Function name | Typing |
|---|---|---|---|
| 1 | `src/modules/orders/utils/orderLineLabel.ts:10` | `orderLineLabel` | typed `Pick<Order,…>`, optional `productNameById?` |
| 2 | `supabase/functions/stripe-create-invoice/index.ts:74` | `baseProductLabel` | typed `OrderRow` |
| 3 | `supabase/functions/stripe-create-invoice-payment-link/index.ts:189` | `baseProductName` | **untyped** `Record<string, unknown>` + casts |
| 4 | `supabase/functions/stripe-create-checkout-session/index.ts:61` | `baseProductDescription` | typed `OrderRow` |

## Rule equivalence check (base label)

All four implement, with only syntactic differences:

- `order_type === 'Renovation'` → `` `Renovation — ${renovation_service_description?.trim() || 'Renovation service'}` ``
- Otherwise name chain: `custom_product_name?.trim()` → product name via `productNameById`
  map keyed by `product_id` → `[material, color].filter(Boolean).join(' · ')` → `'Memorial'`;
  `sku` deliberately excluded everywhere (grave number, not a product name).
- Type segment: `order_type?.trim() || 'Order'` → `` `${typeSegment} — ${name}` ``.

Edge-case parity confirmed: #3's cast style (`(o.order_type as string) || ''` then
`orderType.trim() || 'Order'`, `index.ts:190,202`) yields the same output as the optional
chaining in #1/#2/#4 for null, undefined, and whitespace-only `order_type`.

## Divergence found (outside the base rule): prefix separator

The Stripe line-item string is `prefix + baseLabel`, and the prefix differs:

| Function | Prefix construction | Example line |
|---|---|---|
| stripe-create-invoice (`index.ts:380–381`) | `formatOrderId` → `` `${ref} · ` `` | `ORD-000123 · New Memorial — Black Granite` |
| stripe-create-checkout-session (`index.ts:329–330`) | `formatOrderId` → `` `${ref} · ` `` | `ORD-000123 · New Memorial — Black Granite` |
| stripe-create-invoice-payment-link (`index.ts:208–216`) | `formatOrderId` → `` `${orderIdStr} ` `` (space, no `·`) | `ORD-000123 New Memorial — Black Granite` |

`formatOrderId` itself is identical (ORD- + 6-digit pad:
`stripe-create-invoice-payment-link/index.ts:169–172`,
`stripe-create-checkout-session/index.ts:53–55`). Cosmetic only; recorded, NOT fixed this
cycle (FR-007 is documentation-only).

## Drift risks (for a future hardening cycle — no action now)

1. **Incomplete sync-comment graph**: each server copy's NOTE names only the other two
   server copies ("keep all three in sync" — `stripe-create-invoice/index.ts:72–73`,
   `stripe-create-invoice-payment-link/index.ts:187–188`,
   `stripe-create-checkout-session/index.ts:59–60`). None mentions the client canon.
   Only the client's header (`orderLineLabel.ts:7–8`) names all three servers. A change
   starting server-side can legitimately believe it synced "all three" and miss the client.
2. **Four different function names** (`orderLineLabel` / `baseProductLabel` /
   `baseProductName` / `baseProductDescription`) — a grep for any one name finds one copy.
   Greps must use rule fragments (e.g. `'Renovation service'` or `join(' · ')`).
3. **#3 is untyped**: `Record<string, unknown>` casts mean a column rename breaks it
   silently at runtime while #2/#4 fail at typecheck (edge functions are Deno — outside
   `tsc -p tsconfig.app.json`; the `deno check` gate applies).
4. Edge functions deploy via CLI only, per `supabase/CLAUDE.md` — any future sync fix
   must remember the per-function JWT flags.

## Method

Side-by-side read of all four function bodies (file:line above) plus their call sites
(`stripe-create-invoice/index.ts:383–439`,
`stripe-create-invoice-payment-link/index.ts:206–247`,
`stripe-create-checkout-session/index.ts:328–377`). No code executed against production;
no code changed.
