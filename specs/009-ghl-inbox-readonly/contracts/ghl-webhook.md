# Contract: `ghl-webhook` Edge Function

## Purpose

Receive GHL webhook POSTs, verify signatures, map `locationId` → organisation, pulse `ghl_connections.updated_at` for Realtime-driven React Query invalidation.

## Transport

- **Method**: `POST` only (OPTIONS for CORS if needed)
- **URL**: `{SUPABASE_URL}/functions/v1/ghl-webhook`
- **Auth**: None (public endpoint); security via signature verification

## Headers (from GHL)

| Header | Verification |
|--------|----------------|
| `X-GHL-Signature` | Ed25519 (preferred) |
| `X-WH-Signature` | RSA-SHA256 (legacy fallback until 2026-07-01) |

Read raw body as text before JSON parse (signature is over raw bytes).

## Payload shape (illustrative)

GHL sends JSON with top-level `type` matching webhook event name, e.g.:

```json
{
  "type": "InboundMessage",
  "locationId": "l1C08ntBrFjLS0elLIYU",
  "conversationId": "fcanlLgpbQgQhderivVs",
  "contactId": "cI08i1Bls3iTB9bKgFJh",
  "messageId": "…",
  "dateAdded": "2021-04-21T11:31:45.750Z"
}
```

Exact fields vary by `type`; handler only requires `locationId` for routing. Optionally read `conversationId` for future targeted invalidation (Phase 1: org-wide pulse is sufficient).

## Handled `type` values

| `type` | Action |
|--------|--------|
| `InboundMessage` | Pulse connection row |
| `OutboundMessage` | Pulse connection row |
| `ContactCreate` | Pulse connection row |
| `ContactUpdate` | Pulse connection row |
| Other | Log at info, return 200 (ignore) |

## Server behaviour

1. Verify signature → 400 if invalid.
2. Parse JSON; extract `locationId` (or nested `data.locationId` if wrapper format — confirm on first live webhook).
3. `UPDATE ghl_connections SET updated_at = now() WHERE ghl_location_id = $1 AND status = 'active'`.
4. Return `200` `{ "ok": true }` quickly (no GHL API calls in webhook path).

## Response

Always return **200** for verified, parseable events (even if no matching connection) to avoid GHL retry storms. Return **400** only for invalid signature or malformed body.

## Secrets / config (Phase 1 posture A)

| Env | Purpose |
|-----|---------|
| `SUPABASE_URL` | DB client |
| `SUPABASE_SERVICE_ROLE_KEY` | Update `ghl_connections` |

**No `GHL_WEBHOOK_SECRET`**. Verification uses asymmetric headers only — see `research.md` §5 and [Webhook Integration Guide — Security](https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/#security-verifying-webhook-authenticity). Public keys are **constants** in `supabase/functions/_shared/ghlWebhookVerify.ts` (copied from that doc section, not loaded from env).

## Frontend subscription

```typescript
supabase
  .channel(`ghl-inbox:${organizationId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'ghl_connections',
      filter: `organization_id=eq.${organizationId}`,
    },
    debouncedInvalidate,
  )
  .subscribe();
```

Debounce 300–500 ms; invalidate `ghlInboxKeys.conversations` and active `messages` query.
