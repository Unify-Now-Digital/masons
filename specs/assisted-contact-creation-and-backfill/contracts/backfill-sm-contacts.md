# Contract: backfill-sm-contacts (one-off edge function)

**Route**: `POST /functions/v1/backfill-sm-contacts` · **JWT verification: ENABLED** (plain
deploy, no `--no-verify-jwt`) · Invoked only by Giorgi with the service-role key as Bearer.
Deleted after evidence is recorded (`supabase functions delete backfill-sm-contacts`).

## Request

```json
{
  "organization_id": "<SM org uuid — required, explicit>",
  "mode": "dry-run" | "execute"   // default: "dry-run"
}
```

Refusals (400): missing/blank `organization_id`; unknown `mode`. The function never derives an
org from anywhere else — the explicit id in the body is the only tenant scope it will use
(AC-001). Non-POST → 405.

## Candidate predicate (both modes, identical)

Conversations in `organization_id` where **all** hold:
1. `person_id is null` and `link_state = 'unlinked'` (ambiguous excluded — candidates exist);
2. `primary_handle` contains `@` (email-shaped, FR-C1 — phone falls out here);
3. `channel != 'web'` (GHL stubs excluded regardless of handle shape, FR-C2).

`mutedSet` loaded once per invocation: `select normalized_handle from inbox_muted_senders
where organization_id = $org and unmuted_at is null` (same predicate as the ingest loaders).

## mode = "dry-run" (no writes)

For each candidate conversation, evaluate the **live** `shouldAutoCreatePerson(handle,
mutedSet)` (imported from `_shared/mutedSenderPatterns.ts` — AC-005) and probe for an existing
same-org person match (same normalized-email rule the linker uses). Response:

```json
{
  "mode": "dry-run",
  "organization_id": "…",
  "candidates": [
    {
      "handle": "jane@gmail.com",
      "conversation_ids": ["…", "…"],
      "gate_pass": true,
      "existing_person_id": null
    }
  ],
  "excluded_counts": { "web_stub": 0, "phone_shaped": 0, "ambiguous": 0, "gate_fail": 0 },
  "totals": { "unlinked_scanned": 0, "creatable_handles": 0, "conversations_affected": 0 }
}
```

This response IS the reviewed candidate list (FR-C4). No execute until Giorgi approves it.

## mode = "execute" (writes — requires prior dry-run review + explicit go)

Serially, ordered by handle then conversation id, for each candidate conversation whose
`gate_pass` holds, call the **live** `attemptAutoLink(admin, conversationId,
channelFromShape, handle, organizationId, { createIfMissing: true, mutedSet })`
(imported from `_shared/autoLinkConversation.ts`). This reuses, unmodified: the gate, the
person insert (`created_via='inbox_ingest'`, `is_test:false`, B3 naming fallback), the
23505 → re-query → link recovery, the `person_id`-already-set no-op (write-time re-check),
and the FR-1-safe atomic link write.

Serial execution makes same-handle groups deterministic: first conversation creates + links;
the rest hit the 1-match path and link to the same person (one person per handle, FR-C3 /
multi-conversation edge case).

Outcome per conversation is derived by re-reading the row after the call:

```json
{
  "mode": "execute",
  "results": [
    {
      "conversation_id": "…",
      "handle": "jane@gmail.com",
      "outcome": "created_and_linked" | "linked_existing" | "skipped_already_linked"
               | "skipped_gate" | "error",
      "person_id": "…" ,
      "error": null
    }
  ],
  "totals": { "people_created": 0, "conversations_linked": 0, "skipped": 0, "errors": 0 }
}
```

(`created_and_linked` vs `linked_existing` distinguished via `link_meta.created`.)

## Idempotency

Re-run is safe by construction: linked conversations no-op inside `attemptAutoLink`; existing
people are matched and linked, never duplicated (org-scoped unique index is the backstop).

## Evidence obligations (FR-C4, AC-004)

Both JSON responses plus post-execute read-back SELECTs (people created by count/`created_via`,
conversations linked, zero-rows proof for `channel='web'`/phone-handle untouched) are pasted
verbatim into `specs/assisted-contact-creation-and-backfill/backfill-evidence.md`.
