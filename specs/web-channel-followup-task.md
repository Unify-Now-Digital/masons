# Follow-up: First-class `web` channel support

**Origin:** Deferred from 015 US5 (T041/T042). The channel filter ships for email/whatsapp/sms only;
`web` conversations exist in the data but aren't a recognised channel, so they appear only under "All".

## Problem

`InboxConversation.channel` is typed `'email' | 'sms' | 'whatsapp'`, but production data contains
`web` conversations (visible as "Web" badges in the inbox list — website contact-form / quote
submissions). The type denies a value the data actually holds. This causes:

- Web conversations match no channel pill, so they're invisible under any filter except "All".
- The enquiry card `ChannelIcon` lumps `web` into the phone icon (wrong glyph).
- Any `switch (channel)` logic silently mishandles `web`.

## Decision needed first

Is `web` a **distinct channel** (gets its own pill + icon) or a **source that maps onto email**
(web forms arrive as email, so re-label/normalise to `email`)? Confirm with the data:

```sql
select channel, count(*) from inbox_conversations group by channel order by count(*) desc;
```

If `web` is a large, distinct population (likely, given the inbox), treat it as a first-class channel.

## Scope (if web becomes a first-class channel)

1. **Type:** add `'web'` to the `channel` union in `src/modules/inbox/types/inbox.types.ts`
   (the `InboxConversation.channel` field and any other `'email' | 'sms' | 'whatsapp'` literals there).
2. **Filter union:** add `'web'` to `ChannelFilter` in `InboxConversationList.tsx`, and add a `web`
   option to the channel `<select>` (~line 279).
3. **Icon:** give `web` its own icon in `EnquiryPipelineCard.tsx`'s `ChannelIcon` (e.g. a globe),
   instead of falling through to the phone icon.
4. **Pipeline fetch:** confirm `fetchEnquiryPipeline` / `ConversationFilters.channel` accept `web`
   and filter on it server-side.
5. **Audit:** grep `channel ===` / `channel:` across `src/modules/inbox/` and any edge functions
   that write `channel`, to catch places that assume only three values.

## Also fold in (related US5 gaps)

- **Enquiries-view channel pill:** the pipeline reads the channel param (T042) but no pill is
  surfaced inside the Enquiries segment — the board has no channel control UI. Add a small channel
  selector to the Enquiries view so the pipeline filter is reachable without editing the URL.

## Out of scope

- Changing how web submissions are ingested/written (this is about reading/filtering existing data).