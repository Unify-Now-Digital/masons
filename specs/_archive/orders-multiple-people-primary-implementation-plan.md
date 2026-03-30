# Orders Multiple People with Primary — Implementation Plan

**Branch:** `feature/orders-multiple-people-primary`  
**Spec:** [orders-multiple-people-primary-spec.md](./orders-multiple-people-primary-spec.md)

---

## Plan Artifacts

| Artifact | Path |
|----------|------|
| Research | [orders-multiple-people-primary-plan/research.md](./orders-multiple-people-primary-plan/research.md) |
| Data Model | [orders-multiple-people-primary-plan/data-model.md](./orders-multiple-people-primary-plan/data-model.md) |
| Tasks | [orders-multiple-people-primary-plan/tasks.md](./orders-multiple-people-primary-plan/tasks.md) |
| Quickstart | [orders-multiple-people-primary-plan/quickstart.md](./orders-multiple-people-primary-plan/quickstart.md) |
| API Contracts | [orders-multiple-people-primary-plan/contracts/api-contracts.md](./orders-multiple-people-primary-plan/contracts/api-contracts.md) |

---

## Phase Summary

| Phase | Description |
|-------|-------------|
| **1** | DB: create order_people table |
| **2** | API: fetchOrderPeople, upsertOrderPeople |
| **3** | Hooks + types: useOrderPeople, useSaveOrderPeople |
| **4** | UI: CreateOrderDrawer + EditOrderDrawer multi-select + primary |
| **5** | QA |

---

## Commit Plan

1. "Create order_people join table"
2. "Add Orders API + hooks for order_people"
3. "Multi-select People with primary in order drawers"
