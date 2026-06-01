# Quickstart: GHL Inbox — Phase 2 (Outbound Send)

**Branch**: `011-ghl-inbox-outbound` | **Prerequisites**: Phase 1 (`009`) + multi-org credentials (`010`) live

## Pre-implementation gates (do these first)

### G1 — Verify PIT scopes

For **each** production org (Churchill, Sears Melvin):

1. GHL → Settings → Private Integrations → select token → **Scopes**
2. Confirm **`conversations/message.write`** is enabled
3. If missing: regenerate PIT with that scope, re-encrypt into `ghl_connections.ghl_api_key` via Dashboard SQL (see [010 quickstart](../010-ghl-multi-org/quickstart.md))
4. Store new PIT in Bitwarden only — never commit or paste in chat

**Do not write send code until G1 passes for the test org.**

### G2 — Smoke-test send endpoint

Using a test sub-account PIT (not Churchill live contacts):

```bash
curl -s -X POST 'https://services.leadconnectorhq.com/conversations/messages' \
  -H 'Authorization: Bearer <TEST_PIT>' \
  -H 'Version: 2021-07-28' \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  --data '{
    "type": "SMS",
    "contactId": "<TEST_CONTACT_ID>",
    "conversationId": "<TEST_CONVERSATION_ID>",
    "message": "Mason outbound smoke test",
    "status": "pending"
  }'
```

If `400`/version error, retry with `Version: 2021-04-15`. Lock the working header + body in [contracts/ghl-send-message.md](./contracts/ghl-send-message.md).

### G3 — Test contact setup

1. Add **your own phone number** as a contact in a non-Churchill sub-account
2. Open that conversation in Mason GHL Inbox (read path must work first)
3. All first sends target this contact only

---

## Deploy order

| Step | Action | Who |
|------|--------|-----|
| 1 | Commit migration `supabase/migrations/*_ghl_outbound_send.sql` | Developer |
| 2 | Apply migration in Supabase Dashboard SQL Editor (`bfwohzcugtwbhhxdqgme`) | Operator |
| 3 | Schema cache refresh: `NOTIFY pgrst, 'reload schema';` | Operator |
| 4 | Deploy Edge Function `ghl-send-message` | Developer |
| 5 | Merge + deploy frontend (composer + hook) | Developer |
| 6 | Enable outbound for test org only (SQL below) | Operator |
| 7 | Run verification checklist | Developer |
| 8 | Enable per production org after clean test | Operator |

---

## Migration apply

After committing migration file, run in Dashboard (not auto-pushed):

```sql
-- Included in migration file; run as single script
-- Adds outbound_enabled + ghl_send_idempotency

NOTIFY pgrst, 'reload schema';
```

Verify:

```sql
select column_name from information_schema.columns
where table_name = 'ghl_connections' and column_name = 'outbound_enabled';

select count(*) from information_schema.tables
where table_name = 'ghl_send_idempotency';
```

---

## Enable outbound (per org, after clean test)

```sql
update public.ghl_connections
set outbound_enabled = true
where organization_id = '<TEST_ORG_UUID>';
-- Churchill: enable LAST, after Sears Melvin / test org validated
```

To disable quickly:

```sql
update public.ghl_connections
set outbound_enabled = false
where organization_id = '<ORG_UUID>';
```

---

## Edge Function deploy

```bash
npx supabase functions deploy ghl-send-message --project-ref bfwohzcugtwbhhxdqgme
```

**Do not** use `--no-verify-jwt` (only `ghl-webhook` uses that).

Required secrets (already present from Phase 1/010):

- `GHL_API_KEY_ENCRYPTION_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-injected)

---

## Manual verification checklist

### Send happy path

- [ ] Org with `outbound_enabled = true` and active connection
- [ ] Open test conversation (SMS / WhatsApp / Email as available)
- [ ] Compose message → Send → see sending state
- [ ] Message arrives on test phone/email
- [ ] Thread shows sent message after refresh (&lt;10s)
- [ ] Composer clears on success

### Feature flag

- [ ] Org with `outbound_enabled = false` → composer disabled with explanation
- [ ] Edge Function returns 403 if flag false (curl with JWT)

### Idempotency (critical)

- [ ] Rapid double-click Send → one GHL message only
- [ ] 20 stress attempts → zero duplicates on test contact
- [ ] Reused `requestId` after failure → 409; new click with new id works

### Error handling

- [ ] Empty/whitespace message → Send disabled / 400
- [ ] Disconnect network mid-send → draft preserved, error shown
- [ ] WhatsApp outside 24h window (if testable) → readable GHL error

### Multi-org isolation

- [ ] Member of org A cannot send via org B's connection
- [ ] Churchill remains disabled until explicit enable

### Security

- [ ] PIT not visible in browser network tab or bundle
- [ ] Non-member JWT → 403

---

## Frontend smoke (local)

```bash
npm run dev
# Navigate to /dashboard/ghl-inbox
# Select test conversation → send reply
```

Update list header copy when outbound enabled (remove "read-only" where appropriate).

---

## Rollback

1. `UPDATE ghl_connections SET outbound_enabled = false` for all orgs (instant kill switch)
2. Redeploy previous frontend if needed (disabled composer)
3. Edge Function can remain deployed — flag + 403 prevents sends
4. Migration is additive; rollback does not require dropping tables

---

## Environment reminders

| Item | Value |
|------|--------|
| Production Supabase ref | `bfwohzcugtwbhhxdqgme` |
| GHL base URL | `https://services.leadconnectorhq.com` |
| Version header | `2021-07-28` (confirm G2) |
| Location IDs | Copy via GHL UI only (I vs l) |
| Secrets | Bitwarden first |

---

## Related docs

- [plan.md](./plan.md) — implementation phases
- [research.md](./research.md) — decisions
- [data-model.md](./data-model.md) — schema
- [contracts/ghl-send-message.md](./contracts/ghl-send-message.md) — API contract
- [phase-2-ghl-outbound-handoff.md](../phase-2-ghl-outbound-handoff.md) — project context
