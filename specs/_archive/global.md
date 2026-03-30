# Global Drawer — Reset Unsaved Input on Close

## Overview

Ensure that any unsaved, user-typed input inside app drawers is cleared whenever the drawer is closed without saving, so each new open starts from a clean state (or the latest persisted record data for edits).

**Context:**
- The app uses a shared drawer layout (“Unified Drawer UI refresh”) across modules such as Orders, Jobs, People, Companies, Products, Inscriptions, Permit Forms, Invoices, and Inbox-related flows.
- Today, closing a drawer via X, backdrop click, ESC, or a Cancel button does not consistently reset internal form state; reopening the drawer can show stale, unsaved inputs.
- Drawers are implemented with a mix of form patterns (react-hook-form, `useState`-driven inputs, possibly some uncontrolled fields), and both create and edit variants exist for most entities.

**Goal:**
- **Primary objective:** Introduce a global, shared mechanism so that any time a drawer is closed without a successful save/create, its internal state is reset before the next open.
- **Secondary objectives:** Preserve the refreshed drawer layout (sticky header/body/footer), keep save/create behavior unchanged, and ensure edit drawers still preload the latest record data when opened.

---

## Current State Analysis

### Drawer Shell / Layout

**Entity:** Shared drawer UI layout (e.g. `AppDrawerLayout`, `Drawer`, `DrawerContent`, `DrawerHeader`, etc.).

**Current Structure:**
- A common drawer wrapper component provides:
  - Open/close state (controlled via props).
  - Sticky header region (title, close/X button).
  - Scrollable body/content area.
  - Footer region for primary/secondary actions (e.g. Save, Cancel).
- Individual module forms (Orders, Jobs, etc.) render their own inner content, often using:
  - `react-hook-form` instances scoped to the drawer.
  - Local `useState` for auxiliary controls.
  - Occasional uncontrolled inputs.

**Observations:**
- The drawer shell currently delegates all reset/cleanup logic to individual forms.
- There is no global convention or guarantee that a close (via X/backdrop/ESC/Cancel) resets form state.
- Because forms differ in implementation detail, behavior is inconsistent across modules.

### Module Forms (Orders, Jobs, People, etc.)

**Entity:** Per-module form components rendered inside drawers.

**Current Structure:**
- Create drawers:
  - Initialize empty/default field values on mount.
  - Rely on internal form library semantics to manage dirty state and submission.
- Edit drawers:
  - Load existing record data (via query or props) and pre-populate fields when the drawer opens.
- Close behavior:
  - When the drawer is closed, the form component may remain mounted (depending on how the parent controls open state), so internal state can persist across open/close cycles.

**Observations:**
- Without an explicit reset on close, reopening a drawer can:
  - Show partially typed values from a previous, unsaved attempt.
  - Blur the distinction between persisted data and draft changes, increasing risk of mistakes.
- Implementing resets individually per module would be brittle and error-prone; a shared contract is needed.

### Relationship Analysis

**Current Relationship:**
- The shared drawer layout is the **container**, and module-specific forms are **children** providing UI and submit handlers.
- Parents control `open` / `onOpenChange`, but form components control their own internal state.

**Gaps/Issues:**
- No central lifecycle hook or contract that says: “on close without save, clear all internal state before next open.”
- Different form technologies (react-hook-form, `useState`, uncontrolled) need a neutral mechanism they can hook into.

### Data Access Patterns

**How the drawer shell is accessed:**
- Imported and used across many modules to wrap create/edit drawers.
- Open state often controlled by parent routes or components (e.g. a table row click sets `isDrawerOpen = true`).

**How forms are accessed:**
- Each module mounts its form inside the drawer content area, often keyed by the entity id for edit views.

**How they are queried together:**
- Edit drawers typically:
  - Fetch a record (order, job, person, etc.).
  - Pass data into a form component, which sets defaults.
  - Drawer open/close is independent of query caching; closing does not inherently clear cached data or local form state.

---

## Recommended Schema Adjustments

### Database Changes

**Migrations Required:**
- None. This is a UI and component lifecycle behavior change only.

**Non-Destructive Constraints:**
- No table or column changes.
- All persisted data behavior (create/update payloads, validations) remains unchanged.

### Query/Data-Access Alignment

**Recommended Query Patterns:**
- Keep existing data fetching patterns for edit drawers:
  - Continue to use existing queries to load the latest record data when the drawer is opened.
  - Allow forms to reinitialize from fetched data on each open.

