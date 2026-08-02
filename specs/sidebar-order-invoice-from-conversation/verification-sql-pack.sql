-- ============================================================================
-- Phase 4 verification SQL pack — sidebar order/invoice from conversation
-- Target org: Sears Melvin ONLY. Run in Supabase Dashboard SQL editor.
-- Discipline: SELECT-first → statement → read-back; paste actual outputs into
-- the evidence record. Nothing here touches Churchill data (one read-only
-- cross-org SELECT for AC-6 evidence, no writes).
--
-- Giorgi runs everything. Statements use full UUIDs resolved in Step 0 —
-- replace every <FULL_xxxxxxxx> placeholder with the exact UUID from Step 0
-- output before running any DELETE/UPDATE.
-- ============================================================================

-- Org constant (SM): 3770972d-1bbd-417b-b413-297e844db285

-- ----------------------------------------------------------------------------
-- STEP 0 — Resolve full UUIDs from the known prefixes (read-only)
-- Expect exactly 1 row per prefix; abort if any returns 0 or >1.
-- ----------------------------------------------------------------------------
SELECT 'order' AS kind, id, order_number, customer_name, created_at
FROM orders
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND (id::text LIKE '82261de0%' OR id::text LIKE '04296a30%' OR id::text LIKE '4a1bf3b4%');

SELECT 'invoice' AS kind, id, invoice_number, amount, created_at
FROM invoices
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id::text LIKE 'f5590d3d%';

SELECT 'person' AS kind, id, first_name, last_name, email, phone, created_at
FROM people
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id::text LIKE 'cf9f2b38%';

SELECT 'job' AS kind, id, person_id, conversation_id, stage, stage_status, created_at
FROM jobs
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id::text LIKE '63817f5c%';

-- ----------------------------------------------------------------------------
-- AC-1 / AC-2 — Orders created from the sidebar (flat + grouped views)
-- PASS: every row has non-null job_id, person_id, correct organization_id;
-- customer_email non-null when the linked person has an email.
-- ----------------------------------------------------------------------------
SELECT id, order_number, job_id, person_id, customer_email, customer_phone,
       invoice_id, organization_id, created_at
FROM orders
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND (id::text LIKE '82261de0%' OR id::text LIKE '04296a30%' OR id::text LIKE '4a1bf3b4%')
ORDER BY created_at;

-- ----------------------------------------------------------------------------
-- AC-3 — Two orders → one invoice (verified live: INV-000123; re-run for the
-- record against the test invoice). PASS: invoice person_id and job_id non-null,
-- order_id IS NULL (legacy field untouched); covered orders carry invoice_id.
-- ----------------------------------------------------------------------------
SELECT i.id, i.invoice_number, i.person_id, i.job_id, i.order_id, i.amount,
       i.organization_id,
       (SELECT count(*) FROM orders o
         WHERE o.invoice_id = i.id
           AND o.organization_id = i.organization_id) AS covered_orders
FROM invoices i
WHERE i.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND i.id::text LIKE 'f5590d3d%';

-- ----------------------------------------------------------------------------
-- AC-4 — Job stage unchanged by the whole flow
-- PASS: stage/stage_status match their values from before AC-1..AC-3 were run
-- (expected 'enquired'/'uncontacted' unless moved manually); exit fields null.
-- ----------------------------------------------------------------------------
SELECT id, stage, stage_status, exit_reason, exit_note, paid_at, created_at
FROM jobs
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id::text LIKE '63817f5c%';

-- ----------------------------------------------------------------------------
-- AC-5 — S5 person create/dedupe (verified live incl. the 23505 cross-org
-- case; re-run for the record). PASS: person org-scoped to SM; the conversation
-- the flow linked points at this person with link_state 'linked'.
-- ----------------------------------------------------------------------------
SELECT p.id, p.organization_id, p.first_name, p.last_name, p.email, p.phone
FROM people p
WHERE p.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND p.id::text LIKE 'cf9f2b38%';

SELECT c.id, c.person_id, c.link_state, c.primary_handle, c.organization_id
FROM inbox_conversations c
WHERE c.organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND c.person_id = '<FULL_cf9f2b38>';

