# Contract: `delete_conversations` RPC

## Purpose

Hard-delete selected inbox conversations and associated messages for authorized organization members, bounded to 50 IDs per request.

## Signature

- **Name**: `public.delete_conversations`
- **Invocation**: authenticated client via Supabase RPC
- **Arguments**:
  - `p_conversation_ids uuid[]` (required, 1..50)
- **Security**: `SECURITY DEFINER`

## Authorization Rules

1. Caller must be authenticated.
2. Caller must be a member of the organization that owns each conversation ID.
3. Request must not contain conversation IDs outside caller membership scope.

## Validation Rules

1. `p_conversation_ids` must be non-empty.
2. `array_length(p_conversation_ids)` must be `<= 50`.
3. All IDs must resolve to existing conversations under authorized organization scope.

## Behavior

1. Validate auth and payload bounds.
2. Validate organization ownership/membership for full payload.
3. Delete target conversations in a way that also deletes dependent inbox messages and child rows (cascade or explicit internal ordering).
4. Return success only when full operation completes.

## Expected Errors

- `UNAUTHORIZED`: Caller not authenticated.
- `FORBIDDEN`: Caller lacks membership for one or more target conversations.
- `INVALID_ARGUMENT`: Empty ID list or more than 50 IDs.
- `NOT_FOUND`: One or more IDs do not exist in authorized scope.

## Frontend Expectations

- Multi-select supports row hover checkbox and list-header select-all (up to 50).
- Toolbar delete action appears for 1+ selected and shows selected count.
- Confirmation dialog text: `Delete X conversations? This cannot be undone`.
- On success: clear selection, invalidate inbox queries, and reset open-thread selection if deleted.
