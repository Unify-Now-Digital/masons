# Tasks: customer creation on ingest — Commit B (shared module)

Generated 10 Aug 2026 from spec.md + plan.md + research.md (dbb3d3b), with
line anchors re-verified against the working tree on staging (12423e8).
Amended 10 Aug 2026: Giorgi's rulings on discrepancies D1–D5 applied
(T005 no-op; T021/T023 direction-gated; see ## Discrepancies).

Ground rules (apply to every task):
- No task deploys anything before the Deploy section. No task runs git —
  Giorgi performs all commits/pushes and runs all gates.
- After every edit: grep-confirm the change on disk (exact-match) before
  moving on.
- Line numbers below are anchors, not addresses — re-grep before editing;
  earlier tasks in the same file shift later anchors.

Commit boundaries (from plan.md, one concern each):
1. **Commit 1 = B1 + B2** — behavior-preserving refactor + pure predicates.
   Zero behavior change; nothing deployed.
2. **Commit 2 = B5** — DONE (already landed).
3. **Commit 3 = B3 + B4** — creation enabled. Deploy only after this lands.

Dependency shape: B1 tasks are sequential within each file; tasks touching
different files (T004–T008, T010–T012) are parallel-eligible [P], but under
the diff-approval protocol execution is one reviewed diff at a time. B3
depends on B1+B2; B4 depends on B3.

---

## Commit 1 — B1 + B2 (behavior-preserving, zero behavior change)

### B1 — Refactor attemptAutoLink + normalizeHandle unification

- [ ] **T001 — Add options param to attemptAutoLink**
  File: `supabase/functions/_shared/autoLinkConversation.ts` (fn at :43)
  Change: extend the signature with a trailing optional param:
  `opts?: { createIfMissing?: boolean; displayName?: string }`, default
  `createIfMissing: false` (i.e. absent opts ≡ today's behavior). Do not
  read `opts` anywhere yet beyond defaulting it.
  Stays the same: all logic, all return paths, all 8 call sites compile
  unchanged (trailing optional param).

- [ ] **T002 — Move handle-shape derivation inside attemptAutoLink**
  File: `supabase/functions/_shared/autoLinkConversation.ts`
  Change: derive the match strategy from the handle, not the channel:
  `const strategy = rawHandle.includes('@') ? 'email' : 'phone'` —
  replace the three `channel === 'email'` branches (:73, :80, :84) with
  `strategy === 'email'`. `channel` param stays in the signature as
  metadata only (logging/link_meta); update the doc comment (:27–:42) to
  say strategy derives from handle shape (FR-2, single-authority).
  Stays the same: callers unchanged — including ghlConversationSync:226,
  whose call-site shape derivation becomes redundant but harmless.
  Behavior note: for every existing caller, handle shape agrees with the
  channel arg it passes, so outcomes are identical.

- [ ] **T003 — FR-3: escape ilike wildcards in the email match**
  File: `supabase/functions/_shared/autoLinkConversation.ts` (:84–:93)
  Change: before `.ilike(...)`, escape `\`, `%`, `_` in the pattern:
  `const pattern = normalizedHandle.replace(/[\\%_]/g, (m) => '\\' + m);`
  and pass `pattern` to `.ilike(matchColumn, pattern)`.
  Stays the same: keep ilike (NOT eq — people.email may be stored
  mixed-case; only the index lowers it, which PostgREST eq can't target).
  Normalization contract unchanged: lower/trim on the handle side.

- [ ] **T004 — [P] FR-5a: create shared normalizeHandle (Deno twin)**
  Files: `supabase/functions/_shared/normalizeHandle.ts` (new),
  `src/modules/inbox/utils/conversationGroupKey.ts` (comment only)
  Change: new `_shared/normalizeHandle.ts` exporting `normalizeHandle`
  with semantics copied EXACTLY from `conversationGroupKey.ts:17–22`
  (trim; empty → ''; contains '@' → lowercase; else strip non-digits,
  keep last 10). Lockstep comment pointing at the frontend file. Then
  update the frontend file's lockstep comment (:3–:7) to reference
  `supabase/functions/_shared/normalizeHandle.ts` reciprocally (it
  currently points at autoLinkConversation.ts).
  Stays the same: frontend function body untouched (different bundle).
  End state per spec: exactly two copies, both commented.

- [x] **T005 — twilio-sms-webhook local normalizeHandle → shared**
  **RESOLVED AS NO-OP (D1 ruling, 10 Aug 2026).** The local function at
  `twilio-sms-webhook/index.ts:12–:14` is NOT semantically a copy (it
  trims + strips the `whatsapp:` prefix; no lowercase, no last-10 slice)
  and it feeds the STORED `primary_handle` (:60–:61). Ruling: leave it
  as-is, no rename, no repoint — the FR-5 veto normalizes internally via
  shouldAutoCreatePerson (T012), so twilio needs no shared-fn import.
  No edit to this file in B1.

- [ ] **T006 — [P] Auto-mute upsert normalization → shared (gmail-sync-now)**
  File: `supabase/functions/gmail-sync-now/index.ts` (:434)
  Change: import `normalizeHandle` from
  `../_shared/normalizeHandle.ts`; replace
  `normalized_handle: primaryHandle.trim().toLowerCase()` with
  `normalized_handle: normalizeHandle(primaryHandle)`.
  Stays the same: behavior — the upsert is gated by `isRobotHandle`
  (email-only), and for email handles normalizeHandle ≡ trim+lowercase.

- [ ] **T007 — [P] Auto-mute upsert normalization → shared (inbox-gmail-sync)**
  File: `supabase/functions/inbox-gmail-sync/index.ts` (:352)
  Change: same substitution as T006.
  Stays the same: behavior, for the same isRobotHandle reason.

- [ ] **T008 — [P] Auto-mute upsert normalization → shared (ghlConversationSync)**
  File: `supabase/functions/_shared/ghlConversationSync.ts` (:210)
  Change: same substitution as T006 (`handle.trim().toLowerCase()` →
  `normalizeHandle(handle)`), import from `./normalizeHandle.ts`.
  Stays the same: behavior (isRobotHandle-gated, email-only).
  Note: plan B1.4 says "both" upserts; this is the third — D2 ruling
  (10 Aug): all three covered.

- [ ] **T009 — B1 gate (Giorgi runs)**
  No file changes. Verify: (a) grep shows all 8 attemptAutoLink call
  sites textually unchanged (gmail-sync-now:448, :558;
  inbox-gmail-sync:366; inbox-gmail-new-thread:243;
  twilio-sms-webhook:454; proof-send:455, :570; ghlConversationSync:223)
  and no caller passes `opts`; (b)
  `npx tsc --noEmit -p tsconfig.app.json` → exactly 55 errors. Deploy
  nothing.

### B2 — Gate predicates (pure functions, no DB)

- [ ] **T010 — CONSUMER_EMAIL_DOMAINS v1**
  File: `supabase/functions/_shared/mutedSenderPatterns.ts`
  Change: export `const CONSUMER_EMAIL_DOMAINS: ReadonlySet<string>` with
  exactly the spec FR-5 v1 list (26 domains): gmail.com, googlemail.com,
  hotmail.com, hotmail.co.uk, outlook.com, live.com, live.co.uk,
  yahoo.com, yahoo.co.uk, ymail.com, icloud.com, me.com, mac.com,
  aol.com, btinternet.com, btopenworld.com, sky.com, talktalk.net,
  virginmedia.com, blueyonder.co.uk, ntlworld.com, protonmail.com,
  proton.me, mail.com, gmx.com, gmx.co.uk. Comment: exact match on
  lowered domain; extend when a real prospect's domain misses (miss =
  one assisted click, never bad data).
  Stays the same: existing ROBOT_LOCAL_PART_REGEX / isRobotHandle.

- [ ] **T011 — isStaffOrOwnHandle**
  File: `supabase/functions/_shared/mutedSenderPatterns.ts`
  Change: export `isStaffOrOwnHandle(normalized: string): boolean` —
  exact handles: `arinmelvin@gmail.com`,
  `kotchlamazashvili.giorgi@gmail.com`; domain suffixes compared lowered
  via `domain === d || domain.endsWith('.' + d)` for: `searsmelvin.co.uk`,
  `unifynow.digital`, plus a commented `TODO-CHURCHILL-DOMAIN`
  placeholder (MUST be filled before Churchill ingestion; not a Commit B
  blocker). Input is the already-normalized handle.
  Stays the same: everything else in the file.

- [ ] **T012 — shouldAutoCreatePerson (7-step gate)**
  File: `supabase/functions/_shared/mutedSenderPatterns.ts`
  Change: export `shouldAutoCreatePerson(handle: string,
  mutedSet: ReadonlySet<string>): boolean` — spec signature per the D4
  ruling (10 Aug): takes the raw handle, normalizes inside as step 1.
  Implements spec FR-5's order exactly:
  1. `normalized = normalizeHandle(handle)` (import from
     `./normalizeHandle.ts` — same fn as the mute path, FR-5a)
  2. `mutedSet.has(normalized)` → false (veto, before the phone
     short-circuit, so manually muted phone handles are un-creatable)
  3. no '@' → true (phone)
  4. `isRobotHandle(normalized)` → false
  5. `isStaffOrOwnHandle(normalized)` → false
  6. domain ∈ CONSUMER_EMAIL_DOMAINS → true
  7. otherwise → false (business domain → FR-6 assisted path)
  Pure: mutedSet passed in by the caller; this feature never writes
  inbox_muted_senders.
  Stays the same: no DB access anywhere in this file.

- [ ] **T013 — B2 gate + Commit 1 handoff (Giorgi runs)**
  No file changes. `npx tsc --noEmit -p tsconfig.app.json` → exactly 55.
  Giorgi commits B1+B2 together as **Commit 1** (zero behavior change).

---

## Commit 2 — B5: people.created_via — DONE, no tasks

Landed: migration `20260810_people_created_via.sql` (commit 2c6d25a),
types regen (commit 38e704b), read-back verified. Carry-forward facts B3
must honor: `last_name` REQUIRED non-null (split displayName on last
space, else `''`); stamp `is_test: false` explicitly; `company_id` stays
null; `created_via` is free text (no CHECK until FR-6 adds
'inbox_assisted').

---

## Commit 3 — B3 + B4 (creation enabled)

### B3 — Creation branch in attemptAutoLink

- [ ] **T014 — Extend opts with mutedSet**
  File: `supabase/functions/_shared/autoLinkConversation.ts`
  Change: opts type becomes `{ createIfMissing?: boolean;
  displayName?: string; mutedSet?: Set<string> }`. mutedSet is loaded by
  the CALLER once per sync run and passed in — attemptAutoLink must not
  issue a per-conversation SELECT for it.
  Stays the same: default behavior with opts absent.

- [ ] **T015 — Creation-branch gating (zero-match path)**
  File: `supabase/functions/_shared/autoLinkConversation.ts` (the
  `ids.length === 0` fall-through, currently :132)
  Change: in the zero-match path: if `!opts?.createIfMissing` → existing
  `updateLinkState(..., 'unlinked', ...)` exactly as today. Else compute
  `shouldAutoCreatePerson(rawHandle, opts.mutedSet ?? new Set())`
  (import from `./mutedSenderPatterns.ts`); gate fails → same unchanged
  unlinked write. Gated-out rows are 'unlinked', never partial (FR-1
  CHECK constraint is the DB backstop).
  Stays the same: 1-match and >1-match paths.

- [ ] **T016 — Person insert + link (happy path)**
  File: `supabase/functions/_shared/autoLinkConversation.ts`
  Change: when the gate passes, insert into `people`:
  - `organization_id` stamped (orgId already fail-closed above)
  - email-shaped handle → `email: normalizedHandle` (lowered/trimmed);
    else `phone: rawHandle`
  - name: if `opts.displayName` contains a space → `first_name` = text
    before the last space, `last_name` = text after it; no space →
    `first_name = displayName`, `last_name: ''`; no displayName →
    `first_name` = email local-part (email) or the handle's digits
    (phone), `last_name: ''`. last_name always non-null (B5 note).
  - `created_via: 'inbox_ingest'`, `is_test: false`; `company_id`
    omitted (null — FR-6/Part B decides).
  Then `updateLinkState(supabaseAdmin, conversationId, 'linked', newId,
  { created: true })`. On non-unique-violation insert failure → existing
  unlinked write (never partial).
  Stays the same: updateLinkState itself; activity-log trigger on
  `people` fires on insert (test teardown accounts for it).

- [ ] **T017 — Race safety: 23505 → re-query → link**
  File: `supabase/functions/_shared/autoLinkConversation.ts`
  Change: catch insert error code `23505` (org-scoped unique index on
  `(organization_id, lower(email))`): re-query `people` by
  `organization_id` + ilike with the T003-escaped normalized email, and
  link the found id via `updateLinkState(..., 'linked', id, {})`;
  re-query empty → unlinked. Upsert-on-(org, lower(email)) semantics.
  Stays the same: phone-handle inserts have no unique index — no 23505
  path needed there (per plan).

- [ ] **T018 — B3 gate (Giorgi runs)**
  No file changes. `npx tsc --noEmit -p tsconfig.app.json` → exactly 55.
  Grep: no call site passes `createIfMissing` yet (creation still dead
  code until B4).

### B4 — Flip the 4 inbound call sites (list = research.md, verified)

- [ ] **T019 — GhlSearchConversation shape check (plan's first B4 task)**
  File: none (read-only; record result here).
  RESULT (verified 10 Aug against `_shared/ghlConversationSync.ts:37–45`):
  the type is `{ id, phone, email, lastMessageDateMs, lastMessageType,
  lastMessageBody, unreadCount }` — **no contact-name field**. Therefore
  the GHL flip (T024) passes NO displayName; B3's fallback naming
  (email local-part / phone digits) applies.

- [ ] **T020 — mutedSet loader (gmail-sync-now)**
  File: `supabase/functions/gmail-sync-now/index.ts`
  Change: once per invocation, after `tenantOrgId` resolves and before
  message processing: `select normalized_handle from inbox_muted_senders
  where organization_id = tenantOrgId and unmuted_at is null` → build
  `Set<string>`. Same predicate as listMutedSenders/Hidden (tombstone
  semantics: unmute restores creatable).
  Stays the same: no call site touched yet.

- [ ] **T021 — Flip gmail-sync-now:448 (inbound, direction-gated per D3)**
  File: `supabase/functions/gmail-sync-now/index.ts` (:448)
  Change: pass `{ createIfMissing: direction === 'inbound', displayName,
  mutedSet }` where `displayName` = `direction === 'inbound'` ?
  (`/^\s*"?([^"<]*)"?\s*</` applied to `fromHeader` (:281) → group 1
  trimmed, else `undefined`) : `undefined`. D3 ruling (10 Aug): this
  site executes for outbound-direction messages too (`primaryHandle =
  toEmail` when `fromEmail === userEmail`, :288–:289), so creation AND
  displayName are both gated on `direction === 'inbound'`.
  Stays the same: gmail-sync-now:558 (SENT/outbound path) — untouched;
  link-only behavior for outbound-direction messages at this site.

