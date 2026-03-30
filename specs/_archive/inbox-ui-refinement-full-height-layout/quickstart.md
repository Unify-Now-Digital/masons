# Inbox UI Refinement — Quick verification

## After implementing the plan

1. **Full-height layout**  
   Open `/dashboard/inbox`. The Inbox content (title + three columns) should fill the viewport below the app header. With many conversations and a long thread, the **page** should not scroll; only the left list, center thread, and right panel should scroll in their own areas.

2. **Composer visibility**  
   Select any conversation. The reply composer (Reply via, AI suggestion, textarea, Send) should remain visible at the bottom of the center column without scrolling the page. Scroll only the message thread to see older messages.

3. **Behavior unchanged**  
   Confirm: selecting conversations, loading messages, sending a reply, using AI suggestion, linking/changing link, archive, mark read/unread, loading order context, and opening the order details sidebar from a row click all still work.

4. **Other dashboard routes**  
   Visit e.g. `/dashboard/orders` and `/dashboard/customers`. Those pages should still scroll and display correctly (they fill main and scroll within it if their roots use `flex-1 min-h-0 overflow-auto` or equivalent).
