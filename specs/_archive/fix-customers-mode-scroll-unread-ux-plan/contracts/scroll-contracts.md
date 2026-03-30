# Scroll Behavior Contract (Customers Mode)

## Container ownership
- Customers mode owns scroll policy in `CustomerConversationView`.
- `ConversationThread` receives scroll-container reference and optional mode-specific auto-scroll control.

## Near-bottom detection
- Compute:
  - `distanceFromBottom = scrollHeight - scrollTop - clientHeight`
- Near-bottom when `distanceFromBottom <= threshold` (`~120px` default).

## Trigger rules
- New message arrives:
  - if near-bottom -> auto-scroll to bottom
  - else -> no forced scroll
- Initial thread open:
  - start at bottom
- User manually scrolls upward:
  - suppress auto-scroll until user returns near bottom.

