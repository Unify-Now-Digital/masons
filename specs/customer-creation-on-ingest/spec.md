# Customer creation on ingest

**Status:** spec complete, ground-truthed 10 Aug 2026. Commit A landed.

## Problem

All ingestion paths (gmail sync ×3, twilio, GHL sync, proof-send) link
conversations to existing people via attemptAutoLink; none create
people. Manual Add-to-pipeline (resolvePersonId) is the only creation
path. SM state: 540 unlinked conversations; auto-linkable backlog = 0
(the only handle-matchable rows were test data); ~20 real prospects —
bereaved families on consumer email domains — are invisible to the
pipeline.

Payment→customer half verified complete: is_customer is derived by
recompute_person_is_customer, trigger wrappers attached, staleness
audit across SM returned zero mismatches (10 Aug).

## Scope: three commits

- **A. Data repair + invariant — DONE** (commit 082b2dc, 10 Aug)
- **B. Shared module: match correctness + creation** (edge functions)
- **C. Assisted create-from-thread (UI) + manual backfill pass**

C is not optional polish: the FR-5 gate deliberately fails closed, so
FR-6 is the safety net every gated-out real enquirer lands on.

## FR-1 Invariant: link_state='linked' ⇔ person_id IS NOT NULL — DONE

Row a4ea393a-e934-4a7b-b1a2-5e508c3e3d2c repaired (GHL web stub,
link_state 'linked' with null person_id; mechanism: frontend link path
where a runtime-undefined personId is dropped from the PATCH body).
CHECK constraint inbox_conversations_link_state_person_consistent
live, convalidated. Migration 20260810_inbox_link_state_invariant.sql.
Closes OQ-2: the nullable-personId class now fails loud at write time.

## FR-2 Handle-shape routing, centralized

Match strategy derives from the handle's shape — contains '@' → email
semantics, else phone (last-10-digit) — never from the row's channel.
GHL web rows can carry email handles (upsertStub: handle = phone ||
email), so channel-based routing structurally mislinks.

ghlConversationSync already derives shape at the call site; move the
derivation INSIDE attemptAutoLink so no caller can diverge
(single-authority, getOrderGroup precedent). Commit B opens with a
read-only call-site audit of the five other callers (gmail-sync-now,
inbox-gmail-sync, inbox-gmail-new-thread, twilio-sms-webhook,
proof-send) recorded as a table in research.md.

## FR-3 Email match correctness

attemptAutoLink's email match uses ilike with the raw handle as
pattern: '_' and '%' are wildcards, so john_smith@x.com also matches
johnasmith@x.com. Fix: escape wildcards before matching —
normalized.replace(/[\\%_]/g, m => '\\' + m) — and keep ilike.
eq-on-lowered is NOT suitable: people.email may be stored mixed-case
(only the index lowers it via lower(email), which PostgREST eq cannot
target), so eq would silently miss mixed-case rows. Normalization
contract unchanged — lower(trim(x)) on the handle side — matching the
org-scoped partial unique index
ON people (organization_id, lower(email)) WHERE email IS NOT NULL.

## FR-4 Auto-create on zero match

When attemptAutoLink finds 0 matches AND shouldAutoCreatePerson (FR-5)
passes:

- Insert person: organization_id stamped (fail closed without it, as
  attemptAutoLink already does); email lowered/trimmed OR phone; name
  from From-header display name — gmail sync captures fromHeader
  (getHeader('From'), ~line 242) — fallback to email local-part /
  phone digits; source marker created_via='inbox_ingest' so the UI can
  show auto-created contacts pending human review.
- GHL contact-name availability: check GhlSearchConversation shape at
  implementation time (implementation detail, not a blocker).
- Race safety: concurrent syncs of the same new sender → unique
  violation on the org-scoped email index → catch, re-query, link
  (upsert-on-(organization_id, lower(email)) semantics).
- Then link the conversation via the existing updateLinkState path.
- people carries an activity-log trigger: inserts write log rows —
  account for this in test teardown.
