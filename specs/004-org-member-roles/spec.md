# Feature Specification: Organisation management and member roles

**Feature Branch**: `004-org-member-roles`  
**Created**: 2026-04-23  
**Status**: Draft  
**Input**: User description: Organisation management on the Settings page—create additional organisations (name only, creator becomes Admin), add members by email when an account already exists, remove members and change roles (Admin / Member) with admin-only actions and last-admin safeguards; multi-organisation membership supported; workspace switcher behaviour unchanged; no invitations, organisation deletion, branding logo, switcher changes, or sign-up flow changes.

## Overview

### Current state

- The product already supports **multiple organisations per signed-in user**: the active organisation and role come from membership data, and users with more than one membership can **switch workspace** from the existing switcher.
- **Settings** includes an **Organisation members** panel that is **visible only to organisation Admins**. It lists members (name and email where available) and their role, loaded via a secure member list.
- **Members** (non-admins) do not see organisation membership management on Settings.
- Membership management APIs exist for **fetching members**, **updating a member’s role**, and **removing a member**; **creating a new organisation from the product** and **adding someone by email** are not yet specified as complete, guided Settings flows in line with the decisions below.
- The data model already recognises **organisations**, **membership rows** linking a person to an organisation, and **two roles only: Admin and Member** (no separate Owner role).

### Proposed changes (in scope)

- **Create organisation** from **Settings only**: user provides **organisation name**; the creator becomes **Admin** of the new organisation. This action does **not** move creation into the workspace switcher.
- **Add member by email** (Settings, Admin): if a **registered account** exists for that email, add them to the **current** organisation (role to be agreed in implementation planning—default assumption: **Member** unless otherwise specified in planning). If **no account** exists, show a **clear error** (no invitation flow).
- **Remove member** (Settings, Admin only): blocked if it would remove the **last Admin** for that organisation.
- **Change role** between Admin and Member (Settings, Admin only): blocked if it would **demote the last Admin**.
- **Rule of thumb**: every organisation **always has at least one Admin**, enforced **both** in the product UI and in the **authoritative backend rules** so it cannot be bypassed.

### Out of scope

- Email invitations, pending invites, or “request access” flows  
- Deleting an organisation  
- Organisation logo or other branding assets  
- Any change to **workspace switcher** placement, behaviour, or using it to **create** organisations  
- Changes to **sign-up** or self-serve account provisioning  

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Create an additional organisation from Settings (Priority: P1)

A workshop owner who already uses the product needs a **separate organisation** (for example a second yard or a distinct trading name) without changing how they switch workspaces day to day.

**Why this priority**: Creates a clean tenancy boundary for real businesses that already run more than one operation, without relying on manual database setup.

**Independent Test**: From Settings, a signed-in user can create a named organisation and immediately appears as its **Admin**; the new organisation appears wherever memberships are listed for switching (existing switcher unchanged in *behaviour*).

**Acceptance Scenarios**:

1. **Given** a signed-in user on Settings, **When** they submit a valid organisation name, **Then** a new organisation exists, they are its **Admin**, and they receive confirmation appropriate to the product tone.  
2. **Given** the same flow, **When** the name is missing or invalid per product rules, **Then** creation is blocked with a clear message and no partial organisation is left for them.  
3. **Given** a user who only had one organisation before, **When** they create another, **Then** they can still use the **existing** workspace switcher to move between organisations (no switcher redesign).

---

### User Story 2 — Add a colleague by email (Priority: P2)

An **Admin** needs to add someone who already has an account, using their **email address**, without sending invitations.

**Why this priority**: Day-to-day onboarding of staff is the most frequent membership change after initial setup.

**Independent Test**: As Admin, enter an email that belongs to an existing account; that person becomes a member of the current organisation. Enter an email with no account; the product shows an explicit “not found” style outcome.

**Acceptance Scenarios**:

1. **Given** an Admin on Settings for organisation A, **When** they enter the email of a user who exists but is not yet in A, **Then** that user is added as a member of A and the list refreshes.  
2. **Given** the same context, **When** they enter an email with **no** registered account, **Then** the action fails with a clear message that the person could not be found (and no pending invite is created).  
3. **Given** the target user is **already** a member of A, **When** the Admin tries to add again, **Then** the product responds without duplicating membership (clear success or “already a member” messaging).

---

### User Story 3 — Remove members and change roles safely (Priority: P3)

An **Admin** must be able to **remove** a member or **change** their role between Admin and Member, without ever leaving the organisation without an Admin.

**Why this priority**: Supports least privilege and staffing changes while protecting the business from accidental lock-out.

**Independent Test**: As Admin, remove a non–last-admin member; change roles; attempt last-admin removal or last-admin demotion and observe consistent blocking and messaging in UI; same rules hold when exercised through non-UI paths (verified at planning/verification stage).

**Acceptance Scenarios**:

