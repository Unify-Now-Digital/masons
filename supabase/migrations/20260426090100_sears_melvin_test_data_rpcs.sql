-- ============================================================
-- Migration: sears_melvin_test_data_rpcs
-- Purpose: Seed and clear RPCs for the Sears Melvin demo dataset.
--          Both refuse to run unless an organisation literally
--          named 'Sears Melvin' (case-insensitive) exists, so
--          Churchill or any other org is never touched.
--
--          All inserted rows are flagged is_test = true; the
--          clear RPC deletes only those rows scoped to the
--          Sears Melvin org id.
-- ============================================================

create or replace function public.seed_sears_melvin_test_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  -- cemetery uuids
  c_hampstead uuid := '00000000-aaaa-0000-0000-000000000001';
  c_manchester uuid := '00000000-aaaa-0000-0000-000000000002';
  c_bristol uuid := '00000000-aaaa-0000-0000-000000000003';
  c_edinburgh uuid := '00000000-aaaa-0000-0000-000000000004';
  c_cardiff uuid := '00000000-aaaa-0000-0000-000000000005';
  c_birmingham uuid := '00000000-aaaa-0000-0000-000000000006';
  -- customer uuids
  p_wells uuid := '00000000-bbbb-0000-0000-000000000001';
  p_morrison uuid := '00000000-bbbb-0000-0000-000000000002';
  p_okafor uuid := '00000000-bbbb-0000-0000-000000000003';
  p_singh uuid := '00000000-bbbb-0000-0000-000000000004';
  p_thomas uuid := '00000000-bbbb-0000-0000-000000000005';
  p_buchanan uuid := '00000000-bbbb-0000-0000-000000000006';
  -- pre-scheduled job uuids
  j_one uuid := '00000000-cccc-0000-0000-000000000001';
  j_two uuid := '00000000-cccc-0000-0000-000000000002';
  j_three uuid := '00000000-cccc-0000-0000-000000000003';
  j_four uuid := '00000000-cccc-0000-0000-000000000004';
