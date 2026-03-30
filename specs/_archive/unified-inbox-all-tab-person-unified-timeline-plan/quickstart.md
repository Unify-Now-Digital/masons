# Quickstart: All tab person unified timeline

## Run the app

```bash
cd c:\Users\owner\Desktop\unify-memorial-mason-main
npm install
npm run dev
```

Open the app, go to **Unified Inbox** (e.g. `/inbox` or dashboard → Inbox).

## Test All tab behavior

1. **Layout**  
   - Switch to **All** tab.  
   - Confirm only two columns: People (left) and timeline (right). No conversation list in the middle.

2. **Timeline data**  
   - Select a person in the People sidebar that has conversations (Email/SMS/WhatsApp).  
   - Confirm the right panel shows a single chronological list of messages with channel badges (Email/SMS/WhatsApp), direction, timestamp, and body.

3. **Read-only**  
   - In All tab, confirm there is no reply box and no way to send a message.

4. **Click to open thread**  
   - Click a message in the All timeline.  
   - Confirm the app switches to the correct channel tab (Email/SMS/WhatsApp) and opens that conversation in the conversation view.

5. **Empty states**  
   - No person selected: message like “Select a person to view all messages.”  
   - Person selected but no messages: “No messages for this person yet.”  
   - Unlinked selected without a concrete person: “Link a person to view combined messages.” (or equivalent)

6. **Other tabs unchanged**  
   - Switch to Email, SMS, WhatsApp. Confirm 3-column layout and existing behavior (conversation list + conversation view + composer) are unchanged.

## Build

```bash
npm run build
npm run lint
```
