# Contract: Edge Functions and tenant scope

**Applies to**: `supabase/functions/**/*` that read/write tenant data with service role.

## Rules

1. **Authenticate** the caller (existing JWT / shared `getUserFromRequest` patterns).
2. **Resolve tenant**: For writes tied to a conversation/order/etc., load the resource and read its **`organization_id`**, or require a body field that must match membership:
   - `organization_id` is allowed **only if** `(user_id, organization_id)` exists in `organization_members` with appropriate role.
3. **Never** apply `organization_id` from the client as the sole authority without a membership check.
4. **Gmail / WhatsApp / Twilio** functions: resolve org from existing inbox rows or connection records that already carry `organization_id` after schema migration.

## Response shape

On missing membership or org mismatch, return **404** or **403** JSON error consistent with existing functions (avoid leaking whether a row exists in another org).
