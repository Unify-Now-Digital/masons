-- Data fix: stamp is_test = true on SM test data so excludeTest filters
-- hide it from the UI. Hard-delete rejected: both invoices are soft-deleted
-- (deleted_at set) but RESTRICT FKs block person deletion, and INV-000117
-- references a live-mode voided Stripe invoice (in_1Ttq9sP7PyojXUvIMp0H1ARN)
-- worth keeping as a cross-reference. Applied via Dashboard 2026-07-21,
-- statement by statement.
--
-- Targets:
--   people:   cdab2579-... (test name / test@test.com)
--             ed85ceb3-... (test test / admin@unifynow.digital)
--   invoices: a6b8e069-... (INV-000114, GBP 0, soft-deleted, no Stripe)
--             d7c8682e-... (INV-000117, GBP 5000, soft-deleted, Stripe void)
--   orders:   29f8942d-... (owned by ed85ceb3)
--
-- Verify output after apply (all five rows):
--   person  cdab2579-f027-41b0-9728-7d2f7b52cc01  is_test = true
--   person  ed85ceb3-4f3b-407e-9e39-42d2a083f0f1  is_test = true
--   invoice a6b8e069-0f7c-4714-9d68-df7031a4c878  is_test = true
--   invoice d7c8682e-38fd-425a-ab0d-0ef72c1cccf9  is_test = true
--   order   29f8942d-6b81-4008-b213-fe596be87611  is_test = true
-- is_customer on ed85ceb3 verified false (trigger does not re-evaluate on
-- is_test change; no manual correction was needed).
-- Note: person delete remains blocked by RESTRICT FKs — intended end state.

UPDATE people SET is_test = true
WHERE id IN ('cdab2579-f027-41b0-9728-7d2f7b52cc01','ed85ceb3-4f3b-407e-9e39-42d2a083f0f1')
AND organization_id = '3770972d-1bbd-417b-b413-297e844db285';

UPDATE invoices SET is_test = true
WHERE id IN ('a6b8e069-0f7c-4714-9d68-df7031a4c878','d7c8682e-38fd-425a-ab0d-0ef72c1cccf9')
AND organization_id = '3770972d-1bbd-417b-b413-297e844db285';

UPDATE orders SET is_test = true
WHERE id = '29f8942d-6b81-4008-b213-fe596be87611'
AND organization_id = '3770972d-1bbd-417b-b413-297e844db285';