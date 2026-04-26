# Quickstart: Delete Organization and Bulk Inbox Delete

## Prerequisites

- Checked out branch `005-delete-org-bulk-inbox`
- Local Supabase migration workflow available
- Seed/test organization with:
  - at least one admin
  - at least one non-admin member
  - inbox conversations/messages across email/SMS/WhatsApp

## Implementation Order (Migration First)

## 1) Database migrations

1. Add migration for FK cascade verification/alignment on organization-scoped foreign keys.
2. Add SECURITY DEFINER RPC migration:
   - `delete_organization(p_organization_id uuid)`
   - admin check required before delete
3. Add SECURITY DEFINER RPC migration:
   - `delete_conversations(p_conversation_ids uuid[])`
   - member/ownership checks + max 50 guard
4. Add/adjust grants for authenticated execution only.

## 2) Frontend integration

1. Settings:
   - Add red/danger "Delete organisation" action.
   - Add confirmation modal with exact org-name match requirement.
   - Invoke `delete_organization` RPC.
   - On success call `refetchMemberships()` and rely on existing active-org fallback behavior.
2. Inbox:
   - Add hover checkbox per row.
   - Add select-all in list header (bounded to 50).
   - Show delete toolbar action when 1+ selected with count.
   - Add confirmation dialog.
   - Invoke `delete_conversations` RPC and on success clear selection + invalidate inbox queries.

## Manual Verification

## A) Delete organization

1. Login as org admin.
2. Open Settings and trigger delete action.
3. Confirm delete button is disabled until exact org name is entered.
4. Submit deletion and verify:
   - org-scoped data removed
   - if user has other orgs, next org becomes active
   - if no orgs remain, onboarding state appears
5. Login as former member and verify no access remains.

## B) Bulk delete conversations

1. Open Inbox with mixed-channel conversations.
2. Verify hover checkbox appears on rows.
3. Select multiple rows and confirm toolbar delete action shows selected count.
4. Use select-all and verify total selected never exceeds 50.
5. Confirm dialog text format: `Delete X conversations? This cannot be undone`.
6. Confirm deletion and verify:
   - selected conversations no longer listed
   - associated messages removed
   - selection cleared
   - list refreshed

## Regression Checks

- Single-conversation delete still works.
- Mark read/unread actions still function after selection changes.
- No access regressions for non-admin Settings users.