begin
  select id into v_org
  from public.organizations
  where lower(name) = lower('Sears Melvin')
  limit 1;
  if v_org is null then
    raise exception 'Sears Melvin organisation not found — create it before seeding test data'
      using errcode = 'P0001';
  end if;

  -- ---------- Cemeteries (geocoded around UK cities) ----------
  insert into public.cemeteries (id, name, primary_email, phone, address, avg_approval_days, organization_id, is_test) values
    (c_hampstead,  'St Mary the Virgin, Hampstead',  'office@stmaryhampstead.test',  '020 7000 0001', 'Church Row, Hampstead, London NW3 6UU',           14, v_org, true),
    (c_manchester, 'Southern Cemetery, Manchester',  'office@manchester-southern.test','0161 000 0002', 'Barlow Moor Road, Manchester M21 7GL',           21, v_org, true),
    (c_bristol,    'Arnos Vale Cemetery, Bristol',   'office@arnosvale.test',        '0117 000 0003', 'Bath Road, Brislington, Bristol BS4 3EW',         18, v_org, true),
    (c_edinburgh,  'Greyfriars Kirkyard, Edinburgh', 'office@greyfriars.test',       '0131 000 0004', 'Greyfriars Place, Edinburgh EH1 2QQ',             10, v_org, true),
    (c_cardiff,    'Cathays Cemetery, Cardiff',      'office@cathays.test',          '029 0000 0005', 'Fairoak Road, Cardiff CF24 4PY',                  16, v_org, true),
    (c_birmingham, 'Lodge Hill Cemetery, Birmingham','office@lodgehill.test',        '0121 000 0006', 'Weoley Park Road, Selly Oak, Birmingham B29 6PT', 12, v_org, true)
  on conflict (id) do nothing;

  -- ---------- Customers ----------
  insert into public.customers (id, first_name, last_name, email, phone, address, city, country, organization_id, is_test) values
    (p_wells,    'Margaret', 'Wells',    'margaret.wells@example.test',  '07700 900001', '14 Elm Avenue, Hampstead',     'London',     'United Kingdom', v_org, true),
    (p_morrison, 'David',    'Morrison', 'david.morrison@example.test',  '07700 900002', '7 Park Road, Didsbury',         'Manchester', 'United Kingdom', v_org, true),
    (p_okafor,   'Chiamaka', 'Okafor',   'chi.okafor@example.test',      '07700 900003', '22 Hill Crescent, Bedminster',  'Bristol',    'United Kingdom', v_org, true),
    (p_singh,    'Harpreet', 'Singh',    'harpreet.singh@example.test',  '07700 900004', '5 The Close, Newington',        'Edinburgh',  'United Kingdom', v_org, true),
    (p_thomas,   'Bethan',   'Thomas',   'bethan.thomas@example.test',   '07700 900005', '3 Ty Glas Road, Llanishen',     'Cardiff',    'United Kingdom', v_org, true),
    (p_buchanan, 'Iain',     'Buchanan', 'iain.buchanan@example.test',   '07700 900006', '11 Linden Lane, Selly Oak',     'Birmingham', 'United Kingdom', v_org, true)
  on conflict (id) do nothing;

  -- ---------- Orders (25) ----------
  -- Every order is permit_status='approved' + proof_status='Lettered' + stone_status='In Stock'
  -- so they appear as schedulable on the Logistics Map tab. Lat/lng are jittered around
  -- the parent cemetery so clusters are visible on the map.
  insert into public.orders (
    id, organization_id, is_test,
    customer_name, person_id, cemetery_id,
    order_type, sku, location, latitude, longitude,
    stone_status, permit_status, proof_status,
    priority, value, timeline_weeks
  ) values
    -- Hampstead cluster (5)
    ('00000000-dddd-0000-0000-000000000001', v_org, true, 'Margaret Wells',  p_wells,  c_hampstead,  'New Memorial',          'GR-A-001', 'St Mary the Virgin, Hampstead', 51.5559, -0.1781, 'In Stock', 'approved', 'Lettered', 'high',   1850.00, 12),
    ('00000000-dddd-0000-0000-000000000002', v_org, true, 'Margaret Wells',  p_wells,  c_hampstead,  'Additional Inscription','GR-A-001', 'St Mary the Virgin, Hampstead', 51.5562, -0.1779, 'In Stock', 'approved', 'Lettered', 'medium',  280.00,  6),
    ('00000000-dddd-0000-0000-000000000003', v_org, true, 'James Whitfield', null,     c_hampstead,  'Kerb Set',              'GR-A-014', 'St Mary the Virgin, Hampstead', 51.5557, -0.1785, 'In Stock', 'approved', 'Lettered', 'medium', 2200.00, 14),
    ('00000000-dddd-0000-0000-000000000004', v_org, true, 'Eleanor Pope',    null,     c_hampstead,  'Renovation',            'GR-A-027', 'St Mary the Virgin, Hampstead', 51.5560, -0.1778, 'In Stock', 'approved', 'Lettered', 'low',     650.00,  8),
    ('00000000-dddd-0000-0000-000000000005', v_org, true, 'Robert Acton',    null,     c_hampstead,  'New Memorial',          'GR-A-031', 'St Mary the Virgin, Hampstead', 51.5564, -0.1783, 'In Stock', 'approved', 'Lettered', 'high',   2050.00, 10),
    -- Manchester cluster (4)
    ('00000000-dddd-0000-0000-000000000006', v_org, true, 'David Morrison',  p_morrison, c_manchester,'Kerb Set',             'SC-B-002', 'Southern Cemetery, Manchester', 53.4359, -2.2702, 'In Stock', 'approved', 'Lettered', 'high',   2400.00, 14),
    ('00000000-dddd-0000-0000-000000000007', v_org, true, 'David Morrison',  p_morrison, c_manchester,'New Memorial',         'SC-B-002', 'Southern Cemetery, Manchester', 53.4361, -2.2700, 'In Stock', 'approved', 'Lettered', 'medium', 1750.00, 12),
    ('00000000-dddd-0000-0000-000000000008', v_org, true, 'Patrick OBrien',  null,       c_manchester,'Renovation',           'SC-B-018', 'Southern Cemetery, Manchester', 53.4357, -2.2705, 'In Stock', 'approved', 'Lettered', 'low',     520.00,  6),
    ('00000000-dddd-0000-0000-000000000009', v_org, true, 'Anika Sharma',    null,       c_manchester,'Additional Inscription','SC-B-022','Southern Cemetery, Manchester', 53.4362, -2.2699, 'In Stock', 'approved', 'Lettered', 'medium',  240.00,  4),
    -- Bristol cluster (4)
    ('00000000-dddd-0000-0000-000000000010', v_org, true, 'Chiamaka Okafor', p_okafor, c_bristol,    'New Memorial',          'AV-C-007', 'Arnos Vale Cemetery, Bristol',  51.4459, -2.5697, 'In Stock', 'approved', 'Lettered', 'high',   1950.00, 12),
    ('00000000-dddd-0000-0000-000000000011', v_org, true, 'Sarah Penrose',   null,     c_bristol,    'Kerb Set',              'AV-C-019', 'Arnos Vale Cemetery, Bristol',  51.4456, -2.5694, 'In Stock', 'approved', 'Lettered', 'medium', 2350.00, 14),
    ('00000000-dddd-0000-0000-000000000012', v_org, true, 'Andrew Hartley',  null,     c_bristol,    'Renovation',            'AV-C-024', 'Arnos Vale Cemetery, Bristol',  51.4462, -2.5700, 'In Stock', 'approved', 'Lettered', 'low',     690.00,  8),
    ('00000000-dddd-0000-0000-000000000013', v_org, true, 'Lillian Tucker',  null,     c_bristol,    'Additional Inscription','AV-C-024', 'Arnos Vale Cemetery, Bristol',  51.4458, -2.5695, 'In Stock', 'approved', 'Lettered', 'medium',  300.00,  6),
    -- Edinburgh cluster (4)
    ('00000000-dddd-0000-0000-000000000014', v_org, true, 'Harpreet Singh',  p_singh,  c_edinburgh,  'New Memorial',          'GK-D-005', 'Greyfriars Kirkyard, Edinburgh',55.9469, -3.1929, 'In Stock', 'approved', 'Lettered', 'medium', 1800.00, 12),
    ('00000000-dddd-0000-0000-000000000015', v_org, true, 'Fraser MacLean',  null,     c_edinburgh,  'Kerb Set',              'GK-D-011', 'Greyfriars Kirkyard, Edinburgh',55.9472, -3.1925, 'In Stock', 'approved', 'Lettered', 'high',   2500.00, 14),
    ('00000000-dddd-0000-0000-000000000016', v_org, true, 'Catriona Bell',   null,     c_edinburgh,  'Renovation',            'GK-D-016', 'Greyfriars Kirkyard, Edinburgh',55.9466, -3.1932, 'In Stock', 'approved', 'Lettered', 'low',     580.00,  8),
    ('00000000-dddd-0000-0000-000000000017', v_org, true, 'Niamh Doyle',     null,     c_edinburgh,  'New Memorial',          'GK-D-021', 'Greyfriars Kirkyard, Edinburgh',55.9470, -3.1927, 'In Stock', 'approved', 'Lettered', 'medium', 1700.00, 10),
    -- Cardiff cluster (4)
    ('00000000-dddd-0000-0000-000000000018', v_org, true, 'Bethan Thomas',   p_thomas, c_cardiff,    'New Memorial',          'CC-E-003', 'Cathays Cemetery, Cardiff',     51.4925, -3.1788, 'In Stock', 'approved', 'Lettered', 'medium', 1900.00, 12),
    ('00000000-dddd-0000-0000-000000000019', v_org, true, 'Owain Jenkins',   null,     c_cardiff,    'Renovation',            'CC-E-008', 'Cathays Cemetery, Cardiff',     51.4928, -3.1791, 'In Stock', 'approved', 'Lettered', 'low',     640.00,  6),
    ('00000000-dddd-0000-0000-000000000020', v_org, true, 'Megan Harris',    null,     c_cardiff,    'Kerb Set',              'CC-E-013', 'Cathays Cemetery, Cardiff',     51.4923, -3.1786, 'In Stock', 'approved', 'Lettered', 'high',   2300.00, 14),
    ('00000000-dddd-0000-0000-000000000021', v_org, true, 'Caradoc Reece',   null,     c_cardiff,    'Additional Inscription','CC-E-013', 'Cathays Cemetery, Cardiff',     51.4926, -3.1789, 'In Stock', 'approved', 'Lettered', 'medium',  260.00,  4),
    -- Birmingham cluster (4)
    ('00000000-dddd-0000-0000-000000000022', v_org, true, 'Iain Buchanan',   p_buchanan, c_birmingham,'New Memorial',         'LH-F-002', 'Lodge Hill Cemetery, Birmingham',52.4378, -1.9621, 'In Stock', 'approved', 'Lettered', 'medium', 1880.00, 12),
    ('00000000-dddd-0000-0000-000000000023', v_org, true, 'Yusuf Khan',      null,       c_birmingham,'Kerb Set',             'LH-F-009', 'Lodge Hill Cemetery, Birmingham',52.4381, -1.9619, 'In Stock', 'approved', 'Lettered', 'high',   2450.00, 14),
    ('00000000-dddd-0000-0000-000000000024', v_org, true, 'Helena Rosso',    null,       c_birmingham,'Renovation',           'LH-F-014', 'Lodge Hill Cemetery, Birmingham',52.4376, -1.9624, 'In Stock', 'approved', 'Lettered', 'low',     710.00,  8),
    ('00000000-dddd-0000-0000-000000000025', v_org, true, 'George Pendrey',  null,       c_birmingham,'New Memorial',         'LH-F-020', 'Lodge Hill Cemetery, Birmingham',52.4379, -1.9622, 'In Stock', 'approved', 'Lettered', 'medium', 1620.00, 10)
  on conflict (id) do nothing;

  -- ---------- Jobs (4 — three already scheduled to demo the planner; one unscheduled) ----------
  insert into public.jobs (
    id, organization_id, is_test,
    order_id, customer_name, location_name, address, latitude, longitude,
    status, scheduled_date, priority, estimated_duration
  ) values
    (j_one,   v_org, true, '00000000-dddd-0000-0000-000000000001', 'Margaret Wells', 'St Mary the Virgin, Hampstead',  'Church Row, Hampstead, London NW3 6UU',           51.5559, -0.1781, 'scheduled',              (current_date + 2)::date, 'high',   '4 hours'),
    (j_two,   v_org, true, '00000000-dddd-0000-0000-000000000006', 'David Morrison', 'Southern Cemetery, Manchester',  'Barlow Moor Road, Manchester M21 7GL',           53.4359, -2.2702, 'scheduled',              (current_date + 5)::date, 'high',   '6 hours'),
    (j_three, v_org, true, '00000000-dddd-0000-0000-000000000010', 'Chiamaka Okafor','Arnos Vale Cemetery, Bristol',   'Bath Road, Brislington, Bristol BS4 3EW',         51.4459, -2.5697, 'scheduled',              (current_date + 8)::date, 'high',   '5 hours'),
    (j_four,  v_org, true, '00000000-dddd-0000-0000-000000000015', 'Fraser MacLean', 'Greyfriars Kirkyard, Edinburgh', 'Greyfriars Place, Edinburgh EH1 2QQ',             55.9472, -3.1925, 'ready_for_installation', null,                     'high',   '6 hours')
  on conflict (id) do nothing;

  -- Link those jobs back to their orders
  update public.orders set job_id = j_one   where id = '00000000-dddd-0000-0000-000000000001' and is_test;
  update public.orders set job_id = j_two   where id = '00000000-dddd-0000-0000-000000000006' and is_test;
  update public.orders set job_id = j_three where id = '00000000-dddd-0000-0000-000000000010' and is_test;
  update public.orders set job_id = j_four  where id = '00000000-dddd-0000-0000-000000000015' and is_test;

  -- ---------- Invoices ----------
  insert into public.invoices (
    id, organization_id, is_test,
    order_id, invoice_number, customer_name, amount, status, due_date, issue_date
  ) values
    ('00000000-eeee-0000-0000-000000000001', v_org, true, '00000000-dddd-0000-0000-000000000001', 'TEST-INV-0001', 'Margaret Wells',  1850.00, 'paid',    (current_date - 21)::date, (current_date - 60)::date),
    ('00000000-eeee-0000-0000-000000000002', v_org, true, '00000000-dddd-0000-0000-000000000006', 'TEST-INV-0002', 'David Morrison',  2400.00, 'pending', (current_date + 14)::date, (current_date - 7)::date),
    ('00000000-eeee-0000-0000-000000000003', v_org, true, '00000000-dddd-0000-0000-000000000010', 'TEST-INV-0003', 'Chiamaka Okafor', 1950.00, 'pending', (current_date + 28)::date, (current_date - 2)::date),
    ('00000000-eeee-0000-0000-000000000004', v_org, true, '00000000-dddd-0000-0000-000000000015', 'TEST-INV-0004', 'Fraser MacLean',  2500.00, 'overdue', (current_date - 5)::date,  (current_date - 35)::date),
    ('00000000-eeee-0000-0000-000000000005', v_org, true, '00000000-dddd-0000-0000-000000000018', 'TEST-INV-0005', 'Bethan Thomas',   1900.00, 'draft',   (current_date + 30)::date, current_date),
    ('00000000-eeee-0000-0000-000000000006', v_org, true, '00000000-dddd-0000-0000-000000000022', 'TEST-INV-0006', 'Iain Buchanan',   1880.00, 'pending', (current_date + 21)::date, (current_date - 4)::date)
  on conflict (id) do nothing;

  -- ---------- Payments ----------
  insert into public.payments (
    id, organization_id, is_test,
    invoice_id, amount, date, method, reference
  ) values
    ('00000000-ffff-0000-0000-000000000001', v_org, true, '00000000-eeee-0000-0000-000000000001',  925.00, (current_date - 55)::date, 'bank_transfer', 'TEST-DEPOSIT-0001'),
    ('00000000-ffff-0000-0000-000000000002', v_org, true, '00000000-eeee-0000-0000-000000000001',  925.00, (current_date - 21)::date, 'bank_transfer', 'TEST-FINAL-0001'),
    ('00000000-ffff-0000-0000-000000000003', v_org, true, '00000000-eeee-0000-0000-000000000002', 1200.00, (current_date - 5)::date,  'card',          'TEST-DEPOSIT-0002'),
    ('00000000-ffff-0000-0000-000000000004', v_org, true, '00000000-eeee-0000-0000-000000000003',  650.00, (current_date - 1)::date,  'cash',          'TEST-DEPOSIT-0003')
  on conflict (id) do nothing;

  -- ---------- Inscriptions ----------
  insert into public.inscriptions (
    id, organization_id, is_test,
    order_id, inscription_text, type, color, status
  ) values
    ('00000000-1111-0000-0000-000000000001', v_org, true, '00000000-dddd-0000-0000-000000000001',
     'In loving memory of Margaret Anne Wells, 1942 – 2024.', 'front', 'gold',  'approved'),
    ('00000000-1111-0000-0000-000000000002', v_org, true, '00000000-dddd-0000-0000-000000000006',
     'David James Morrison, 1955 – 2024. Devoted father and grandfather.', 'front', 'silver','approved'),
    ('00000000-1111-0000-0000-000000000003', v_org, true, '00000000-dddd-0000-0000-000000000010',
     'Beloved wife and mother, Patricia Okafor.', 'front', 'gold',   'approved'),
    ('00000000-1111-0000-0000-000000000004', v_org, true, '00000000-dddd-0000-0000-000000000015',
     'Iain MacLean, taken too soon. Forever in our hearts.', 'front', 'natural','engraving')
  on conflict (id) do nothing;
