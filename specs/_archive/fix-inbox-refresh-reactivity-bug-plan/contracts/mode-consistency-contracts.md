# Mode Consistency Contracts

## Conversations mode
- Existing tabs and channel filters remain unchanged.
- Selection behavior and unread logic remain unchanged.
- Refresh only updates data sources; no UX behavior change.

## Customers mode
- Customer threads still derive from conversations query results.
- Mixed timeline still uses message timestamps and existing rendering.
- Send routing logic remains unchanged; only cache refresh consistency improves.

## Cross-mode switching
- Switching between modes must not require manual reload.
- Selected conversation/person may persist, but data must reflect latest cache refresh.

