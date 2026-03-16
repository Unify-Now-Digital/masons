# Account Dropdown — Show Logged-in User Email

## Overview

UI improvement: when the Account dropdown is opened in the dashboard header, show the authenticated user's email at the top so users can see which account they are signed in as. No backend or database changes.

**Context:**
- Mason App uses Supabase Auth; session/user is available via `supabase.auth.getSession()` or `supabase.auth.getUser()`.
- The dashboard shell is `DashboardLayout`; the Account dropdown lives there and currently shows only "My Activity" and "Sign out".

**Goal:**
- Display the logged-in user's email at the top of the Account dropdown.
- Style as a small label/header (not a clickable item).
- Leave existing menu items and behavior unchanged.

---

## Current State Analysis

### Component that renders the Account dropdown

**File:** `src/app/layout/DashboardLayout.tsx`

- Header contains an Account trigger button and a `DropdownMenu` from `@/shared/components/ui/dropdown-menu`.
- `DropdownMenuContent` currently contains only two `DropdownMenuItem`s:
  1. My Activity (navigates to `/dashboard/activity`)
  2. Sign out (calls `handleLogout` → `supabase.auth.signOut()` and redirects to `/login`).
- The layout does not read or display the current user; it only uses `supabase` for `signOut()`.

### Auth usage elsewhere in the app

- `supabase.auth.getSession()` and `supabase.auth.getUser()` are used in various modules (e.g. `ProtectedRoute`, `Navigation`, inbox APIs).
- `session?.user?.email` or `user?.email` is the standard way to obtain the logged-in user's email.
- No shared "current user" context was found; components that need the user fetch it (e.g. via `getSession()` or `getUser()`).

### Dropdown menu primitives available

**File:** `src/shared/components/ui/dropdown-menu.tsx`

- Exports include `DropdownMenuLabel` (non-clickable, styled as label) and `DropdownMenuSeparator` (horizontal divider).
- These are appropriate for a "Signed in as" header and a visual separator above the action items.

---

## Desired Behavior

Example structure when the dropdown is open:

```
Signed in as
user@email.com
--------------
My Activity
Sign out
```

- Top: small label "Signed in as" with the user's email on the next line (or same block).
- Separator line.
- Existing items: My Activity, Sign out (unchanged).

---

## File(s) to Modify

- **`src/app/layout/DashboardLayout.tsx`** — only file that needs changes for the dashboard Account dropdown.

(Optional: if the landing/marketing `Navigation.tsx` also has an Account dropdown that should show email when logged in, that can be a follow-up; this spec scopes to the dashboard Account dropdown only.)

---

## Where to Insert the Email in the Dropdown

- **Inside `DropdownMenuContent`**, before the first `DropdownMenuItem`.
- Order:
  1. **New:** Block showing "Signed in as" + user email (non-clickable).
  2. **New:** `DropdownMenuSeparator`.
  3. **Existing:** My Activity `DropdownMenuItem`.
  4. **Existing:** Sign out `DropdownMenuItem`.

---

## Exact Change List (no implementation yet)

1. **Obtain the current user in `DashboardLayout`**
   - Add state for the current user (e.g. `User | null` from `@supabase/supabase-js`).
   - On mount (and optionally on auth state change), call `supabase.auth.getUser()` or `supabase.auth.getSession()` and set state from `session?.user` or `user`.
   - Handle loading/empty: if no user, still render the dropdown; show nothing or "Signed in as —" for the email line when email is missing.

2. **Extend dropdown imports**
   - Import `DropdownMenuLabel` and `DropdownMenuSeparator` from `@/shared/components/ui/dropdown-menu`.

3. **Insert content at the top of `DropdownMenuContent`**
   - First child: a block (e.g. `DropdownMenuLabel` or a `div` with appropriate classes) that displays:
     - Line 1: "Signed in as" (small/muted).
     - Line 2: `user?.email ?? '…'` (or hide the block when there is no user).
   - Second child: `DropdownMenuSeparator`.
   - Then the existing two `DropdownMenuItem`s unchanged.

4. **Styling**
   - Use existing dropdown content padding; style the email block so it looks like a label/header (e.g. smaller or muted text, no hover highlight, not focusable as an item). `DropdownMenuLabel` is a good fit; add a second line for the email with a class for normal/muted text.

5. **Do not change**
   - Existing menu items, navigation, or logout behavior.
   - Backend, database, or Supabase Auth configuration.
   - Any other layout or header structure.

---

## What NOT to Do

- Do not add backend or database changes.
- Do not make the email block a clickable menu item.
- Do not remove or reorder "My Activity" or "Sign out".

---

## Open Questions / Considerations

- If the app later adds a shared auth context or hook (e.g. `useUser()`), `DashboardLayout` could switch to that instead of local `getUser()`/`getSession()`.
- Landing page `Navigation.tsx` has its own Account dropdown; if product wants the same "Signed in as" treatment there, apply the same pattern in that file.