end$$;

create or replace function public.clear_sears_melvin_test_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select id into v_org
  from public.organizations
  where lower(name) = lower('Sears Melvin')
  limit 1;
  if v_org is null then
    raise exception 'Sears Melvin organisation not found — nothing to clear'
      using errcode = 'P0001';
  end if;

  -- FK-safe order. Related rows (order_people, order_additional_options, etc.)
  -- cascade on order delete.
  delete from public.payments     where organization_id = v_org and is_test;
  delete from public.invoices     where organization_id = v_org and is_test;
  delete from public.inscriptions where organization_id = v_org and is_test;
  -- Null orders.job_id before deleting jobs to avoid dangling references.
  update public.orders set job_id = null where organization_id = v_org and is_test and job_id is not null;
  delete from public.jobs       where organization_id = v_org and is_test;
  delete from public.orders     where organization_id = v_org and is_test;
  delete from public.customers  where organization_id = v_org and is_test;
  delete from public.cemeteries where organization_id = v_org and is_test;

  -- Conditional tables — only drop if columns/tables exist.
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='companies' and column_name='is_test') then
    execute format('delete from public.companies where organization_id = %L and is_test', v_org);
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='quotes' and column_name='is_test') then
    execute format('delete from public.quotes where organization_id = %L and is_test', v_org);
  end if;
end$$;

grant execute on function public.seed_sears_melvin_test_data()  to authenticated;
grant execute on function public.clear_sears_melvin_test_data() to authenticated;
