# Implementation plan: EditOrderDrawer `findMatchingProduct` crash fix

## Context

- **Bug:** `ReferenceError: findMatchingProduct is not defined` in `EditOrderDrawer.tsx` when the `useEffect` that hydrates `selectedProductId` runs without a matching helper in scope.
- **Constraint:** No DB/schema migration; `Order` has no `product_id`; linkage remains **heuristic** via `product_photo_url` and `value` snapshots.
- **Approved approach:** Restore a **local** helper in `EditOrderDrawer.tsx` only.

## Constitution / specify workflow

- `bash .specify/scripts/bash/setup-plan.sh --json` was **not executed successfully** in this environment (PowerShell / bash invocation).
- `.specify/memory/constitution.md` and `.specify/templates/plan-template.md` are **not present** in this repo; AGENTS.md / CLAUDE.md govern stack and conventions instead.

## Success criteria

1. Opening **Edit Order** for any order type never throws from product hydration.
2. **New Memorial:** `selectedProductId` best-effort matches catalog when snapshots align; empty string when no safe match.
3. **Renovation:** product selection remains cleared (existing `useEffect` branch unchanged).
4. No new migrations; no new persisted columns.

## Matching priority (required order)

Implement `findMatchingProduct(order, products): string`:

1. **Primary — `product_photo_url` → `UIProduct.imageUrl`**  
   - If `order.product_photo_url` is truthy, find first product where `product.imageUrl` is truthy and **strictly equal** to `order.product_photo_url`.  
   - If found, return that `product.id`.

2. **Fallback — `order.value` → `UIProduct.price`**  
   - If `order.value` is a finite number, find first product where `price` is finite and `Math.abs(price - value) <= tolerance` (e.g. `0.0001`).  
   - If found, return that `product.id`.

3. **Else** return `""`.

Wrap the body in **try/catch**; on any error return `""`.

## Files to change

| Absolute path | Change |
|---------------|--------|
| `c:\Users\owner\Desktop\unify-memorial-mason-main\src\modules\orders\components\EditOrderDrawer.tsx` | **Add** the helper if missing, or **reorder** steps inside existing helper to match priority above. **Do not** change `useEffect` dependencies unless a lint rule requires it. |

**Single-file scope:** no other files required for the crash fix or priority change.

## Type adjustments

- **None required** if using existing `Order` and `UIProduct` (`price`, `imageUrl` already on `UIProduct` via `productTransform.ts`).

## Edge cases

| Case | Behaviour |
|------|-----------|
| Multiple products share same price | `.find` returns **first** in `productList` order — arbitrary but stable for a given load order; document as limitation. |
| Missing `product_photo_url` | Skip step 1; try price; else `""`. |
| Missing / non-finite `value` | Skip step 2 after step 1 fails; else `""`. |
| Renovation orders | Existing branch clears `selectedProductId`; helper not needed for Renovation. |
| Photo URL changed in catalog after order | Snapshot URL may no longer match `imageUrl` → may fall back to price or `""`. |
| User manually changed `value` | Price match may point to wrong product or fail — heuristic limitation. |

## Risks / limitations (heuristic)

- Cannot be 100% accurate without `orders.product_id`.
- Price collision and manual edits can mis-select or leave selection empty.
- Strict URL equality fails if storage/CDN normalizes URLs differently over time.

## Suggested branch name

`fix/editorderdrawer-findmatchingproduct` (optional; not created by automation here).

## Progress (manual)

- [x] Phase 0 — Research / spec alignment (this document)
- [x] Phase 1 — Data model: none (no schema)
- [x] Phase 2 — Tasks: see `tasks.md`
