# Quickstart — Managed WhatsApp Redesign Rollout

## Deployment order (safe, additive)

1. **Database migrations**
   - Create managed tables (`whatsapp_managed_connections`, `whatsapp_connection_events`).
   - Add inbox source attribution columns.
   - Add tenant `preferred_whatsapp_mode` defaulting to `manual`.
   - Apply RLS/policies for new tables.

2. **Deploy Edge Functions (new, then modified)**
   - New: managed onboarding + status + sync + provider webhook.
   - Modified: `inbox-twilio-send`, `twilio-sms-webhook`.
   - Keep manual functions (`whatsapp-connect`, `whatsapp-test`) operational.

3. **Set env/secrets**
   - Twilio provider credentials for managed orchestration.
   - Provider webhook signature secrets.
   - Existing Supabase envs (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).

4. **Frontend deploy**
   - Managed onboarding UI + status polling.
   - Separate manual panel retained.
   - Inbox/profile status surfaces updated to backend-driven status.

5. **Feature enablement**
   - Start with all tenants at `preferred_whatsapp_mode = manual`.
   - Enable managed mode only for internal/test tenants first.
   - Expand tenant cohorts gradually.

## Smoke checklist per environment

- Manual mode tenant:
  - Existing send/receive still works.
  - No behavior changes in normal operations.

- Managed mode tenant:
  - Onboarding shows pending/action_required states truthfully.
  - Outbound blocked with clear 409 while not connected.
  - Outbound succeeds after provider-ready conditions are met.
  - Inbound routes into correct tenant via provisioned sender identity.

- Cross-mode:
  - No silent mode switching on runtime failures.
  - Message records include source attribution fields.

## Rollback notes

- DB changes are additive; rollback by:
  - setting affected tenants back to `preferred_whatsapp_mode = manual`,
  - redeploying previous function versions if needed,
  - leaving new tables in place (no destructive rollback required).
- If provider-sync logic regresses, disable scheduled sync and keep manual mode active.
