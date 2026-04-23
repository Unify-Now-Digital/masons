# Contract: `delete_organization` RPC

## Purpose

Hard-delete one organization and all dependent organization-scoped data, authorized for organization admins only.

## Signature

- **Name**: `public.delete_organization`
- **Invocation**: authenticated client via Supabase RPC
- **Arguments**:
  - `p_organization_id uuid` (required)
- **Security**: `SECURITY DEFINER`

## Authorization Rules

1. Caller must be authenticated.
2. Caller must be an admin member of `p_organization_id`.
3. If target organization does not exist or is not visible to caller, operation fails with a safe error.

## Behavior

1. Validate admin authorization.
2. Delete organization row in `public.organizations`.
3. Rely on verified FK cascade alignment for dependent org-scoped rows.
4. Return success if and only if delete completes.

## Expected Errors

- `UNAUTHORIZED`: Caller not authenticated.
- `FORBIDDEN`: Caller is not admin of target organization.
- `NOT_FOUND`: Target organization does not exist.
- `FAILED_PRECONDITION`: FK cascade alignment prevents delete (should be prevented by migration prep).

## Frontend Expectations

- Triggered from Settings danger action only.
- UI requires exact org-name confirmation before invocation.
- On success, frontend calls `refetchMemberships()` and updates active organization state automatically.
- No notifications sent to former members.