- Gated-out or failed-create rows remain 'unlinked' (never a partial
  state; FR-1's constraint enforces this at the DB).
- Creation fires only at inbound call sites via a createIfMissing option (default false); 
  outbound sites retain link-only behavior — see research.md.

## FR-5 Creation gate (final)

shouldAutoCreatePerson(handle, mutedSet):
1. normalized = normalizeHandle(handle)   — same fn as mute path (FR-5a)
2. normalized ∈ mutedSet                  → false  (veto, all sources)
3. no '@' (phone handle)                  → true
4. isRobotHandle(normalized)              → false  (existing predicate)
5. isStaffOrOwnHandle(normalized)         → false  (new)
6. domain ∈ CONSUMER_EMAIL_DOMAINS        → true   (new)
7. otherwise (business domain)            → false  → FR-6 assisted

Rationale (from SM domain rollup): every real prospect is on consumer
email; every business-domain sender is a supplier, insurer, SaaS,
relay (yourofficeandpa.co.uk, bark.com), or own infrastructure. An
allowlist matches the data's grain; a denylist enumerates an open set.
Miss cost is asymmetric by design: a missed real person = one assisted
click (FR-6); a junk auto-create = wrong data on the demo surface.

mutedSet: loaded once per sync run (not per message), org-scoped,
**unmuted_at IS NULL** — the SAME predicate as listMutedSenders / the
Hidden tab, so veto and Hidden can never drift. Tombstone semantics
respected: unmute restores visible AND creatable.

Invariants:
- hidden conversation ⇒ never auto-creates a person
- unmute ⇒ sender visible and creatable again
- visible ⇏ auto-create (relays/suppliers/staff visible by design)

Veto ordered before the phone short-circuit so manually muted phone
handles are also un-creatable (auto-mute is email-only; manual mutes
may not be).

CONSUMER_EMAIL_DOMAINS v1 (exact match on lowered domain; extend when
a real prospect's domain misses — that miss costs one click, never bad
data): gmail.com, googlemail.com, hotmail.com, hotmail.co.uk,
outlook.com, live.com, live.co.uk, yahoo.com, yahoo.co.uk, ymail.com,
icloud.com, me.com, mac.com, aol.com, btinternet.com,
btopenworld.com, sky.com, talktalk.net, virginmedia.com,
blueyonder.co.uk, ntlworld.com, protonmail.com, proton.me, mail.com,
gmx.com, gmx.co.uk

isStaffOrOwnHandle — exact handles + domain suffixes, compared lowered:
- Handles: arinmelvin@gmail.com, kotchlamazashvili.giorgi@gmail.com
  (staff-personal on consumer domains would otherwise pass step 6 —
  ArinMelvin@gmail.com appears in the unlinked data as proof)
- Domain suffixes (endsWith('.'+d) || === d, so lc.unifynow.digital is
  covered): searsmelvin.co.uk, unifynow.digital,
  **TODO-CHURCHILL-DOMAIN** — cannot be derived from data (Churchill
  has zero email conversations; their GHL merge is deferred). MUST be
  filled before Churchill ingestion goes live; not a Commit B blocker.

Placement: all predicates + list in _shared/mutedSenderPatterns.ts.
Predicates stay pure (mutedSet passed in by the caller). This feature
never writes inbox_muted_senders — muting remains the robot/manual
path; relays must stay visible.

## FR-5a normalizeHandle unification

Three implementations exist today: canonical frontend
(src/modules/inbox/utils/conversationGroupKey.ts, with lockstep
warning), a LOCAL COPY in twilio-sms-webhook/index.ts:12, and the
inline handle.trim().toLowerCase() in the auto-mute upserts. Commit B:
lift a canonical Deno normalizeHandle into _shared/ (semantics
identical to the frontend one), point twilio's local copy and the
veto at it, and replace the inline normalizations in the auto-mute
upserts. Frontend copy stays (different bundle) with reciprocal
lockstep comments. End state: exactly two copies, both commented.

## FR-6 Assisted create-from-thread (Commit C)

Inbox affordance on unlinked/ambiguous conversations: prefilled person
form (handle, parsed name), one confirm, then link via the existing
linkConversation path. Serves PA-relay threads, business-domain
enquirers (human decides person vs future companies-table entity —
don't preempt Part B), denylisted-but-real senders, and backfill.
Demo surface: FYI to Arin before it lands on staging.

## FR-7 Backfill = manual assisted pass

~20 identified SM prospects (freemail senders list, 10 Aug session)
created via FR-6, one by one. No bulk auto-create over historical
rows; automation is forward-only from deploy.

## Non-goals

- Body parsing of PA/webform relay mails (Phase 2 candidate)
- Backfill automation
- Hard-DELETE recompute gap (accepted under void-then-soft-delete)
- Muting/Hidden behavior changes (read-only dependency)

## Open questions

None blocking. Deferred to implementation: GHL contact-name field
shape; Churchill domain value (blocks their merge, not Commit B).

## Commit B deploy notes

Push before deploy. Touched functions redeployed via CLI
(supabase functions deploy …), respecting verify_jwt pins in
supabase/config.toml. Test via disposable-fixture pattern: fresh
sender address → verify person (name, org, created_via) + link →
reference-check → DELETE … RETURNING → read-back to zero, accounting
for activity-log rows.