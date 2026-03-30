# Research: Inbox Person Orders Panel

## Discovery Summary

### Orders ↔ Customers
- **FK:** `orders.person_id` → `customers.id` ✓
- **Migration:** `20260106003849_add_person_fields_to_orders.sql`
- **Index:** `idx_orders_person_id`
- **Strict:** Use `person_id` for queries only; no fuzzy matching

### Order Details UI
- **Component:** `OrderDetailsSidebar` (Orders module)
- **Props:** `order: Order | null`, `onClose: () => void`, `onOrderUpdate?: (orderId, updates) => void`
- **Renders:** Card-based layout; returns `null` when `!order`
- **No Sheet/overlay:** Renders inline; can be embedded directly in a scrollable panel

### Orders API
- **fetchOrder(id):** Full order from `orders` + join customers + order_additional_options
- **fetchOrdersByInvoice(invoiceId):** From `orders_with_options_total`, includes customers join
- **Missing:** `fetchOrdersByPersonId(personId)` — add similar to `fetchOrdersByInvoice`

### View: orders_with_options_total
- Includes `o.*` from orders (person_id, order_number, etc.) + `additional_options_total`
- Used by `fetchOrdersByInvoice`; same pattern for by-person

### UnifiedInboxPage Layout
- **Current:** flex → PeopleSidebar | grid(col1: conversations, col2: ConversationView)
- **Target:** Right column becomes vertical split: ConversationView (top) | PersonOrdersPanel (bottom)

### Person Context
- `selectedConversation` — from `useConversation(selectedConversationId)`; has `person_id`
- `selectedPersonId` — from PeopleSidebar
- **activePersonId** = `selectedConversation?.person_id ?? selectedPersonId`