- [ ] **T022 — mutedSet loader (inbox-gmail-sync)**
  File: `supabase/functions/inbox-gmail-sync/index.ts`
  Change: same loader as T020, after `tenantOrgId` resolves (:200–:213),
  before the message loop (:220).
  Stays the same: no call site touched yet. (Minor: see D5 — :366 links
  with `orgIdForMessage`, loader scopes to `tenantOrgId`.)

- [ ] **T023 — Flip inbox-gmail-sync:366 (inbound, direction-gated per D3)**
  File: `supabase/functions/inbox-gmail-sync/index.ts` (:366)
  Change: pass `{ createIfMissing: direction === 'inbound', displayName,
  mutedSet }`, displayName parsed from `fromHeader` (:242) with the same
  regex as T021 and likewise only when `direction === 'inbound'`
  (direction computed at :258), else `undefined`. D3 ruling (10 Aug).
  Stays the same: everything else in the loop; link-only behavior for
  outbound-direction messages.

- [ ] **T024 — Flip twilio-sms-webhook:454 (inbound)**
  File: `supabase/functions/twilio-sms-webhook/index.ts` (:454)
  Change: load mutedSet once (one message per webhook invocation), after
  org resolution and before the call; pass
  `{ createIfMissing: true, mutedSet }`. No displayName — B3's
  phone-digit fallback names the person.
  Stays the same: signature validation, TwiML responses, channel
  detection.

