# Research: Organisation management and member roles (004-org-member-roles)

## 1. Why `SECURITY DEFINER` RPCs instead of widening RLS on `organizations`?

**Decision**: Implement **`create_organization`**, **`add_organization_member_by_email`**, **`remove_organization_member`**, and **`change_member_role`** as **`SECURITY DEFINER`** RPCs with explicit caller checks (`auth.uid()` and `user_is_admin_of_org`).

**Rationale**: Today **`public.organizations`** has **select-only** RLS for members and **no** general-purpose **`insert`** policy for authenticated users. Adding broad insert/update policies increases the risk of accidental cross-tenant writes. RPCs keep **one audited code path** per operation and align with existing **`get_organization_members_with_identity`** (already `SECURITY DEFINER` with a membership gate).

**Alternatives considered**:

- **RLS-only inserts** on `organizations` + members — requires careful `WITH CHECK` expressions and still needs a trigger for last-admin; harder to keep email lookup (`auth.users`) encapsulated.
- **Edge Function + service role** — constitution prefers Edge for **secrets**; here there is no secret, so RPC is simpler and lower latency.

## 2. `create_organization` authorisation model

**Decision**: **`create_organization`** does **not** call `user_is_admin_of_org` (there is no prior membership). It only creates rows keyed to **`auth.uid()`** as the new org’s first **Admin** in one transaction.

**Rationale**: Matches product rule “any signed-in user may create an additional org from Settings” without implying admin rights on an existing org.

**Alternatives considered**:

- Require caller to already be admin somewhere — **rejected**; contradicts spec for new org creation.

## 3. Email resolution for `add_organization_member_by_email`

**Decision**: Normalise with **`lower(trim(p_email))`** and resolve against **`auth.users.email`** using the same normalisation (or `=` on canonical form if the project stores lower-case only). If **no row**, raise a dedicated exception / message for “user not found”.

**Rationale**: Spec requires clear failure when no account exists; trimming and case folding reduce support noise.

**Alternatives considered**:

- **`auth.admin.listUsers`** from client — **rejected** (requires service role / Edge Function); unnecessary when DB-side lookup suffices inside definer RPC.

## 4. Duplicate membership when adding by email

**Decision**: Prefer **`INSERT … ON CONFLICT DO NOTHING`** on `(organization_id, user_id)` **or** catch **unique_violation** and return success with a no-op; surface UI copy **“Already a member”** when no new row inserted.

**Rationale**: Spec allows idempotent behaviour if messaging is clear; avoids false error states.

**Alternatives considered**:

- Always raise on duplicate — acceptable but harsher UX for retries.

## 5. Last-admin enforcement: trigger vs RPC-only checks

**Decision**: Implement **both**: RPCs call **`user_is_admin_of_org`** before DML, and a **trigger** on **`organization_members`** enforces **minimum one admin** on **DELETE** and **role UPDATE**. RPC checks prevent unauthorised attempts early; trigger is the **authoritative** backstop (including direct SQL or future code paths).

**Rationale**: Satisfies FR-009 and constitution (“RLS as guardrail” extended to **centralised integrity** for definer paths).

**Alternatives considered**:

- Trigger only — weaker UX (generic DB errors) if admin check omitted in RPC.
- RPC only — bypass risk if another writer appears later.

## 6. Parameter shape: `user_id` not `membership_id`

**Decision**: Mutations accept **`(p_organization_id, p_user_id)`**; RPC resolves the membership row internally.

**Rationale**: Matches product direction; UI already lists `user_id` from `get_organization_members_with_identity`.

## 7. SQL function hardening

**Decision**: All new RPCs and trigger helpers: **`SECURITY DEFINER`**, stable **`search_path`** (e.g. `public` only or empty with fully qualified identifiers per repo SQL style guide), **`grant execute`** only to **`authenticated`** where appropriate.

**Rationale**: Reduces search-path hijack class; consistent with existing org helper functions.

## 8. Deploy ordering

**Decision**: Ship **trigger (M1) before or with** RPC migrations in the same release; RPC migrations can follow in the same deploy bundle. Frontend should assume RPCs exist before calling them.

**Rationale**: RPCs immediately benefit from trigger guarantees; no circular dependency.
