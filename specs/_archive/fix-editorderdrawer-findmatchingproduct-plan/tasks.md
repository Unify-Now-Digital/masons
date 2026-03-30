# Tasks: EditOrderDrawer `findMatchingProduct`

## Implementation

- [x] **T1** In `EditOrderDrawer.tsx`, ensure `findMatchingProduct(o: Order, productList: UIProduct[]): string` exists **above** the `useEffect` that calls it (avoids temporal issues and keeps call site valid).
- [x] **T2** Implement priority: (1) `product_photo_url` ↔ `imageUrl` strict match → (2) `value` ↔ `price` with small tolerance → (3) `""`.
- [x] **T3** Wrap matcher in try/catch; never throw.
- [x] **T4** If a helper already exists with **reversed** priority (price first), swap step order only — no behavioural change elsewhere.

## Verification

- [ ] **V1** Edit Order → **New Memorial** order with known `product_photo_url` matching a product image → select shows correct product.
- [ ] **V2** Order with no photo but `value` matching a unique price → select resolves (or first of duplicates).
- [ ] **V3** Edit Order → **Renovation** → no crash; product cleared.
- [x] **V4** `npm run build` (or at least TypeScript check) on touched file.
