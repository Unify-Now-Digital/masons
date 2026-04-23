# Contract: Organisation management RPCs

**Audience**: Implementers (Supabase migrations + `src/modules/organizations/api`).  
**Transport**: Supabase client **`supabase.rpc('function_name', { ... })`** with JWT session.

## Shared rules

1. **Authentication**: All calls expect an **`authenticated`** JWT (`auth.uid()` not null).  
2. **Admin gate**: Except **`create_organization`**, each RPC **MUST** evaluate **`public.user_is_admin_of_org(p_organization_id)`** (or equivalent inline) **before** any `insert`/`update`/`delete`. If false → raise **permission denied** (stable message for optional UI mapping).  
3. **Last admin**: **`remove_organization_member`** and **`change_member_role`** rely on the **`organization_members` trigger** to block illegal transitions; callers should still handle the raised error.  
4. **Security**: Functions are **`SECURITY DEFINER`** with pinned **`search_path`** per migration repo conventions.

---

## `create_organization`

**Purpose**: Create a new organisation and make the caller its first **Admin**.

| Aspect | Value |
|--------|--------|
| SQL name | `public.create_organization` |
| Parameters | `p_name text` — trimmed; reject empty / over-long per migration |
| Returns | `uuid` — new **`organizations.id`** |
| Admin check | **None** (creator-only) |
| Side effects | `insert` into `organizations`; `insert` into `organization_members` (`user_id = auth.uid()`, `role = 'admin'`) in one transaction |

**Errors (illustrative)**:

- Invalid name (empty after trim)  
- Generic transaction failure on conflict (unexpected)

---

## `add_organization_member_by_email`

**Purpose**: Add an existing auth user to an organisation as **Member** by email.

| Aspect | Value |
|--------|--------|
| SQL name | `public.add_organization_member_by_email` |
| Parameters | `p_organization_id uuid`, `p_email text` |
| Returns | `void` **or** a small composite (e.g. `user_id`) — choose one in migration; document final shape in `database.types.ts` |
| Admin check | **`user_is_admin_of_org(p_organization_id)`** |

**Errors**:

- Not admin  
- **User not found** for normalised email  
- Optional: **already a member** (if not using silent no-op)

**Idempotency**: Prefer no duplicate row; UI shows “Already a member” when applicable ([research.md](../research.md)).

---

## `remove_organization_member`

**Purpose**: Remove a user’s membership from an organisation.

| Aspect | Value |
|--------|--------|
| SQL name | `public.remove_organization_member` |
| Parameters | `p_organization_id uuid`, `p_user_id uuid` |
| Returns | `void` |
| Admin check | **`user_is_admin_of_org(p_organization_id)`** |
| Integrity | Trigger blocks **last admin** removal |

**Errors**:

- Not admin  
- Last-admin violation (trigger)  
- No row deleted (optional explicit check — `p_user_id` not in org)

---

## `change_member_role`

**Purpose**: Set a member’s role to **`admin`** or **`member`**.

| Aspect | Value |
|--------|--------|
| SQL name | `public.change_member_role` |
| Parameters | `p_organization_id uuid`, `p_user_id uuid`, `p_role text` |
| Returns | `void` |
| Admin check | **`user_is_admin_of_org(p_organization_id)`** |
| Validation | `p_role` ∈ `{ 'admin', 'member' }` (case-normalised in SQL) |
| Integrity | Trigger blocks **last admin demotion** |

**Errors**:

- Not admin  
- Invalid role  
- Last-admin demotion (trigger)  
- Target not in org (optional explicit check)

---

## Read RPC (unchanged reference)

| SQL name | Purpose |
|----------|---------|
| `public.get_organization_members_with_identity` | List members with email/display name; requires membership |

Frontend continues to use this for the Settings list.
