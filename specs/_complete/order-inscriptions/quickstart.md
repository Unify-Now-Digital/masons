# Quickstart: Verify Order Inscriptions

Run `npm run dev` and have Supabase dashboard access before starting.

---

## Prerequisites

1. Migration SQL applied in Supabase dashboard SQL editor (single block from `data-model.md §1`).
2. App running at `http://localhost:5173`.

---

## Scenario 1 — Create Order with Inscription

1. Open the Orders page. Click "New Order".
2. Fill in the required fields (Deceased name, Grave number, Location, Order Type).
3. Scroll to the **Inscription** section.
4. **Expected**: Inscription section exists between "Additional Options" and "Notes", with five fields: Inscription Text, Additional Lines, Font Style dropdown, Layout / Position.
5. Select "Other" from Font Style.
6. **Expected**: A "Font — Other" text input appears.
7. Select any other font (e.g. "Palatino").
8. **Expected**: The "Font — Other" input disappears.
9. Re-select "Other", type a custom font name "Copperplate".
10. Fill in Inscription Text: "In Loving Memory of John Smith, 1940–2020".
11. Fill in Layout: "Centred, upper half of stone".
12. Submit the order.
13. **Expected**: Order is created without error. Open the order in the sidebar.
14. **Expected**: Inscription data is visible and all entered values are correct.

---

## Scenario 2 — Edit Order Inscription

1. Open an order with no inscription data in the edit drawer.
2. **Expected**: Inscription section is visible, all fields are empty.
3. Enter inscription text and select "Times New Roman".
4. Click Update.
5. Reopen the edit drawer.
6. **Expected**: Inscription text and font are pre-populated with saved values.
7. Change font to "Other", enter "Uncial".
8. Click Update.
9. Reopen the edit drawer.
10. **Expected**: Font = "Other", Font Other = "Uncial" are both pre-populated.

---

## Scenario 3 — Proof pre-population from order inscription

1. Open an order with `inscription_text = "In Loving Memory"` and `inscription_font = "Garamond"` (set in Scenario 1 or 2).
2. Scroll to the Proof section in the order sidebar.
3. The ProofPanel should show the Generate form (no existing proof) or a button to generate.
4. Open the ProofGenerateForm.
5. **Expected**: Inscription Text field is pre-populated with "In Loving Memory".
6. **Expected**: Font Style dropdown shows "Garamond" selected.
7. Confirm the font dropdown contains all 8 options (Times New Roman, Arial, Palatino, Garamond, Script, Block, Old English, Other).

---

## Scenario 4 — Font "Other" not leaked on switch

1. Open an order's create/edit form.
2. Select "Other" → type "Papyrus" in Font Other.
3. Change Font Style to "Times New Roman".
4. **Expected**: Font Other input disappears.
5. Submit the order.
6. **Expected**: Saved `inscription_font = "Times New Roman"`, `inscription_font_other = null` (the custom font was cleared when switching away from "Other").

---

## Scenario 5 — Blank inscription fields save cleanly

1. Create or edit an order. Leave ALL inscription fields empty.
2. Submit.
3. **Expected**: No validation error. Order saves successfully with all inscription columns as NULL in the database.

---

## Scenario 6 — Migration idempotency

1. Apply the migration SQL a second time in the Supabase dashboard.
2. **Expected**: No error — the `IF NOT EXISTS` clause makes it safe to run multiple times.
