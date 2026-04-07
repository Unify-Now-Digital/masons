# Quickstart: Verify Shared WhatsApp UI and Sender Identity

Run `npm run dev` and ensure updated edge function is deployed before testing.

---

## Prerequisites

1. Two valid user accounts exist: one admin (email matches `VITE_ADMIN_EMAIL`) and one non-admin.
2. WhatsApp connection status component is visible in top bar.
3. At least one WhatsApp conversation exists for outbound testing.

---

## Scenario 1: Non-Admin Status-Only View

1. Sign in as a non-admin user.
2. Open top bar WhatsApp status.
3. **Expected**: Status indicator/label is visible.
4. **Expected**: No connect/disconnect/manage controls are shown.

---

## Scenario 2: Admin Full Controls View

1. Sign in as admin user (email equals `VITE_ADMIN_EMAIL`).
2. Open top bar WhatsApp status.
3. **Expected**: Full controls are visible (connect/disconnect/manage and existing actions).
4. **Expected**: Status indicator/label remains visible.

---

## Scenario 3: WhatsApp Outbound Sender Metadata Persisted

1. Sign in as user A and send WhatsApp outbound message.
2. Verify created `inbox_messages` row includes `meta.sender_email = userA@email`.
3. Sign in as user B and send another WhatsApp outbound message in same thread.
4. Verify row includes `meta.sender_email = userB@email`.

---

## Scenario 4: Outbound WhatsApp Bubble Label Logic

1. As user A, view thread containing outbound WhatsApp messages from A and B.
2. **Expected**: A's outbound bubble label shows `You`.
3. **Expected**: B's outbound bubble label shows `userB@email`.
4. For an older outbound WhatsApp message with no `meta.sender_email`:
5. **Expected**: label falls back to `You`.

---

## Scenario 5: Inbound and Other Channels Unchanged

1. Check inbound customer messages in thread.
2. **Expected**: inbound label behavior unchanged.
3. Send email and SMS replies from inbox.
4. **Expected**: email/SMS send and rendering behavior unchanged.

---

## Scenario 6: Missing Admin Env Fallback

1. Run with `VITE_ADMIN_EMAIL` missing/empty (local test configuration).
2. Sign in as any user.
3. **Expected**: status indicator still visible.
4. **Expected**: controls hidden for all users.