**Recommended Display Patterns:**
- Introduce a **global drawer reset contract**:
  - When the drawer transitions from open → closed due to X, backdrop click, ESC, or Cancel:
    - Signal to the child form that it should reset to its initial/default state.
  - For edit drawers, “initial state” means “latest fetched record values” the next time the drawer opens.
  - For create drawers, “initial state” means “empty/default values” the next time the drawer opens.

---

## Implementation Approach

### Phase 1: Centralize Drawer Reset Contract
- Add a shared mechanism in the global drawer wrapper (e.g. `AppDrawerLayout` or shared `Drawer` wrapper) that:
  - Detects close events driven by:
    - X button in header.
    - Backdrop click.
    - ESC key.
    - Cancel button in footer.
  - Exposes a **“drawer session key”** or a **“reset signal”** to its children, for example:
    - Passing a `resetKey` prop that changes whenever the drawer is closed without a successful save.
    - Or invoking a callback prop like `onRequestReset` that module forms can use to call their own `reset()` logic.
- Ensure this mechanism is applied **once, centrally**, so all drawers using the shared layout inherit the behavior.

### Phase 2: Integrate with Form Implementations
- For `react-hook-form`-based drawers:
  - Use `useEffect` keyed on the shared `resetKey` or similar signal to call `form.reset()` to defaults.
  - For edit drawers, tie defaults to the latest loaded record, so reopening after a close shows fresh data from the query.
- For drawers using `useState` or uncontrolled inputs:
  - Use the shared reset signal to:
    - Either remount the inner form component (keyed by `resetKey`), or
    - Explicitly clear local state / refs on signal.
- Ensure Cancel buttons:
  - Trigger the same close pathway as X/backdrop/ESC so they benefit from the same reset behavior.

### Phase 3: Safety & Regression Checks
- Verify:
  - Create drawers:
    - Close without saving (X/ESC/backdrop/Cancel) → reopen → all fields empty or defaulted.
  - Edit drawers:
    - Close without saving → reopen → fields show current persisted record data (not previous unsaved edits).
  - Save/Create flows:
    - Still work as before; successful save should:
      - Persist changes.
      - Optionally cause the next open to reflect newly saved data (via existing queries).
  - Layout:
    - Sticky header/body/footer remain visually unchanged.
    - No regressions to widths, `min-w-0` handling, or global drawer refresh styling.

### Safety Considerations

- **No data loss beyond intended behavior:**
  - Only unsaved, in-drawer state is reset; persisted records are untouched.
  - Users must still explicitly click Save/Create to persist changes.
- **Testing:**
  - Manual QA across representative modules (Orders, Jobs, People, Companies, Inscriptions, Permit Forms, Invoices, Inbox).
  - Check close behaviors for all supported triggers (X, backdrop, ESC, Cancel).
  - Confirm behavior when rapidly opening/closing drawers in succession.
- **Rollback:**
  - If issues arise, revert the shared drawer reset logic to restore prior behavior, without touching data schema or APIs.

---

## Implementation Notes

- The shared `DrawerContent` wrapper in `shared/components/ui/drawer.tsx` now:
  - Tracks a local `resetKey` that increments whenever the underlying `open` prop transitions from `true` to `false`.
  - Wraps its `children` in a `<div key={resetKey}>…</div>` so that drawer content is remounted after each close, clearing any unsaved form state (React Hook Form, `useState`, or uncontrolled inputs) by default.
  - Preserves the unified drawer layout (sticky header/body/footer, sizing, and styling) by only adding the keyed wrapper around existing children.

---

## What NOT to Do

- Do **not**:
  - Add confirmation prompts on close; the behavior must remain silent and predictable.
  - Change save/create flows or validations.
  - Break or modify the “Unified Drawer UI refresh” layout (sticky header/body/footer, sizing, `min-w-0` usage).
  - Implement one-off per-module hacks; the behavior must be implemented via shared drawer infrastructure.
  - Alter how edit drawers fetch or persist data; only reset client-side state between opens.

---

## Open Questions / Considerations

- How should drafts be handled for very long/complex forms, if at all?
  - Current spec assumes that unsaved drafts are **not** preserved across closes.
- Should the reset behavior also apply when navigation changes route (e.g. user navigates away while a drawer is open)?
  - If so, the shared contract may need to listen to route changes as additional reset triggers.
- Are there any drawers that intentionally preserve state between opens?
  - If such exceptions exist, they may need an opt-out flag from the global behavior.

