# Quickstart: Verify organisation management (004-org-member-roles)

## Prerequisites

- Local or staging Supabase with migrations **through this feature** applied.  
- Two test accounts **A** and **B** (email/password) where **A** is **Admin** of at least one org.  
- App running (`npm run dev`) pointed at that project.

## Manual UI checks

1. **Sign in as A** → **Settings**.  
2. **Create organisation**: open modal, enter name, submit.  
   - Expect: success toast (or equivalent), modal closes, **active org** is the new one (after refetch + set active).  
   - **Org switcher** (if visible with 2+ orgs): still works; **no** new UI inside switcher for creation.  
3. **Add B by email**: enter **B**’s email, submit.  
   - Expect: **B** appears in member list as **Member**.  
   - Wrong / unknown email → clear **not found** message, no invite.  
4. **Promote B** to Admin via role control → succeeds while **A** remains Admin.  
5. **Demote A** to Member while **B** is Admin → succeeds.  
6. **Attempt last-admin demote**: with only one Admin left, try demoting them → **blocked** + message.  
7. **Attempt last-admin remove**: try removing sole Admin → **blocked** + message.  
8. **Sign in as B** (Member only org) → Settings: **no** member-management panel (or controls hidden).

## Optional SQL checks (service role / SQL editor)

Run only in trusted environments; adjust UUIDs.

- Call **`create_organization`** as a test user and assert row in `organizations` + `organization_members` with `role = 'admin'`.  
- Call **`add_organization_member_by_email`** with a bogus email → expect error.  
- Call **`remove_organization_member`** / **`change_member_role`** as non-admin JWT → expect permission error.  
- Attempt SQL `delete from organization_members` that would remove last admin → trigger blocks.

## Regression

- Load dashboard with **multiple memberships**: confirm **`OrgSwitcher`** unchanged (layout, labels, switching).  
- Run **`npm run lint`** after frontend tasks.
