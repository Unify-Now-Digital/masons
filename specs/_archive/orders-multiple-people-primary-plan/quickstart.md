# Quickstart: Orders Multiple People with Primary

## Branch & Spec

- **Branch:** `feature/orders-multiple-people-primary`
- **Spec:** `specs/orders-multiple-people-primary-spec.md`

---

## Implementation Order

1. **Migration:** Create order_people table, constraints, indexes
2. **API:** fetchOrderPeople, upsertOrderPeople (with mirror to orders.person_id/person_name)
3. **Hooks:** useOrderPeople, useSaveOrderPeople; OrderPerson type
4. **CreateOrderDrawer:** Multi-select chips + primary selector; call upsertOrderPeople after create
5. **EditOrderDrawer:** Load from order_people; multi-select + primary; save via upsertOrderPeople

---

## Key Changes

| Area | Change |
|------|--------|
| order_people | New join table |
| CreateOrderDrawer | person_id Select → people[] chips + primary |
| EditOrderDrawer | Same |
| orderFormSchema | person_id → people array, primary_person_id |
| Create flow | create order → upsertOrderPeople → mirror |
| Edit flow | load order_people → edit → upsertOrderPeople → mirror |
