# Data Model: Split Phone Tab

## No Schema Changes

This feature is UI/filter-only. No database migrations.

## Channel Values

- `inbox_conversations.channel`: `'email' | 'sms' | 'whatsapp'` (lowercase in DB)
- Filter mapping: tabs now pass `'sms'` or `'whatsapp'` directly instead of `'phone'`
