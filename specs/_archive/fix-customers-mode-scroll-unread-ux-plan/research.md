# Research: Customers Mode UX Fixes

## Problem summary
- Customers mode has three UX gaps:
  1. timeline scroll behavior is not conditional (can feel wrong for chat UX)
  2. unread UI uses numeric counts, while requirement is boolean badge
  3. opening a customer thread does not auto-mark all linked conversations as read

## Architectural findings
- Timeline rendering is centralized in `ConversationThread`.
- Customers container is `CustomerConversationView`; this is best place to scope mode-specific scroll policy.
- Customers list data is derived in `useCustomerThreads`, so boolean unread should be computed there.
- Existing read mutation in `UnifiedInboxPage` already supports marking arrays of conversation IDs.

## Decision
- Implement near-bottom conditional auto-scroll only for customers mode path.
- Add `hasUnread` derived field in `useCustomerThreads`.
- Trigger mark-all-read when selected customer thread opens and `hasUnread` is true.
- Leave conversations mode untouched.

