# Quickstart: Message-Level Reply UX (Unified Inbox All Tab)

## Run the app

```bash
cd c:\Users\owner\Desktop\unify-memorial-mason-main
npm install
npm run dev
```

Open the app → **Unified Inbox** (e.g. `/inbox` or Dashboard → Inbox).

---

## Test in All tab only

1. **Switch to All tab**  
   Confirm the right panel shows the unified timeline (People | timeline with composer).

2. **Select a person** with messages across one or more channels (Email/SMS/WhatsApp). Confirm the timeline and composer with channel dropdown are visible.

3. **Reply action on a message**  
   - Each message bubble should show a **Reply** action (e.g. link or button).  
   - Click **Reply** on any message.  
   - **Acceptance:**  
     - “Replying to…” chip appears with a short preview and the correct channel.  
     - Channel selector is locked to that message’s channel (no dropdown change).  
     - Composer scrolls into view (if it was off-screen).

4. **Clearing the chip**  
   - Click the clear (X) on the “Replying to…” chip.  
   - **Acceptance:** Chip disappears; channel selector unlocks and restores the previous selection (e.g. default or most recent inbound channel).

5. **Single-channel tabs unchanged**  
   - Switch to Email (or SMS / WhatsApp).  
   - **Acceptance:** No Reply action on message bubbles; composer and channel behavior unchanged.

---

## Build

```bash
npm run build
npm run lint
```

Build and lint must pass.
