# Edge Functions tenant audit (002-multi-org-tenancy)

**Date**: 2026-04-11  
**Contract**: [contracts/edge-function-tenant.md](./contracts/edge-function-tenant.md)

| Function | Service-role writes | Tenant verification |
|----------|----------------------|---------------------|
| `gmail-send-reply` | `inbox_messages`, `inbox_conversations` | Uses `../_shared/organizationMembership.ts`; resolves org from conversation / connection; inserts `organization_id`. |
| `gmail-sync-now` | `inbox_conversations`, `inbox_messages` | Resolves org from `gmail_connections.organization_id` + membership; sets `organization_id` on inserts. |
| `twilio-sms-webhook` | `inbox_conversations`, `inbox_messages` | Resolves org from connection `organization_id` + membership; sets `organization_id` on inserts/updates. |

**Remaining functions**: Re-audit any function that uses `SUPABASE_SERVICE_ROLE_KEY` on `public.*` tables and apply the same pattern (authenticate caller → resolve allowed `organization_id` → verify membership → write).