- [ ] **T025 — Flip ghlConversationSync (inbound stubs)**
  File: `supabase/functions/_shared/ghlConversationSync.ts`
  Change: load mutedSet once in `syncGhlConversations` (:237, org from
  the connection row), thread it into `upsertStub` (signature gains a
  `mutedSet: Set<string>` param), and at the attemptAutoLink call
  (:223–:229) pass `{ createIfMissing: true, mutedSet }`. No displayName
  (T019 result).
  Stays the same: the channel arg expression at :226 (metadata-only
  since T002); caller of syncGhlConversations (`ghl-webhook`) unchanged.

- [ ] **T026 — Verify outbound sites untouched (grep, no edits)**
  Files: none. Grep-confirm these four calls pass NO opts (link-only):
  `gmail-sync-now:558` (outbound To), `inbox-gmail-new-thread:243`
  (OUTBOUND), `proof-send:455` (outbound email), `proof-send:570`
  (outbound whatsapp). Matches research.md's 4-of-8 outbound finding:
  auto-creating there is wrong (zero-match = data smell, not enquirer).

- [ ] **T027 — B4 gate + Commit 3 handoff (Giorgi runs)**
  No file changes. `npx tsc --noEmit -p tsconfig.app.json` → exactly 55;
  `npm run lint` → baseline 10 errors / 16 warnings, nothing new.
  Giorgi commits B3+B4 together as **Commit 3** (creation enabled).

