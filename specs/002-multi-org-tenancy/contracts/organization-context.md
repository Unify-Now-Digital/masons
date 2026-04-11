# Contract: Active organization context (frontend)

**Consumers**: Dashboard shell, sidebar org switcher, all modules that load Supabase data.

## Shape (conceptual)

| Field | Type | Description |
|-------|------|-------------|
| `organizationId` | `string \| null` | Active tenant id; `null` before hydration or if user has no valid selection |
| `organizationName` | `string \| null` | Display name for sidebar/header |
| `role` | `'admin' \| 'member' \| null` | Role in the **active** organization |
| `memberships` | `Array<{ organizationId: string; name: string; role: 'admin' \| 'member' }>` | All orgs the user belongs to |
| `setActiveOrganizationId` | `(id: string) => void` | Switches tenant; must persist preference and invalidate data caches |
| `isLoading` | `boolean` | True while resolving user + memberships after auth |
| `error` | `Error \| null` | e.g. no membership anywhere |

## Behaviors

1. After authentication succeeds, provider loads memberships (from Supabase) and sets active org: **last stored** preference if valid, else **only** org if singleton, else first deterministic choice (e.g. alphabetical) until user picks—implementation may refine.
2. If `memberships.length === 0`, `organizationId` stays `null` and UI shows **blocked state** (per spec edge cases).
3. If `memberships.length === 1`, org switcher **hidden** (or disabled single entry—prefer hidden).
4. Org switch **must not** leak cached data: React Query keys include `organizationId` or global invalidation on switch.

## Non-goals (v1)

- Subdomain-based tenant routing
- Self-serve org creation from UI
