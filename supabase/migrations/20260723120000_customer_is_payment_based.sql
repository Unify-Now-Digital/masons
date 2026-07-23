-- Customer = has ≥1 real Stripe payment (Arin ruling, July 23 call).
-- Replaces order-based trg_orders_set_person_is_customer.
-- Applied statement-by-statement in Dashboard SQL editor, 2026-07-23.
--
-- VERIFICATION AT APPLY TIME:
-- Pre-backfill customer census (A6): 12 people, all SM
--   (3770972d-1bbd-417b-b413-297e844db285), emails: andrew@aya-creative.co.uk,
--   cantongeraldine22, faithosejindu, grahampatricia961, mellisadaley3,
--   nikki.henry, nnoshea, robbarnett7, samanthajalloh15, sophie.grinstead19,
--   theresagrossett, tia.n.shand01. All flipped to enquiry (0 payment evidence).
-- Backfill (A7): UPDATE 12; read-back count(*) where is_customer=true → 0.
-- Live trigger proof (A8): linked INV-000110 (£1 test, SM) to person
--   bec08cf7-… → is_customer=true; unlinked → false. Trigger fires both ways.
-- Ground truth found during spec: order_payments table EMPTY (0 rows);
--   all 11 invoice_payments rows are test artifacts; invoices.person_id
--   never written by any code path (P5 prerequisite: stamp it at creation).

-- A1: human-override tombstone (trigger never stomps a set override)
ALTER TABLE people
  ADD COLUMN is_customer_override boolean,
  ADD COLUMN customer_override_at timestamptz;

-- A2: single source of truth for the rule
CREATE OR REPLACE FUNCTION public.recompute_person_is_customer(p_person uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_derived boolean;
BEGIN
  IF p_person IS NULL THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM invoices i
    WHERE i.person_id = p_person
      AND i.organization_id IS NOT NULL
      AND coalesce(i.is_test, false) = false
      AND i.deleted_at IS NULL
      AND (
        coalesce(i.amount_paid, 0) > 0
        OR i.paid_at IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM invoice_payments ip
          WHERE ip.invoice_id = i.id AND ip.status = 'paid'
        )
      )
  ) INTO v_derived;

  UPDATE people p
  SET is_customer = coalesce(p.is_customer_override, v_derived)
  WHERE p.id = p_person
    AND p.is_customer IS DISTINCT FROM coalesce(p.is_customer_override, v_derived);
END;
$$;

-- A3: trigger wrappers
CREATE OR REPLACE FUNCTION public.trg_invoices_recompute_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM recompute_person_is_customer(NEW.person_id);
  IF TG_OP = 'UPDATE' AND OLD.person_id IS DISTINCT FROM NEW.person_id THEN
    PERFORM recompute_person_is_customer(OLD.person_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_invoice_payments_recompute_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM recompute_person_is_customer(
    (SELECT person_id FROM invoices WHERE id = NEW.invoice_id)
  );
  RETURN NEW;
END;
$$;

-- A4: attach
CREATE TRIGGER trg_invoices_set_person_is_customer
AFTER INSERT OR UPDATE OF person_id, amount_paid, paid_at, stripe_status, is_test, deleted_at
ON invoices
FOR EACH ROW EXECUTE FUNCTION trg_invoices_recompute_customer();

CREATE TRIGGER trg_invoice_payments_set_person_is_customer
AFTER INSERT OR UPDATE OF status
ON invoice_payments
FOR EACH ROW EXECUTE FUNCTION trg_invoice_payments_recompute_customer();

-- A5: drop the order-based predecessor
DROP TRIGGER trg_orders_set_person_is_customer ON orders;
DROP FUNCTION set_person_is_customer();

-- A7: backfill (A6 dry-run confirmed exactly the 12 expected flips first)
UPDATE people
SET is_customer = false
WHERE is_customer = true
  AND is_customer_override IS NULL;