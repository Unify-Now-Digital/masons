# Split Phone Tab into SMS + WhatsApp — Implementation Plan

**Branch:** `feature/split-phone-tab-sms-whatsapp`  
**Spec:** [split-phone-tab-sms-whatsapp-unified-inbox.md](./split-phone-tab-sms-whatsapp-unified-inbox.md)

---

## Plan Artifacts

| Artifact | Path |
|----------|------|
| Research | [split-phone-tab-sms-whatsapp-plan/research.md](./split-phone-tab-sms-whatsapp-plan/research.md) |
| Data Model | [split-phone-tab-sms-whatsapp-plan/data-model.md](./split-phone-tab-sms-whatsapp-plan/data-model.md) |
| Tasks | [split-phone-tab-sms-whatsapp-plan/tasks.md](./split-phone-tab-sms-whatsapp-plan/tasks.md) |
| Quickstart | [split-phone-tab-sms-whatsapp-plan/quickstart.md](./split-phone-tab-sms-whatsapp-plan/quickstart.md) |
| API Contracts | [split-phone-tab-sms-whatsapp-plan/contracts/api-contracts.md](./split-phone-tab-sms-whatsapp-plan/contracts/api-contracts.md) |

---

## Phase Summary

| Phase | Description |
|-------|-------------|
| **0** | Confirm channel values (SQL sanity check) |
| **1** | Types: remove `'phone'`, ensure `'sms'` / `'whatsapp'` |
| **2** | API: remove phone alias, use direct channel filter |
| **3** | UI: 5 tabs, filter mapping |
| **4** | QA |

---

## Commit Plan

Single commit: **"Split Phone tab into SMS and WhatsApp"**
