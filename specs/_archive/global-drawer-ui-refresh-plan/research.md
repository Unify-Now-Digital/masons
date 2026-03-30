# Research: Global Drawer UI Refresh

## Drawer inventory (authoritative scope lock)

All drawers use shadcn `Drawer` (vaul) with `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerFooter`. No `Sheet` is used for create/edit flows; all are right-side or bottom drawers via vaul Drawer.

### Jobs
| Drawer | Path | Create/Edit | Size | Has sections | Needs sections |
|--------|------|-------------|------|--------------|----------------|
| CreateJobDrawer | `src/modules/jobs/components/CreateJobDrawer.tsx` | Create | medium | no | yes |
| EditJobDrawer | `src/modules/jobs/components/EditJobDrawer.tsx` | Edit | medium | no | yes |

### Orders
| Drawer | Path | Create/Edit | Size | Has sections | Needs sections |
|--------|------|-------------|------|--------------|----------------|
| CreateOrderDrawer | `src/modules/orders/components/CreateOrderDrawer.tsx` | Create | long | partial | yes |
| EditOrderDrawer | `src/modules/orders/components/EditOrderDrawer.tsx` | Edit | long | partial | yes |

### People (customers)
| Drawer | Path | Create/Edit | Size | Has sections | Needs sections |
|--------|------|-------------|------|--------------|----------------|
| CreateCustomerDrawer | `src/modules/customers/components/CreateCustomerDrawer.tsx` | Create | short | no | no |
| EditCustomerDrawer | `src/modules/customers/components/EditCustomerDrawer.tsx` | Edit | short | no | no |

### Companies
| Drawer | Path | Create/Edit | Size | Has sections | Needs sections |
|--------|------|-------------|------|--------------|----------------|
| CreateCompanyDrawer | `src/modules/companies/components/CreateCompanyDrawer.tsx` | Create | short | no | no |
| EditCompanyDrawer | `src/modules/companies/components/EditCompanyDrawer.tsx` | Edit | short | no | no |

### Products (memorials)
| Drawer | Path | Create/Edit | Size | Has sections | Needs sections |
|--------|------|-------------|------|--------------|----------------|
| CreateMemorialDrawer | `src/modules/memorials/components/CreateMemorialDrawer.tsx` | Create | short | no | optional |
| EditMemorialDrawer | `src/modules/memorials/components/EditMemorialDrawer.tsx` | Edit | short | no | optional |

### Inscriptions
| Drawer | Path | Create/Edit | Size | Has sections | Needs sections |
|--------|------|-------------|------|--------------|----------------|
| CreateInscriptionDrawer | `src/modules/inscriptions/components/CreateInscriptionDrawer.tsx` | Create | medium | no | yes |
| EditInscriptionDrawer | `src/modules/inscriptions/components/EditInscriptionDrawer.tsx` | Edit | medium | no | yes |

### Payments
| Drawer | Path | Create/Edit | Size | Has sections | Needs sections |
|--------|------|-------------|------|--------------|----------------|
| CreatePaymentDrawer | `src/modules/payments/components/CreatePaymentDrawer.tsx` | Create | short | no | no |
| EditPaymentDrawer | `src/modules/payments/components/EditPaymentDrawer.tsx` | Edit | short | no | no |

### Invoicing
| Drawer | Path | Create/Edit | Size | Has sections | Needs sections |
|--------|------|-------------|------|--------------|----------------|
| CreateInvoiceDrawer | `src/modules/invoicing/components/CreateInvoiceDrawer.tsx` | Create | long | partial | yes |
| EditInvoiceDrawer | `src/modules/invoicing/components/EditInvoiceDrawer.tsx` | Edit | long | partial | yes |

### Workers
| Drawer | Path | Create/Edit | Size | Has sections | Needs sections |
|--------|------|-------------|------|--------------|----------------|
| CreateWorkerDrawer | `src/modules/workers/components/CreateWorkerDrawer.tsx` | Create | short | no | no |
| EditWorkerDrawer | `src/modules/workers/components/EditWorkerDrawer.tsx` | Edit | short | no | no |

---

## Existing primitives

- **Drawer** (`src/shared/components/ui/drawer.tsx`): vaul-based, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerFooter`. Content is `fixed inset-x-0 bottom-0` with `h-auto`, mobile-first.
- **Sheet** (`src/shared/components/ui/sheet.tsx`): Radix-based, side variants. Not currently used for create/edit flows.
- **Accordion** (`src/shared/components/ui/accordion.tsx`): shadcn accordion for collapsible sections.
- **Collapsible** (`src/shared/components/ui/collapsible.tsx`): shadcn collapsible.

---

## Shared component location

Recommended: `src/shared/components/drawer/` or `src/components/drawer/` (if a shared non-ui folder exists). The repo uses `src/shared/components/` for reusable UI; drawer layout helpers fit there. Use `src/shared/components/drawer/` for `AppDrawerLayout`, `DrawerSection`, `DrawerGrid`.

---

## Technical constraints

- Presentation-only: no business logic, validation, schema, or API changes.
- Keep react-hook-form wiring, submit handlers, and field names intact.
- Use existing shadcn/ui components (Drawer, Accordion, etc.); no new deps.
- All drawers must have sticky header/footer; only body scrolls.
