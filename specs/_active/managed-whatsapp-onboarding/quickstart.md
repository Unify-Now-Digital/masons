# Quickstart: Verify Managed WhatsApp Onboarding Modal

Manual verification steps for the implemented UI/UX improvements.  
Run `npm run dev` and open the app in the browser before starting.

---

## Prerequisites

- Signed-in user session active
- WhatsApp mode set to **managed** (use the dropdown → "Use managed mode")
- Supabase dashboard access to inspect/reset `whatsapp_managed_connections` rows

---

## Scenario 1 — Fresh Start (no existing managed row)

**Setup**: Delete any existing managed connection row for your user in Supabase.

1. Click the WhatsApp dropdown button in the top bar.
2. **Expected**: Dropdown shows "Connect via Managed WhatsApp" menu item.
3. Click it.
4. **Expected**: Multi-step modal opens on Step 1 (Start screen). No Twilio credential fields visible.
5. Click "Get Started".
6. **Expected**: Modal advances to Step 2 (Business Details form) with three empty fields.
7. Try submitting with an empty field.
8. **Expected**: Submit button is disabled or HTML5 validation prevents submission.
9. Fill in all three fields and click "Submit".
10. **Expected**: Modal transitions to the Pending Provider Review screen with an informational message. No "Connected" label shown.
11. Close the modal.
12. **Expected**: Dropdown status label shows "pending provider review" (not "Connected"). Dot is red/non-green.

---

## Scenario 2 — Re-entry: Pending State

**Setup**: Leave the managed row in `pending_provider_review` state from Scenario 1.

1. Refresh the page.
2. Click the WhatsApp dropdown.
3. **Expected**: Menu item label reads "View pending status".
4. Click it.
5. **Expected**: Modal opens directly on the Pending screen (not Step 1, not Business Details form).

---

## Scenario 3 — Re-entry: Collecting Business Info (interrupted)

**Setup**: Reset row state to `collecting_business_info` via Supabase (UPDATE state, clear meta).

1. Click the WhatsApp dropdown.
2. **Expected**: Menu item reads "Resume onboarding".
3. Click it.
4. **Expected**: Modal opens directly on Step 2 (Business Details form) with empty fields.

---

## Scenario 4 — Provider-Ready → Connected

**Setup**: Row is in `pending_provider_review`.

1. Simulate provider-ready webhook via PowerShell (see original implementation notes for the `Invoke-RestMethod` command with `x-provider-token`).
2. Within ~10 seconds (polling interval), the dropdown status should update.
3. **Expected**: Dropdown dot turns green; status label shows "Connected".
4. Click the dropdown.
5. **Expected**: Menu item reads "Manage connection".
6. Click it.
7. **Expected**: Modal opens on the Connected screen showing the display number or sender identity and a "Disconnect" button.
8. Verify that "Connected" is NOT shown if any of the four criteria is missing (test by manually setting `provider_ready = false` in Supabase — dropdown should revert to non-connected state within 10 s).

---

## Scenario 5 — Disconnect from Connected State

**Setup**: Row is `connected` with all four criteria.

1. Open the modal ("Manage connection").
2. Click "Disconnect".
3. **Expected**: Button shows "Disconnecting…" while in-flight.
4. **Expected**: Modal transitions to Disconnected screen ("WhatsApp Disconnected" heading + "Start New Onboarding" button).
5. Close the modal.
6. **Expected**: Dropdown dot is red; status label shows "disconnected".
7. Click dropdown → menu item reads "Reconnect WhatsApp".

---

## Scenario 6 — Start Over After Disconnect

**Setup**: Row is in `disconnected` state from Scenario 5.

1. Open the modal.
2. Click "Start New Onboarding".
3. **Expected**: Modal advances to Step 2 (Business Details form). Row state resets to `collecting_business_info` (verify in Supabase).

---

## Scenario 7 — Action Required Recovery

**Setup**: Manually set row `state = 'action_required'` in Supabase with some `meta` JSON already set and a `last_error` value.

1. Click the WhatsApp dropdown.
2. **Expected**: Menu item reads "Resolve action required".
3. Click it.
4. **Expected**: Modal opens on the Action Required screen showing:
   - The `status_reason_message` (if returned from status endpoint) or fallback text.
   - Business details form **pre-populated** with values from `meta`.
5. Edit a field and click "Re-submit".
6. **Expected**: Modal transitions to Pending screen. Row `state` becomes `pending_provider_review`.

---

## Scenario 8 — Failed State Recovery

**Setup**: Manually set row `state = 'failed'` in Supabase.

1. Click the WhatsApp dropdown.
2. **Expected**: Menu item reads "Onboarding failed — start over".
3. Click it.
4. **Expected**: Modal shows Failed screen with reason message and "Start Over" button.
5. Click "Start Over".
6. **Expected**: Modal advances to Step 2. Row resets to `collecting_business_info`.

---

## Scenario 9 — Manual Mode Regression

**Setup**: Switch to manual mode. Ensure a connected manual `whatsapp_connections` row exists.

1. Click dropdown.
2. **Expected**: Manual flow UI is unchanged — Connect/Replace/Disconnect/Test options present. No managed modal items visible.
3. Send a WhatsApp message from the inbox.
4. **Expected**: Message sends successfully via manual connection.

---

## Scenario 10 — False Connected State Guard

**Setup**: Row has `state = 'connected'` but `provider_ready = false` (edit in Supabase).

1. Within 10 s of the poll cycle, check the dropdown.
2. **Expected**: Status label does NOT show "Connected". Dot is not green.
3. Open the modal.
4. **Expected**: Modal does NOT show the Connected screen. It shows the Failed/degraded screen because `isConnected` evaluates to false.
