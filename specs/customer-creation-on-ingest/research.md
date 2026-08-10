# Research: attemptAutoLink call-site audit (10 Aug 2026)

| File:line | Channel arg | Handle | Direction |
|---|---|---|---|
| gmail-sync-now:448 | 'email' | primaryHandle | inbound |
| gmail-sync-now:558 | 'email' | normalizedToEmail | outbound (To) |
| inbox-gmail-sync:366 | 'email' | primaryHandle | inbound |
| inbox-gmail-new-thread:243 | 'email' | trimmedTo | outbound |
| twilio-sms-webhook:454 | channel var | from.trim() | inbound |
| proof-send:455 | 'email' | customer_email.trim() | outbound |
| proof-send:570 | 'whatsapp' | toPhone | outbound |
| ghlConversationSync | shape-derived | handle | inbound (stubs) |

## Finding: 4 of 8 call sites are outbound

Outbound sites link by recipient. Auto-creating there is wrong:
proof-send's recipient should already exist (zero-match = data smell,
not new enquirer), and To-addresses carry no display name or enquiry
context.

## Decision: createIfMissing option

attemptAutoLink gains options { createIfMissing: boolean,
displayName?: string }, default false. Commit B ships in two steps:
1. Behavior-preserving refactor (FR-2 derivation moved inside, FR-3
   ilike escape, FR-5a normalize) — all 8 sites unchanged behavior.
2. Flip createIfMissing: true at the 4 inbound sites, passing parsed
   From-header displayName at gmail sites.

## Open (non-blocking)
twilio channel var possible values (sms only vs whatsapp) — confirm
with sed at implementation; moot once shape derivation lands.

## Amendment (10 Aug 2026) — gmail "inbound" rows are direction-mixed

Correction to the audit table (found during tasks.md generation, ruled
by Giorgi as discrepancy D3): the two rows classified as inbound —
gmail-sync-now:448 and inbox-gmail-sync:366 — in fact execute for
outbound-direction messages too. Both sites compute direction per
message (`direction = fromEmail === userEmail ? 'outbound' : 'inbound'`;
gmail-sync-now:288–289, inbox-gmail-sync:258–259) and then call
attemptAutoLink unconditionally, with `primaryHandle = toEmail` when
the direction is outbound.

Consequence: an unconditional `createIfMissing: true` at these sites
would auto-create people from RECIPIENT addresses, with displayName
parsed from the org's own From header — exactly the outbound-creation
mistake this audit's 4-of-8 finding warns against.

Ruling: creation at both sites must be direction-gated —
`createIfMissing: direction === 'inbound'`, and displayName passed only
when inbound. The call-site list and the outbound classification of the
other six rows are unchanged.