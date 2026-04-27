# Data Model: Delete Organization and Bulk Inbox Delete

## Overview

This feature introduces destructive workflows over existing entities. No new primary business entities are required, but deletion intent and selection constraints add validation/state rules.

## Entities

## 1) Organization

- **Purpose**: Tenant workspace boundary.
- **Key fields**: `id`, `name`.
- **Relationships**:
  - One-to-many with `organization_members`.
  - One-to-many with tenant-scoped tables via `organization_id`.
- **State rules**:
  - Deletable only by org admins.
  - Hard delete triggers dependent row removal based on FK cascade alignment.

## 2) Organization Membership

- **Purpose**: Role assignment for access and authorization.
- **Key fields**: `organization_id`, `user_id`, `role`.
- **Relationships**:
  - Belongs to `organizations`.
  - Belongs to authenticated user.
- **State rules**:
  - Caller role must be `admin` for organization deletion.
  - Membership re-fetch after deletion determines next active organization or onboarding fallback.

## 3) Inbox Conversation

- **Purpose**: Conversation thread in Inbox.
- **Key fields**: `id`, `organization_id`, `channel`, `primary_handle`, `status`.
- **Relationships**:
  - One-to-many with `inbox_messages` (direct or enforced via delete sequence).
  - One-to-many with derived/related inbox tables (summaries/extractions) where applicable.
- **State rules**:
  - Eligible for bulk deletion only if owned by caller’s organization scope.
  - Bulk operation input cardinality is 1..50 IDs.

## 4) Inbox Message

- **Purpose**: Message records associated with conversation threads.
- **Key fields**: `id`, `conversation_id`, `organization_id`, `channel`, `sent_at`.
- **Relationships**:
  - Belongs to `inbox_conversations`.
- **State rules**:
  - Must be removed when parent conversation is deleted (cascade or explicit deletion path).

## 5) Delete Operation Inputs (Behavioral Entities)

## 5.1 OrganizationDeleteRequest

- **Fields**:
  - `organization_id: uuid`
  - `confirmation_name: string` (UI-level validation)
  - `caller_user_id: uuid` (derived from auth context)
- **Validation**:
  - Confirmation text must exactly match active organization name after trim.
  - Caller must be admin in target organization.

## 5.2 ConversationBulkDeleteRequest

- **Fields**:
  - `conversation_ids: uuid[]`
  - `caller_user_id: uuid` (derived from auth context)
- **Validation**:
  - Length must be between 1 and 50.
  - Every ID must resolve to caller-authorized organization membership scope.

## State Transitions

## A) Organization deletion flow

1. User opens delete modal on Settings.
2. User enters exact org name.
3. RPC validates caller admin + target org existence.
4. Organization row is hard deleted.
5. Frontend triggers `refetchMemberships()`.
6. Context resolves next active org if available; otherwise no-org onboarding state.

## B) Inbox bulk delete flow

1. User selects conversations (bounded at 50).
2. Delete action displays selected count.
3. User confirms deletion.
4. RPC validates count and organization ownership.
5. Conversations (and messages/children) are deleted.
6. Frontend clears selection and invalidates inbox queries.

## Derived Constraints

- Delete RPCs are irreversible and must return explicit errors on any authorization or validation failure.
- Mixed-organization conversation ID payloads must be rejected as unauthorized.
- Post-delete UI must never retain invalid selected IDs.
