# Plan: customer creation on ingest — Commit B (shared module)

Prereqs: spec.md + research.md (dbb3d3b). Commit C (UI) is a separate
plan, not covered here.

## Step B1 — Refactor, behavior-preserving (no semantic change)
File: supabase/functions/_shared/autoLinkConversation.ts
1. Add options param: attemptAutoLink(supabase, conversationId,
   channel, handle, orgId, opts?: { createIfMissing?: boolean;
   displayName?: string }) — default createIfMissing: false.
2. Move handle-shape derivation inside: strategy = handle contains '@'
   ? email : phone. channel param becomes metadata-only (keep for
   logging/link_meta; callers unchanged).
3. FR-3: replace ilike with eq-on-lowered (preferred over escaping —
   handle is already lowered/trimmed; .eq('email', normalized) won't
   match mixed-case DB values, so keep ilike BUT escape _ and % :
   normalized.replace(/[\\%_]/g, m => '\\' + m). Note: eq is wrong
   here precisely because people.email may be stored mixed-case;
   the index is on lower(email), which PostgREST eq can't target.
4. FR-5a: create _shared/normalizeHandle.ts (Deno twin of
   conversationGroupKey.normalizeHandle — copy semantics EXACTLY,
   reciprocal lockstep comments both sides). Point twilio-sms-webhook's
   local copy at it; replace inline trim().toLowerCase() in both
   auto-mute upserts.
Gate: deploy nothing yet. tsc baseline 55. Diff review: all 8 call
sites compile unchanged; grep confirms no caller passes opts.

## Step B2 — Gate predicates
File: supabase/functions/_shared/mutedSenderPatterns.ts
1. Add CONSUMER_EMAIL_DOMAINS (spec FR-5 list, v1).
2. Add isStaffOrOwnHandle (exact handles + suffix domains;
   TODO-CHURCHILL-DOMAIN placeholder stays, commented).
3. Add shouldAutoCreatePerson(normalized, mutedSet) implementing the
   7-step order from spec FR-5 (veto → phone → robot → staff →
   consumer → default false).
Gate: pure functions, no DB. tsc 55.

## Step B3 — Creation branch
File: autoLinkConversation.ts, inside the ids.length === 0 path:
1. If !opts.createIfMissing → current behavior (unlinked), unchanged.
2. Else: caller supplies mutedSet? No — load here, once per… NO:
   mutedSet loaded by caller once per sync run and passed via opts
   (opts.mutedSet: Set<string>). Keeps attemptAutoLink from issuing
   a per-conversation SELECT.
3. shouldAutoCreatePerson fails → unlinked, unchanged.
4. Passes → insert people row: organization_id, email (lowered) OR
   phone, first_name from opts.displayName (fallback: email
   local-part / phone digits), last_name '' or split from
   displayName on last space, created_via='inbox_ingest'.
5. Unique-violation catch (code 23505) → re-query by
   (organization_id, ilike-escaped email) → link that id.
6. updateLinkState(…, 'linked', newId, { created: true }).
Gate: tsc 55. FR-1 constraint is the DB backstop.

## Step B4 — Flip inbound call sites (4 sites, from research.md)
- gmail-sync-now:448, inbox-gmail-sync:366: opts { createIfMissing:
  true, displayName: parsed From display name, mutedSet }.
  From parsing: /^\s*"?([^"<]*)"?\s*</ on fromHeader → group 1
  trimmed, else undefined.
- inbox-gmail-new-thread:243: OUTBOUND (research.md) — untouched.
- twilio-sms-webhook:454: { createIfMissing: true, mutedSet } (no
  displayName; phone-digit fallback name).
- ghlConversationSync attemptAutoLink call: { createIfMissing: true,
  mutedSet, displayName: contact name if GhlSearchConversation has
  one — check shape here, first task of B4 }.
- mutedSet load per function: one SELECT normalized_handle …
  unmuted_at IS NULL per sync invocation, before the message loop.
Gate: tsc 55, lint baseline 10/16.

## Step B5 — created_via column
people needs created_via (or reuse an existing source column — CHECK
FIRST: grep database.types.ts for people row shape). If absent:
Dashboard migration, SELECT-first… it's ADD COLUMN, so: ALTER TABLE
people ADD COLUMN created_via text; + forward-only migration file.
Sequence this BEFORE B3 deploys (code references it).

## Deploy (after all steps committed + pushed)
supabase functions deploy for: gmail-sync-now, inbox-gmail-sync,
twilio-sms-webhook, and the GHL entry function(s) importing
ghlConversationSync + every function importing autoLinkConversation
(includes proof-send, inbox-gmail-new-thread — refactor touched their
import even though behavior unchanged). Respect config.toml
verify_jwt pins.

## Test (disposable-fixture)
Fresh gmail address → email SM inbox → sync → verify: person row
(name from display name, org stamped, created_via), conversation
linked, activity-log rows present. Muted-sender test: mute the
fixture handle, second fresh thread → stays unlinked. Teardown:
reference-check → DELETE person/conversations RETURNING → read-back
zero.

## Commit boundaries (one concern each)
1. B1+B2 (refactor + predicates, zero behavior change)
2. B5 (migration)
3. B3+B4 (creation enabled)