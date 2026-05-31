# Live Updates — Architecture Note (GHL Inbox)

Live inbox updates use GHL **workflow Custom Webhook actions**, NOT the platform Ed25519-signed webhooks (InboundMessage, OutboundMessage, etc.).

## Why this mechanism
Platform webhooks (the InboundMessage/OutboundMessage events with Ed25519 signatures, documented at marketplace.gohighlevel.com/docs/webhook/) are delivered only to Marketplace OAuth apps, not to Private Integration Token (PIT) integrations. Mason authenticates with PITs, so it cannot receive those platform webhooks. The workflow Custom Webhook action works with the account as-is (no OAuth app required) and is the correct mechanism for a PIT-based integration.

## How it works
- Each connected sub-account has a published GHL workflow named "Mason Inbox Sync" with three triggers: Customer Replied, Inbound Email, Call Details (all with no filters).
- The workflow's Webhook action POSTs to `https://bfwohzcugtwbhhxdqgme.supabase.co/functions/v1/ghl-webhook` with header `X-Webhook-Secret = <GHL_WORKFLOW_WEBHOOK_SECRET>`.
- ghl-webhook verifies the shared secret (constant-time compare), extracts `payload.location.id`, and pulses `ghl_connections.updated_at` for the matching active row.
- Frontend Realtime subscription on ghl_connections UPDATE → debounced (300-500ms) React Query invalidation → inbox refreshes within ~10s.

## Critical operational notes
- **ghl-webhook MUST be deployed with `--no-verify-jwt`.** Without it, Supabase's gateway rejects GHL's requests (which carry no Supabase JWT) before our code runs, returning UNAUTHORIZED_NO_AUTH_HEADER. **If live updates ever stop working, check this first** — a plain `supabase functions deploy ghl-webhook` (without the flag) silently re-enables JWT verification and breaks delivery.
- The webhook payload routes by location.id only. Both orgs' workflows POST to the same endpoint with the same secret; per-org routing is automatic.
- `_shared/ghlWebhookVerify.ts` (Ed25519/RSA verification) is retained but UNUSED — kept in case a future Marketplace OAuth app is built (Phase 2+).
- The "dedicated domain not configured" warning on the Inbound Email trigger means email auto-refresh may be less reliable until the client configures a dedicated sending domain in GHL. SMS/WhatsApp/calls are unaffected.
- Secret: `GHL_WORKFLOW_WEBHOOK_SECRET` (Edge Function secret). All per-org workflows share this single secret.

## Validation status
- Sears Melvin: full chain proven end-to-end (real inbound WhatsApp → live inbox update, no manual refresh).
- Churchill: function-side routing proven via direct call (correct row pulsed, only that row). Workflow-fires-on-real-message inferred from identical config to Sears Melvin; confirm passively when organic Churchill traffic moves ghl_connections.updated_at. (Live account — no synthetic test messages sent.)

## Adding a new org later
1. Seed ghl_connections row (location id + encrypted PIT) — see quickstart.md.
2. In that sub-account, create a "Mason Inbox Sync" workflow: 3 triggers (Customer Replied, Inbound Email, Call Details) + Webhook action with the real ghl-webhook URL and the X-Webhook-Secret header.
3. Publish. Routing is automatic via location.id; no code or redeploy needed.