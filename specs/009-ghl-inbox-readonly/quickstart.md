# Quickstart: GHL Inbox — Phase 1

## Prerequisites

- `npm run dev`
- Supabase project `bfwohzcugtwbhhxdqgme` linked locally
- Edge secrets: `GHL_API_KEY`, `GHL_LOCATION_ID` (no webhook shared secret — asymmetric verification only)
- Pilot org `ghl_connections` row (`status = active`)
- Arin completed `contracts/arin-webhook-setup.md`

## Deploy order

1. **Migration file** — commit `supabase/migrations/*_ghl_connections.sql` (Cursor)
2. **Apply migration** — **you** run that SQL in Supabase Dashboard → SQL Editor on `bfwohzcugtwbhhxdqgme` (Cursor does not push schema)
3. **Realtime** — **you** verify `ghl_connections` in Database → Replication (T004c)
4. **Seed pilot row** — **you** run insert SQL in Dashboard with real IDs (T005; not in migration file)
5. **Secrets** — **you** set `GHL_API_KEY`, `GHL_LOCATION_ID` in Edge Functions → Secrets (auto-injected vars omitted)
6. **Edge functions** — deploy `ghl-fetch`, `ghl-webhook`, `ghl-mark-read` (CLI)
7. **Smoke test** — `ghl-fetch` + webhook delivery
8. **Frontend** — route + module
9. **Arin** — register webhook URL + events

## 1) Database migration (file vs apply)

**In repo** (`T004a`): migration defines `public.ghl_connections` per `data-model.md` (RLS, indexes, trigger, Realtime publication SQL or comments). **No seed row in the migration.**

**In Dashboard** (`T004b`, `T004c`): review and execute the migration SQL; confirm Realtime.

**Pilot seed** (`T005`, separate Dashboard step — use real values, do not commit to git):

```sql
insert into public.ghl_connections (organization_id, ghl_location_id, status, last_verified_at)
values ('<ORG_UUID>', '<GHL_LOCATION_ID>', 'active', now());
```

## 2) Shared Edge helpers

**File**: `supabase/functions/_shared/ghlClient.ts`

- `ghlFetch(path, options)` — attaches PIT + Version header
- `getActiveConnection(supabase, organizationId)`

**File**: `supabase/functions/_shared/ghlWebhookVerify.ts`

- `verifyGhlWebhook(rawBody, headers)` — Ed25519 + RSA fallback

## 3) Edge functions

| Function | Auth | Notes |
|----------|------|-------|
| `ghl-fetch` | JWT | Action router per `contracts/ghl-fetch.md` |
| `ghl-mark-read` | JWT | Per `contracts/ghl-mark-read.md` |
| `ghl-webhook` | Signature | Pulse `updated_at` per `contracts/ghl-webhook.md` |

**Secrets** (Dashboard only): `GHL_API_KEY`, `GHL_LOCATION_ID`. Do not set `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.

Deploy functions only (not schema):

```bash
npx supabase functions deploy ghl-fetch --project-ref bfwohzcugtwbhhxdqgme
npx supabase functions deploy ghl-webhook --project-ref bfwohzcugtwbhhxdqgme
npx supabase functions deploy ghl-mark-read --project-ref bfwohzcugtwbhhxdqgme
```

## 4) Frontend module

```text
src/modules/ghl-inbox/
├── api/ghlInbox.api.ts       # invoke ghl-fetch, ghl-mark-read
├── hooks/
│   ├── useGhlConnection.ts   # read ghl_connections via Supabase
│   ├── useGhlConversations.ts
│   ├── useGhlMessages.ts
│   ├── useGhlContact.ts
│   └── useGhlInboxRealtime.ts
├── components/
│   ├── GhlConversationList.tsx
│   ├── GhlMessageThread.tsx
│   ├── GhlContactPanel.tsx
│   └── GhlReadOnlyComposer.tsx
├── pages/GhlInboxPage.tsx
└── index.ts
```

**Router** (`src/app/router.tsx`):

```tsx
<Route path="ghl-inbox" element={<GhlInboxPage />} />
```

**Nav**: Add sidebar link (Hub or Settings area — match product placement).

## 5) Manual verification

| # | Step | Expected |
|---|------|----------|
| 1 | Open `/dashboard/ghl-inbox` as org member | Conversation list loads |
| 2 | Select conversation | Messages + contact panel |
| 3 | Send WhatsApp to GHL number (Arin) | New message within ~10s |
| 4 | Mark as read | Badge clears in Mason + GHL |
| 5 | DevTools Network | No `pit-` token in requests |
| 6 | Composer | Disabled + Phase 2 label |
| 7 | Non-admin | Cannot edit connection row |

## 6) Lint

```bash
npm run lint
```

## Troubleshooting

- **Empty list**: Check `ghl_connections.status`, `GHL_LOCATION_ID`, PIT scopes.
- **No live updates**: Webhook delivery + Realtime on `ghl_connections` + browser subscription.
- **Mark read fails**: Log GHL `PUT` response; adjust body per `research.md` §3.