1. **Given** an Admin viewing the member list, **When** they remove a member who is **not** the sole Admin, **Then** that person loses access to this organisation and disappears from the list.  
2. **Given** exactly one Admin remains, **When** anyone tries to **remove** that Admin’s membership, **Then** the action is blocked with an explanation.  
3. **Given** exactly one Admin remains, **When** anyone tries to **demote** that person from Admin to Member, **Then** the action is blocked with an explanation.  
4. **Given** a Member, **When** they open Settings, **Then** they **cannot** remove others or change roles (controls absent or disabled with short rationale if shown).

---

### Edge Cases

- **Whitespace or letter case** in email input must not prevent a correct match for a real account.  
- **Concurrent edits** (two Admins changing roles at once): the system must end in a valid state—**at least one Admin**—or reject conflicting actions with a clear message.  
- **Admin removes themselves** when other Admins exist: allowed only if at least one other Admin remains after the action.  
- **Creator is sole Admin** of a new organisation: removing everyone else is irrelevant; demoting self as sole Admin remains blocked.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST allow a signed-in user to **create a new organisation** from **Settings**, supplying **only** an organisation **name** (plus any unavoidable implicit identifiers managed by the system).  
- **FR-002**: On successful creation, the creating user MUST become an **Admin** of the new organisation.  
- **FR-003**: Organisation creation from Settings MUST **not** require use of the workspace switcher as the creation entry point.  
- **FR-004**: An **Admin** MUST be able to **add a member** to the **currently active** organisation by **email address**, provided a **registered account** exists for that email.  
- **FR-005**: If **no** registered account exists for the supplied email, the product MUST **fail** with a clear, honest message (no invitation or deferred signup in this feature).  
- **FR-006**: An **Admin** MUST be able to **remove** a member from the organisation except where it would remove the **last Admin**.  
- **FR-007**: An **Admin** MUST be able to **change** a member’s role between **Admin** and **Member**, except where it would **demote the last Admin**.  
- **FR-008**: **Members** MUST NOT be able to add, remove, or change roles for others in that organisation.  
- **FR-009**: For every organisation, the system MUST **maintain at least one Admin** at all times: both the **product** and the **authoritative backend rules** MUST prevent operations that would violate this.  
- **FR-010**: A single person MUST be able to be a member of **multiple organisations** at the same time, with **per-organisation** roles.  
- **FR-011**: The **workspace switcher** MUST remain **functionally equivalent** to today for this delivery (no redesign, no creation flow added to it).

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Switcher stability)**: Workspace switching MUST remain **behaviourally unchanged** for this delivery; users continue to choose among organisations they belong to in the same way as today.  
- **AC-002 (Authoritative rules)**: Rules for **who may add, remove, or change roles**, and **last-admin protection**, MUST be enforced in the **trusted data layer** as well as reflected in the interface; the interface MUST explain denials in plain language.  
- **AC-003 (Scope boundary)**: Membership management MUST remain within the agreed **Settings** flows; invitations, organisation deletion, branding assets, switcher changes, and sign-up changes remain **out of scope**.

### Key Entities *(include if feature involves data)*

- **Organisation**: A named workspace boundary; has a **display name**; has **many** memberships.  
- **Membership**: Links a **person** (authenticated account) to **one** organisation with exactly one of **Admin** or **Member**. A person may hold **many** memberships across organisations.  
- **Role**: **Admin** or **Member** only; **Admin** can manage members for that organisation subject to last-admin rules; **Member** cannot.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **95%** of attempted “add by email” actions for **existing** accounts complete successfully on first try when performed by an Admin (measured in internal testing or pilot, with failures attributable to documented edge cases only).  
- **SC-002**: **100%** of scripted checks confirm that **last-admin removal** and **last-admin demotion** are **impossible** through both the product and the trusted data layer.  
- **SC-003**: An Admin can **create a new organisation**, **add** a colleague by email, and **adjust roles** without reading internal documentation—**task completion without support** for a prepared test script in **under 5 minutes** per flow.  
- **SC-004**: **Zero** change in workspace switcher **user-reported defects** attributable to this delivery (baseline: no new switcher-related issues in acceptance testing).  

## Assumptions

- **Identity**: “Account exists” means there is a **registered login** for that email in the product’s authentication directory; matching tolerates normal **trimming** and **case** differences where safe.  
- **Default role for new invitees-by-email**: New members added by email are **Members** unless a future planning decision specifies otherwise (not part of this stakeholder spec).  
- **Multi-org**: Users may belong to **several** organisations; the **active** organisation is the one to which adds apply.  
- **Data model assumptions**: Organisations and memberships are **already** first-class concepts; this feature **extends behaviour** on top of that model rather than introducing a third role or Owner tier.  
- **Dependencies**: Existing **sign-in** and **workspace switching** remain as today; no new email product (invites) is assumed.  

### Open questions (non-blocking for this specification)

- **Duplicate add**: Exact copy for “already a member” vs silent idempotency—either is acceptable if the outcome is **no duplicate membership** and the message is clear.  
- **First organisation for a brand-new user**: If product policy ever allows users with **zero** memberships at sign-in, onboarding is **out of scope** here; this spec assumes users who reach Settings already have at least one membership path consistent with today’s product.
