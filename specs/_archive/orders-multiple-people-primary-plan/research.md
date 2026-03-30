# Research: Orders Multiple People with Primary

## Current State

### DB
- **orders.person_id** (uuid, FK → customers.id)
- **orders.person_name** (text, snapshot)
- **No order_people** join table

### Order Drawers
- **CreateOrderDrawer:** Single `Select` for person_id; `NO_PERSON_SENTINEL` for "None"; optional
- **EditOrderDrawer:** Same pattern
- **Form:** `orderFormSchema` has `person_id: z.string().uuid().optional().nullable()`
- **Create flow:** create order, then set person_id/person_name from selected customer
- **Edit flow:** load order; person_id from order; customers list for options

### People selector pattern
- **LinkConversationModal:** `useCustomersList()` + `useMemo` filter by search (name/email/phone)
- **PeopleSidebar:** Same pattern
- No existing multi-select chips component; build inline or extract
