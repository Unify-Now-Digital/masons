# Feature Specification: Multi-Organization (Multi-Tenancy) Support

**Feature Branch**: `002-multi-org-tenancy`  
**Created**: 2026-04-11  
**Status**: Draft  
**Input**: User description: "Multi-organization (multi-tenancy) support for Mason App — isolated data per independent business, organization and membership model, tenant-scoped access, active organization context after login, org switcher when user has multiple memberships, admin vs member capabilities, default migration for existing data to a named default organization, new orgs start empty, organizations provisioned manually (no self-serve org signup)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tenant-safe daily use (Priority: P1)

A signed-in workshop user opens the app and works with orders, customers, inbox, and related records. Everything they see and change belongs to one active **organization** (their business). They never see another organization’s data, even if they are curious or mistakenly navigate deep links.

**Why this priority**: Data isolation is the core promise of multi-tenancy; without it, the feature fails commercially and on trust.

**Independent Test**: Sign in as User A (Org 1) and verify only Org 1 data appears; sign in as User B (Org 2) and verify no overlap; repeat spot-checks across main workflows (orders list, customer detail, inbox thread).

**Acceptance Scenarios**:

1. **Given** the user is authenticated and is a member of exactly one organization, **When** they load any main business screen, **Then** all lists and details show only that organization’s data.
2. **Given** the user is authenticated and has a valid active organization, **When** they perform create/update/delete on supported records, **Then** those actions apply only within that organization’s scope.
3. **Given** existing production-like data existed before this feature, **When** migration completes, **Then** that historical data is associated with the default organization named **Churchill** (or equivalent display name agreed at implementation time) so current customers retain continuity.

---

### User Story 2 - Organization administration (Priority: P2)

An **admin** for an organization can manage who belongs to the organization and their role (admin vs member), and can access organization-level settings needed for day-to-day operation. A **member** can use all standard business features but cannot change membership or admin-only settings.

**Why this priority**: Delegation and access control are required for real multi-business use; members must be productive without admin power.

**Independent Test**: Use two accounts in the same org (one admin, one member); verify admin can perform member management and settings actions; verify member receives clear denial or hidden UI for those actions.

**Acceptance Scenarios**:

1. **Given** the user has the **admin** role in the active organization, **When** they open organization administration, **Then** they can view members and roles and apply allowed changes per product rules.
2. **Given** the user has the **member** role, **When** they attempt to access organization administration or member management, **Then** they cannot succeed (hidden controls or authoritative denial).
3. **Given** a new organization is created with no historical data, **When** an admin first uses it, **Then** business datasets start empty except for what the product explicitly seeds (e.g. system defaults not tied to legacy rows).

---

### User Story 3 - Multiple organizations per user (Priority: P3)

A user who belongs to **more than one** organization can choose which organization is **active** after sign-in. The choice drives what data the app shows. The choice is surfaced in the primary navigation (e.g. left sidebar) in place of or alongside the current single-business name display (e.g. “Churchill”). Users with only one organization do not need a switcher.

**Why this priority**: Supports consultants and multi-site operators; secondary to baseline isolation and roles.

**Independent Test**: Assign one user to two orgs with different data; switch active org and verify lists and detail views change accordingly; verify single-org users never see a redundant switcher.

**Acceptance Scenarios**:

1. **Given** the user belongs to two or more organizations, **When** they view the main navigation, **Then** they can see and use an organization switcher (or equivalent) to change the active organization.
2. **Given** the user belongs to only one organization, **When** they use the app, **Then** the organization switcher is not shown (or is redundant and omitted).
3. **Given** the user changes active organization, **When** they navigate across modules, **Then** the active organization remains consistent until they switch again or sign out.

---

### Edge Cases