---

## Deploy (Giorgi, only after Commit 3 is committed AND pushed)

- [ ] **T028 — Redeploy every function whose import graph changed**
  Per plan + `supabase/config.toml` verify_jwt pins:
  - `supabase functions deploy gmail-sync-now`
  - `supabase functions deploy inbox-gmail-sync`
  - `supabase functions deploy inbox-gmail-new-thread` (refactor touched
    its import; behavior unchanged)
  - `supabase functions deploy proof-send` (same)
  - `supabase functions deploy twilio-sms-webhook --no-verify-jwt`
    (pinned; plain deploy breaks inbound with 401s)
  - `supabase functions deploy ghl-webhook --no-verify-jwt` (pinned;
    sole importer of ghlConversationSync)

## Test (Giorgi-approved disposable-fixture pattern, after deploy)

- [ ] **T029 — Happy path**: fresh gmail address → email SM inbox → sync
  → verify person row (name from display name, org stamped,
  `created_via='inbox_ingest'`), conversation linked, activity-log rows
  present.
- [ ] **T030 — Muted veto**: mute the fixture handle, second fresh
  thread from it → conversation stays 'unlinked', no person created.
- [ ] **T031 — Teardown**: reference-check → `DELETE … RETURNING id` for
  fixture person + conversations → read-back to zero, accounting for
  activity-log rows (people insert trigger).

