# Data model: Organisation management and member roles

## Entities

### Organisation (`public.organizations`)

| Field (logical) | Required | Notes |
|-----------------|----------|--------|
| `id` | yes | Primary key (UUID) |
| `name` | yes | Display name from Settings / `create_organization` |
| `created_at` / `updated_at` | yes | Existing columns |

**Relationships**: One organisation has many **memberships**.

### Organisation membership (`public.organization_members`)

| Field (logical) | Required | Notes |
|-----------------|----------|--------|
| `id` | yes | Surrogate key (UUID); used by list RPC but **not** by mutation RPC params |
| `organization_id` | yes | FK → `organizations.id` |
| `user_id` | yes | FK → `auth.users.id` |
| `role` | yes | **`admin`** \| **`member`** (check constraint) |
| `created_at` | yes | |

**Constraints**: **`UNIQUE (organization_id, user_id)`** — one row per user per org.

**Relationships**: Many-to-one to organisation; many-to-one to user.

## Validation and integrity rules

1. **At least one admin per organisation**  
   - Enforced by **trigger** on `organization_members` for **`DELETE`** and for **`UPDATE OF role`**.  
   - If the operation would result in **zero** rows with `role = 'admin'` for that `organization_id`, block with an exception.

2. **Who may mutate**  
   - **`add_organization_member_by_email`**, **`remove_organization_member`**, **`change_member_role`**: caller must satisfy **`user_is_admin_of_org(p_organization_id)`** before any DML.  
   - **`create_organization`**: only inserts org + membership for **`auth.uid()`** as **admin** — no arbitrary user id parameter.

3. **Add by email**  
   - Target user must exist in **`auth.users`**.  
   - New members default to **`member`** role unless a later product change updates the RPC.

4. **Role values**  
   - Only **`admin`** and **`member`** are valid (matches existing check constraint).

## State transitions

### Membership role (`member` ↔ `admin`)

- Allowed when caller is admin of the org and trigger approves the resulting admin count.
- **Blocked** when it would demote the **last** admin.

### Membership delete

- Allowed when caller is admin and trigger approves (cannot remove last admin).

### Organisation create

- Atomic: organisation row + creator admin membership appear together or neither.

## RPC / trigger catalogue (logical)

| Name | Purpose |
|------|---------|
| Trigger on `organization_members` | Last-admin guard |
| `create_organization(p_name)` | Create org + creator admin |
| `add_organization_member_by_email(p_organization_id, p_email)` | Lookup user by email; insert member |
| `remove_organization_member(p_organization_id, p_user_id)` | Delete membership |
| `change_member_role(p_organization_id, p_user_id, p_role)` | Update role |

Detailed signatures and errors: [contracts/rpc-org-management.md](./contracts/rpc-org-management.md).
