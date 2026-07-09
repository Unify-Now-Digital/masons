# Contract: Inbox view state (URL + localStorage)

This is the compatibility contract the implementation MUST satisfy. It is the testable surface of the feature (no API/schema contracts exist — frontend-only).

## URL parameters (on `/dashboard/inbox`)

| Param | Values | Absent means | Notes |
|---|---|---|---|
| `view` | `all`, `triage`, `customers` | stored preference, else `customers` | invalid values = absent (and are stripped) |
| `board` | `1` | board off | never persisted |
| `segment` | *(legacy)* `enquiries` | — | normalized away on mount (see matrix) |
| `conversation` | conversation id | no preselect | MUST survive normalization; consumed at `UnifiedInboxPage.tsx:105-106` |
| `channel` | `email`, `whatsapp`, `sms` | all channels | unchanged |
| `gmail`, `error` | OAuth flow | — | unchanged; MUST survive normalization |

## Normalization matrix (one-shot on mount, history `replace`)

| Incoming URL | Resulting URL | Resulting view |
|---|---|---|
| `?segment=enquiries` | `?view=triage` | triage, board off |
| `?segment=enquiries&conversation=X` | `?view=triage&conversation=X` | triage, conversation X preselected |
| `?segment=enquiries&view=all` | `?view=all` | all (new param wins) |
| `?segment=bogus` | *(param stripped)* | default resolution |
| `?view=triage` | unchanged | triage |
| `?view=bogus` | *(param stripped)* | default resolution |
| *(none)* | unchanged | default resolution |

**Default resolution**: localStorage `inbox.desktop.view.v2` if valid → else migrate `inbox.desktop.viewMode.v1` (`customers`→`customers`, `conversations`→`all`; write v2, leave v1) → else `customers`.

## localStorage keys

| Key | Written by | Read by | Values |
|---|---|---|---|
| `inbox.desktop.view.v2` | new code, on every view change | new code, default resolution | `all`, `triage`, `customers` |
| `inbox.desktop.viewMode.v1` | **no longer written** | new code, one-time migration only | `conversations`, `customers` (legacy) |

## Behavioral invariants

1. `/dashboard/enquiry-triage` (router alias) continues to land the user on the triage view with any `conversation` preselect intact — **without any change to `src/app/router.tsx`**.
2. Browser back after N view switches steps back through the N URL states... except switches use history `replace` for *normalization* only; explicit user view switches use `replace: true` to match today's `segment`/`channel` idiom. (Spec US3 scenario 4 is satisfied at the granularity today's segment switch already provides; do not introduce push-history behavior change beyond current.)
3. Triage view membership: `aging != null && (ball.side === 'us' || level !== 'fresh')`; pills and channel filters intersect with it; the red-only "N stuck" pill remains a strict subset filter.
4. With `board=1`, the left list area shows `EnquiryPipelineBoard` exactly as `segment=enquiries` does today (queries enabled, mark-in-progress, select). With board off, `enquiry_stage` progression stays reachable via the existing per-row action.
5. `EnquiryCreateOrderPanel` shows for a selected, order-less conversation when `board=1` **or** `view=triage` (the only deliberate gate widening).
6. Every gate listed in research.md inventories V1–V14 / S1–S6 is remapped per the bijection; none deleted, none newly firing in a state where its old equivalent did not fire (except invariant 5).
7. Collapsed left rail keeps mirroring `displayConversations` in all views (known v1 gap: conversation avatars even in customer view).
8. GHL source (`inboxSource === 'ghl'`) untouched.