- User completes authentication but has **no** organization membership: the product defines a clear blocked state (message and safe exit) rather than showing empty modules that imply success.
- User’s membership is **revoked** while they are using the app: subsequent data access fails safely; active org becomes invalid and the session is guided to a recovery path (re-login or org selection if another membership exists).
- **Concurrent** sessions or tabs: changing organization in one tab should not silently desynchronize expectations—product should either synchronize active org across tabs or document single-tab expectation (assumption: last action wins or shared storage; see Assumptions).
- **Admin** demoted during use: next privileged action must fail authoritatively, not only hide buttons.
- **New organization** with zero records: empty states are correct; no leakage from other orgs’ cached UI state after switching.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST represent **organizations** as first-class entities, each identifying an independent business tenant.
- **FR-002**: The system MUST represent **organization membership**: each user may belong to zero or more organizations, each with exactly one of two roles: **admin** or **member**.
- **FR-003**: All **core business data** MUST be scoped to exactly one organization, including (non-exhaustive alignment with current product): orders; invoices; jobs; people (customers/contacts); companies; products; inbox conversations and messages; email account connections linked to the product inbox; permits; workers (and related scheduling entities as present in the product).
- **FR-004**: The system MUST enforce that a user can only read and write organization-scoped data for organizations where they have a membership; enforcement MUST NOT rely on the client alone.
- **FR-005**: After authentication, the system MUST determine the user’s active organization (defaulting per Assumptions when multiple memberships exist) and load data only for that organization unless the user switches.
- **FR-006**: The application MUST provide a single, consistent **active organization context** to all modules that fetch or mutate tenant data (conceptually: a shared “current organization” for the session).
- **FR-007**: Users with **multiple** organization memberships MUST be able to change the active organization from primary navigation (sidebar), replacing or augmenting the current single-business name presentation; users with **one** membership MUST NOT be forced through an unnecessary switcher.
- **FR-008**: **Admins** MUST be able to manage organization members (invite/add/remove or equivalent operations supported by the product) and organization settings relevant to operations; **members** MUST have standard data access without administrative membership controls.
- **FR-009**: **New** organizations created through operator-controlled provisioning (e.g. database or admin console) MUST start with **no** business data rows belonging to that org, except system-required metadata.
- **FR-010**: **Self-serve creation of new organizations by end users** is out of scope; organization creation remains a manual/operator workflow.
- **FR-011**: Existing data in the deployment MUST be backfilled so it belongs to a **default** organization identified for continuity (name: **Churchill**, per stakeholder input).

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Dual router constraint)**: Any work touching navigation/routing MUST preserve the coexistence of `src/app/` (app shell/router wiring) and `src/pages/` (legacy/singleton pages), or include a migration plan with regression testing.
- **AC-002 (Module boundaries)**: Feature code MUST live in `src/modules/<feature>/` and MUST NOT deep-import other features’ internals; shared functionality MUST be promoted into `src/shared/`.
- **AC-003 (RLS as boundary)**: Authorization MUST be enforced in the database via row-level policies (or equivalent server-side enforcement); UI checks are not sufficient for security.
- **AC-004 (Tenant isolation)**: Tenant boundaries MUST be enforced for all organization-scoped tables and for server-side entry points (including background jobs and serverless handlers) that access tenant data, consistent with the product’s architecture.

### Key Entities *(include if feature involves data)*

- **Organization**: An independent business tenant; has a stable identifier and display attributes (e.g. name); owns all scoped business records.
- **Organization membership**: Links a user to an organization with role **admin** or **member**; governs visibility of org switcher options and administrative capabilities.
- **Scoped business records**: Orders, invoices, jobs, people, companies, products, inbox threads/messages, email connections for inbox, permits, workers (and related entities)—each MUST carry an organization reference once multi-tenancy is active.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, **100%** of sampled CRUD operations performed by User A in Organization 1 are invisible to User B in Organization 2 (spot-check across at least orders, one inbox thread, and one customer record).
- **SC-002**: Users with a single organization can reach their primary dashboard and complete a representative task (e.g. open an order list) in **under 30 seconds** after login without selecting a tenant (no extra tenant-picker step).
- **SC-003**: Users with two organizations can switch active organization and see lists update to the correct tenant within **one** switch action (no full page reload required unless product already relies on it).
- **SC-004**: **Zero** critical-severity data-leak findings in tenant isolation review (cross-org reads/writes blocked at the enforcement layer).

## Assumptions

- **Default org for migration**: All pre-existing tenant data is associated with one default organization named **Churchill** (display name may match marketing; technical identifier is implementation detail).
- **Active org when multiple memberships**: The product remembers the user’s **last selected** active organization for the session (and optionally across sessions via persisted preference) so users are not asked every time unless session is new.
- **Organization “settings” for admins**: Minimum includes member roster and role assignment; additional settings follow existing product patterns.
- **Provisioning**: New organizations and new memberships are created by operators (Supabase dashboard or internal process); end-user self-signup for new orgs is explicitly out of scope.
- **Users with no membership**: Treated as an error state with a clear message—not a silent empty app.
- **Edge Functions and jobs**: Any server-side code paths that touch tenant data participate in the same isolation rules as the database (conceptually “org-aware”); exact mechanism follows AC-003/AC-004.
