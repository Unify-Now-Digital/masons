# Inbox Person Orders Panel — Implementation Plan

**Branch:** `feature/inbox-person-orders-panel`  
**Spec:** [inbox-person-orders-panel-embedded-order-details.md](./inbox-person-orders-panel-embedded-order-details.md)

---

## Plan Artifacts

| Artifact | Path |
|----------|------|
| Research | [inbox-person-orders-panel-plan/research.md](./inbox-person-orders-panel-plan/research.md) |
| Data Model | [inbox-person-orders-panel-plan/data-model.md](./inbox-person-orders-panel-plan/data-model.md) |
| Tasks | [inbox-person-orders-panel-plan/tasks.md](./inbox-person-orders-panel-plan/tasks.md) |
| Quickstart | [inbox-person-orders-panel-plan/quickstart.md](./inbox-person-orders-panel-plan/quickstart.md) |
| API Contracts | [inbox-person-orders-panel-plan/contracts/api-contracts.md](./inbox-person-orders-panel-plan/contracts/api-contracts.md) |

---

## Phase Summary

| Phase | Description |
|-------|-------------|
| **1** | Data layer: fetchOrdersByPersonId + useOrdersByPersonId |
| **2** | PersonOrdersPanel: orders list + embedded OrderDetailsSidebar |
| **3** | UnifiedInboxPage: activePersonId, selectedOrderId, layout split |
| **4** | QA |

---

## Commit Plan

1. "Add orders fetch by person id" — API + hook
2. "Show person orders panel in Inbox with embedded order details" — PersonOrdersPanel + wiring
