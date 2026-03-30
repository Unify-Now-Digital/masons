# API Contracts: Split Phone Tab

## ConversationFilters.channel

| Value | Behavior |
|-------|----------|
| `'email'` | Only `channel='email'` |
| `'sms'` | Only `channel='sms'` |
| `'whatsapp'` | Only `channel='whatsapp'` |
| (omitted) | No channel filter (all) |

**Removed:** `'phone'` (previously mapped to sms + whatsapp)