-- ----------------------------------------------------------------------------
-- AC-6 — Org-scope negative check (read-only; includes one Churchill read)
-- Replace <TEST_EMAIL> with the email used in the live 23505 repro.
-- PASS: query 1 returns the Churchill row(s) (evidence the email exists
-- cross-org); query 2 returns ZERO SM rows with that email (no cross-org
-- match/link ever happened — the insert 23505'd instead, per known limitation).
-- ----------------------------------------------------------------------------
SELECT id, organization_id, email
FROM people
WHERE organization_id = 'a05ee759-c096-49d8-bebe-fb326b9ba9bc'   -- Churchill, READ-ONLY
  AND lower(email) = lower('<TEST_EMAIL>');

SELECT id, organization_id, email
FROM people
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND lower(email) = lower('<TEST_EMAIL>');

-- AC-7 — code inspection, no SQL: invoicing.api.ts fallback query now filters
--        .eq('organization_id', invoice.organization_id) (commit: FR-11).
-- AC-8 — not SQL: npx tsc --noEmit -p tsconfig.app.json → exactly 55, zero new.

-- ============================================================================
-- AC-9 — CLEANUP (ID-scoped, org-guarded, before/after SELECT evidence)
-- Replace every <FULL_…> with the Step 0 UUIDs first. Run in the order given
-- (children → orders → invoice → job → conversation unlink → person).
-- ============================================================================

-- ---- 9.0 BEFORE: full snapshot of everything to be deleted ------------------
SELECT 'orders' AS t, count(*) FROM orders
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id IN ('<FULL_82261de0>', '<FULL_04296a30>', '<FULL_4a1bf3b4>')
UNION ALL
SELECT 'order_additional_options', count(*) FROM order_additional_options
WHERE order_id IN ('<FULL_82261de0>', '<FULL_04296a30>', '<FULL_4a1bf3b4>')
UNION ALL
SELECT 'order_people', count(*) FROM order_people
WHERE order_id IN ('<FULL_82261de0>', '<FULL_04296a30>', '<FULL_4a1bf3b4>')
UNION ALL
SELECT 'invoices', count(*) FROM invoices
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id = '<FULL_f5590d3d>'
UNION ALL
SELECT 'invoice_payments', count(*) FROM invoice_payments
WHERE invoice_id = '<FULL_f5590d3d>'
UNION ALL
SELECT 'jobs', count(*) FROM jobs
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id = '<FULL_63817f5c>'
UNION ALL
SELECT 'people', count(*) FROM people
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id = '<FULL_cf9f2b38>';

-- STOP if invoice_payments > 0: a real payment row exists — do not delete the
-- invoice; escalate instead.

-- Guard: no OTHER orders reference the test invoice/job/person (would orphan or
-- block deletes). Expect 0 rows.
SELECT id, order_number, invoice_id, job_id, person_id
FROM orders
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND (invoice_id = '<FULL_f5590d3d>' OR job_id = '<FULL_63817f5c>' OR person_id = '<FULL_cf9f2b38>')
  AND id NOT IN ('<FULL_82261de0>', '<FULL_04296a30>', '<FULL_4a1bf3b4>');

-- ---- 9.1 Order children -----------------------------------------------------
DELETE FROM order_additional_options
WHERE order_id IN ('<FULL_82261de0>', '<FULL_04296a30>', '<FULL_4a1bf3b4>')
RETURNING id, order_id;

DELETE FROM order_people
WHERE order_id IN ('<FULL_82261de0>', '<FULL_04296a30>', '<FULL_4a1bf3b4>')
RETURNING order_id, person_id;

-- ---- 9.2 Orders -------------------------------------------------------------
DELETE FROM orders
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id IN ('<FULL_82261de0>', '<FULL_04296a30>', '<FULL_4a1bf3b4>')
RETURNING id, order_number;

-- ---- 9.3 Invoice ------------------------------------------------------------
DELETE FROM invoices
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id = '<FULL_f5590d3d>'
RETURNING id, invoice_number;

-- ---- 9.4 Job ----------------------------------------------------------------
DELETE FROM jobs
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id = '<FULL_63817f5c>'
RETURNING id, stage;

-- ---- 9.5 Unlink the conversation from the test person -----------------------
-- NOTE: payload deliberately excludes updated_at (PostgREST/API precedent;
-- direct SQL is safe either way, but keep the record consistent).
UPDATE inbox_conversations
SET person_id = NULL, link_state = 'unlinked', link_meta = '{}'::jsonb
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND person_id = '<FULL_cf9f2b38>'
RETURNING id, person_id, link_state;

-- ---- 9.6 Person -------------------------------------------------------------
DELETE FROM people
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id = '<FULL_cf9f2b38>'
RETURNING id, first_name, email;

-- ---- 9.7 AFTER: re-run the 9.0 snapshot — every count must be 0 -------------
-- (paste both 9.0 and 9.7 outputs into the evidence record)

-- ============================================================================
-- FLAGGED — William Allberry test fixture: job dc90fffa, person d0e02853
-- NOT deleted here; Giorgi to decide. Read-only inspection:
-- ============================================================================
SELECT 'wa_job' AS kind, id, person_id, conversation_id, stage, stage_status,
       exit_reason, paid_at, created_at
FROM jobs
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id::text LIKE 'dc90fffa%';

SELECT 'wa_person' AS kind, id, first_name, last_name, email, phone, created_at
FROM people
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND id::text LIKE 'd0e02853%';

-- Dependents that would need handling IF deletion is chosen (expect to review,
-- not act): orders/invoices/conversations referencing the fixture person/job.
SELECT 'wa_orders' AS kind, id, order_number, invoice_id, job_id
FROM orders
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND (person_id::text LIKE 'd0e02853%' OR job_id::text LIKE 'dc90fffa%');

SELECT 'wa_invoices' AS kind, id, invoice_number, person_id, job_id
FROM invoices
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND (person_id::text LIKE 'd0e02853%' OR job_id::text LIKE 'dc90fffa%');

SELECT 'wa_conversations' AS kind, id, link_state, primary_handle
FROM inbox_conversations
WHERE organization_id = '3770972d-1bbd-417b-b413-297e844db285'
  AND person_id::text LIKE 'd0e02853%';