---

## Discrepancies — ALL RULED ON BY GIORGI, 10 Aug 2026

- **D1 — twilio "local copy" is not a copy. RULED: accepted — T005 is a
  no-op.** Spec FR-5a and plan B1.4 describe
  `twilio-sms-webhook/index.ts:12` as a local copy of normalizeHandle to
  be repointed at the shared one. It isn't: it only trims and strips a
  leading `whatsapp:` prefix — no lowercase, no last-10-digit slice —
  and its output becomes the STORED `primary_handle` (:60–:63) and the
  To-number routing value. Repointing it would rewrite stored handles
  (e.g. `+447700900123` → `7700900123`) — a behavior change inside the
  "zero behavior change" Commit 1. Ruling: leave the twilio function
  as-is, no rename; the FR-5 veto normalizes internally via
  shouldAutoCreatePerson (T012), so twilio needs no change in B1.

- **D2 — "both" auto-mute upserts is an undercount. RULED: accepted —
  all three covered (T006–T008).** Plan B1.4 says "both"; three exist:
  gmail-sync-now:434, inbox-gmail-sync:352, ghlConversationSync:210.
  Spec FR-5a says "the auto-mute upserts" (no count). All three are
  isRobotHandle-gated (email-only), so the substitution is
  behavior-preserving at each.

