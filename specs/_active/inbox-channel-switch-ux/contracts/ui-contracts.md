# UI Contracts: Inbox Channel Switching UX

## Conversations tab — channel switch

| Step | User action | System response |
|------|-------------|-----------------|
| 1 | User clicks Email / SMS / WhatsApp for “Reply via” | Channel filter updates; thread area reflects selection |
| 2a | Thread exists for person + channel | That thread loads; composer uses that `conversationId` |
| 2b | No thread | Empty state: Email/WhatsApp → “Start new conversation”; SMS → “not supported” |
| 3 | User completes modal (Email/WhatsApp) | New row created; thread selected; composer active |

## Customers tab — channel switch

| Step | User action | System response |
|------|-------------|-----------------|
| 1 | User switches channel pill | Timeline unchanged; selected channel updates |
| 2 | Selected channel has no conversation | Composer disabled; “Start conversation” visible (Email/WhatsApp); SMS shows unsupported |
| 3 | User clicks Start conversation | Modal opens with person + channel |
| 4 | Creation succeeds | `activeConversationId` set; composer enabled; WhatsApp defaults to template mode |

## SMS

| Context | Message |
|---------|---------|
| No SMS thread, user expects new thread | Clear copy: starting a new SMS conversation is not supported yet |

## Email modal

| Field | Required |
|-------|----------|
| Recipient | Yes |
| Subject | Yes |
