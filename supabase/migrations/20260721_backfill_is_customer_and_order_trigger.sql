-- is_customer backfill + maintenance trigger. Applied via Dashboard SQL
-- editor 2026-07-21, statement-by-statement.
--
-- Rule (Giorgi's product ruling 2026-07-21): a person is a customer when
-- they have >=1 non-test order. people.is_customer maintained by trigger
-- below; manual toggle to follow in UI.
--
-- Dry-run: 13 SM people with non-test-flagged orders; 2 excluded as test
-- data (Giorgi Kotchlamazashvili bec08cf7-…, "test test" admin@unifynow
-- ed85ceb3-…) — their orders lack is_test=true, separate cleanup pending.
-- Re-verify after apply (org 3770972d-1bbd-417b-b413-297e844db285):
--   customers = 11, total_people = 33. All 13 were false pre-apply,
--   so count of 11 confirms exactly the 11 intended rows flipped. ✓

UPDATE people
SET is_customer = true
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND is_customer = false
  AND id IN (
    '08a96515-345b-4a43-bba0-20d0b114b88a',
    '2b38f727-f24a-4743-a816-d94295a492c1',
    '2ee7ac0b-53a9-4628-abdf-f41aa28dbd41',
    '45c006c1-ef98-45b3-b8f7-d2c870bb5107',
    '7cf0973e-94ca-4335-b213-fae5c9814ae3',
    '9ca40844-c011-4354-8fee-ffabf4142fff',
    'a2c68643-629a-42a0-aaba-fcaa972f03bd',
    'e2ab8704-e2cd-453f-97af-620c8fcba8b8',
    'e75dfb56-f2a1-406b-934c-cd6bec1b988c',
    '08048100-ef99-4d11-a1cf-c43001d28d9b',
    'f98bee45-d963-40d2-a9c5-88f6f900a602'
  );

CREATE OR REPLACE FUNCTION public.set_person_is_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.person_id IS NOT NULL AND coalesce(NEW.is_test, false) = false THEN
    UPDATE people
    SET is_customer = true
    WHERE id = NEW.person_id
      AND is_customer = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_set_person_is_customer
AFTER INSERT OR UPDATE OF person_id ON orders
FOR EACH ROW
EXECUTE FUNCTION public.set_person_is_customer();