- **D3 — the two gmail "inbound" sites also fire for outbound-direction
  messages. RULED: accepted — creation direction-gated.** research.md
  classifies gmail-sync-now:448 and inbox-gmail-sync:366 as inbound, but
  both compute direction per message (`fromEmail === userEmail →
  outbound`) and then call attemptAutoLink unconditionally with
  `primaryHandle = toEmail` for outbound messages. An unconditional
  `createIfMissing: true` there would auto-create people from RECIPIENT
  addresses, with displayName parsed from the org's own From header.
  Ruling: at both sites pass `createIfMissing: direction === 'inbound'`,
  and gate displayName the same way (T021/T023 updated). research.md
  carries a dated amendment correcting its two gmail call-site rows.

- **D4 — shouldAutoCreatePerson signature: spec vs plan. RULED:
  accepted — spec signature.** Spec FR-5 (marked final) takes the raw
  handle and normalizes as step 1; plan B2.3 writes
  `shouldAutoCreatePerson(normalized, mutedSet)`. T012 follows the spec
  (normalize inside, via the shared fn).

- **D5 — minor org-scope nuance in inbox-gmail-sync. RULED: accepted as
  noted — no extra guard.** The :366 call links with `orgIdForMessage`
  (an existing conversation's org, :311), while T022's mutedSet loads
  for `tenantOrgId`. Equal in practice; the mismatch is a conscious
  acceptance, not an oversight.

- **Resolved at research time, recorded for completeness:**
  GhlSearchConversation has no contact-name field (T019), so the plan's
  "contact name if the shape has one" resolves to no displayName at the
  GHL site. research.md's ghlConversationSync row has no line anchor;
  the call is at `_shared/ghlConversationSync.ts:223`.

---

## Verification gates

Restated from plan + working agreements; these gate every commit:

- **Typecheck**: `npx tsc --noEmit -p tsconfig.app.json` → exactly **55**
  pre-existing errors, **0 new**. (Bare `npx tsc --noEmit` checks nothing
  — solution tsconfig.) Run before each commit handoff (T009, T013,
  T018, T027).
- **Lint**: `npm run lint` → baseline **10 errors / 16 warnings**,
  nothing new (Commit 3 gate, T027).
- **Grep-confirm on disk after each edit** — every task's change is
  verified by exact-match grep before the next task starts; stop on any
  failed exact match.
- **Giorgi runs all gates and performs all git operations** (commits,
  pushes) and all deploys. Conditional approvals block until an explicit
  go. `vite build` passing proves nothing about types.
