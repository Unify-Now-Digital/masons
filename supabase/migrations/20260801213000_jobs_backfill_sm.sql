-- Jobs backfill, SM org only. Applied manually via Dashboard 01 Aug 2026.
-- This file is the record, not the applier.
-- Dry-run: 43 enquiries (23 enquired, 20 quoted), all with conversation + person.
-- Churchill's 5 enquiries deliberately excluded (their intake goes live later).

INSERT INTO jobs (organization_id, person_id, enquiry_id, conversation_id, source, stage, stage_status, created_at)
SELECT e.organization_id, e.person_id, e.id, c.id, 'website',
       case when e.order_id is not null then 'quoted' else 'enquired' end,
       'pending', e.created_at
FROM enquiries e
LEFT JOIN inbox_conversations c ON c.external_thread_id = 'enquiry:' || e.id::text
WHERE e.organization_id = '3770972d-1bbd-417b-b413-297e844db285';
-- Applied: 43 rows. Read-back: 23 enquired / 20 quoted.

UPDATE orders o
SET job_id = j.id
FROM jobs j
JOIN enquiries e ON e.id = j.enquiry_id
WHERE e.order_id = o.id AND o.job_id IS NULL;
-- Applied: 20 rows. Read-back: 0 quote-orders with null job_id.

-- Pending (3.3): 11 non-quote orders await Arin's stage assignment Mon 03 Aug.
-- 7 of 11 are test rows (no jobs planned); ORD 218/219 = duplicate pair, one survives.