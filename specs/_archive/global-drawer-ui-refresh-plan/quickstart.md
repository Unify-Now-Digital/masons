# Quickstart: Global Drawer UI Refresh

## Run the app

```bash
cd c:\Users\owner\Desktop\unify-memorial-mason-main
npm install
npm run dev
```

## Test drawers

Open each drawer and verify:

1. **Sticky header** — Title, optional description, close button stay visible at top.
2. **Sticky footer** — Cancel and Create/Save always visible; no scrolling to reach them.
3. **Body scroll** — Only the form body scrolls; header/footer stay fixed.
4. **Compact layout** — Less vertical whitespace; 2-col grids for common pairs.
5. **Consistent width** — Desktop `w-[720px] max-w-[90vw]`; responsive on small screens.

### Drawer locations

- **Orders:** Orders page → Create Order, Edit Order (click row)
- **Invoicing:** Invoicing page → Create Invoice, Edit Invoice (click row)
- **Jobs:** Jobs page → Create Job, Edit Job (click row); Jobs Map → Create Job
- **People:** Customers page → Create Person, Edit Person (click row)
- **Companies:** Companies page → Create Company, Edit Company (click row)
- **Products:** Memorials page → Create Product, Edit Product (click row)
- **Inscriptions:** Inscriptions page → Create Inscription, Edit Inscription (click row)
- **Payments:** Payments page → Create Payment, Edit Payment (click row)
- **Workers:** Workers page → Create Worker, Edit Worker (click row)

## Build

```bash
npm run build
npm run lint
```
