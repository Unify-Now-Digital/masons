# People ↔ Inbox Linking — Implementation Plan

**Branch:** `feature/people-inbox-linking`  
**Spec:** [people-inbox-linking-people-first-inbox.md](./people-inbox-linking-people-first-inbox.md)

---

## Plan Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Research | [people-inbox-linking-plan/research.md](./people-inbox-linking-plan/research.md) | Phase 0 discovery — exact file paths, write patterns |
| Data Model | [people-inbox-linking-plan/data-model.md](./people-inbox-linking-plan/data-model.md) | Migration schema, indexes, types |
| Tasks | [people-inbox-linking-plan/tasks.md](./people-inbox-linking-plan/tasks.md) | Phase 1–5 task breakdown |
| API Contracts | [people-inbox-linking-plan/contracts/api-contracts.md](./people-inbox-linking-plan/contracts/api-contracts.md) | Filters, link/unlink, auto-link |
| Quickstart | [people-inbox-linking-plan/quickstart.md](./people-inbox-linking-plan/quickstart.md) | Implementation order, key files |

---

## Phase Summary

| Phase | Description | Deliverable |
|-------|-------------|-------------|
| **0** | Discovery | research.md — confirmed file paths |
| **1** | Database migration | person_id, link_state, link_meta + indexes |
| **2** | Auto-link in Edge Functions | _shared helper, twilio-sms-webhook, inbox-gmail-sync |
| **3** | Frontend data layer | Types, filters, link/unlink API, hooks |
| **4** | UI | People sidebar, layout, Link modal, Conversation header |
| **5** | QA | Auto-link, ambiguous, manual link/unlink, archive |

---

## Commit Plan

1. Migration
2. Edge functions auto-link
3. Frontend filters + sidebar
4. Link modal + ambiguous handling + polish

---

## Execution

Run implementation phase-by-phase using `tasks.md`. Start with Phase 1 (migration), then Phase 2 (Edge Functions), then Phase 3–4 (frontend).
