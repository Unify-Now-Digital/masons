-- Payment reconciliation: fixes, constraint updates, and sample data.

-- ---------------------------------------------------------------------------
-- 1. Fix order_comments CHECK constraint to allow 'phone_note'
-- ---------------------------------------------------------------------------
alter table public.order_comments drop constraint if exists order_comments_comment_type_check;
alter table public.order_comments
  add constraint order_comments_comment_type_check
  check (comment_type in ('note', 'system', 'chase_sent', 'phone_note'));

-- ---------------------------------------------------------------------------
-- 2. Ensure 'payments' table exists (was created via dashboard, not in migrations)
--    This prevents runtime errors in reporting/payments hooks.
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete set null,
  amount numeric(10,2) not null,
  date date not null default current_date,
  method text not null default 'other',
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;

-- Allow all for now (matches existing permissive pattern)
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'payments_select_all') then
    execute 'create policy "payments_select_all" on public.payments for select to authenticated using (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'payments_insert_all') then
    execute 'create policy "payments_insert_all" on public.payments for insert to authenticated with check (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'payments_update_all') then
    execute 'create policy "payments_update_all" on public.payments for update to authenticated using (true) with check (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'payments_delete_all') then
    execute 'create policy "payments_delete_all" on public.payments for delete to authenticated using (true)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Sample data: orders with payment tracking values
--    (Only insert if orders table is empty or has no total_order_value set)
-- ---------------------------------------------------------------------------

-- Update existing orders to have total_order_value based on existing value column
update public.orders
set total_order_value = coalesce(value, 0)
where total_order_value is null and value is not null;

-- Insert sample orders if none exist
do $$
declare
  sample_count int;
begin
  select count(*) into sample_count from public.orders;
  if sample_count = 0 then
    insert into public.orders (customer_name, customer_email, customer_phone, order_type, sku, material, color, stone_status, permit_status, proof_status, value, total_order_value, amount_paid, location, progress, priority, timeline_weeks, deposit_date, due_date, notes)
    values
      ('Margaret Thompson', 'margaret.thompson@email.com', '07712345678', 'Headstone', 'HS-2048-GRY', 'Granite', 'Dark Grey', 'In Stock', 'approved', 'Lettered', 2450.00, 2650.00, 1325.00, 'St Mary''s Churchyard, Beaconsfield', 75, 'medium', 8, '2026-01-15', '2026-04-30', 'Photo plaque discussed — awaiting final photo from family'),
      ('James & Sarah Patel', 'james.patel@email.com', '07798765432', 'Headstone', 'HS-3072-BLK', 'Marble', 'Black', 'Ordered', 'pending', 'In_Progress', 3200.00, 3200.00, 1600.00, 'Amersham Cemetery', 40, 'high', 10, '2026-02-01', '2026-05-15', 'Inscription change requested — extra 20 characters'),
      ('Robert Williams', 'r.williams@email.com', '07654321098', 'Memorial', 'MM-1024-WHT', 'Marble', 'White', 'In Stock', 'approved', 'Lettered', 1800.00, 2100.00, 2100.00, 'Penn Street Cemetery', 100, 'low', 6, '2025-11-20', '2026-03-01', 'Completed and installed. Vase added after deposit.'),
      ('Elizabeth Chen', 'e.chen@email.com', '07543210987', 'Headstone', 'HS-2048-GRY', 'Granite', 'Light Grey', 'NA', 'form_sent', 'NA', 4500.00, 4500.00, 0.00, 'High Wycombe Cemetery', 5, 'medium', 12, null, '2026-07-01', 'New order — deposit invoice not yet sent'),
      ('David & Ann Morrison', 'morrison.family@email.com', '07432109876', 'Headstone', 'HS-4096-RST', 'Sandstone', 'Rustic', 'Ordered', 'customer_completed', 'Received', 2800.00, 3050.00, 1400.00, 'Chesham Bois Burial Ground', 55, 'high', 8, '2026-01-28', '2026-05-20', 'Colour change from grey to rustic after deposit — agreed via email'),
      ('Patricia Green', 'p.green@email.com', '07321098765', 'Renovation', 'REN-001', 'Granite', 'Dark Grey', 'NA', 'approved', 'Lettered', 850.00, 850.00, 425.00, 'Marlow Cemetery', 80, 'low', 4, '2026-03-01', '2026-04-15', 'Re-letter and clean existing memorial');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Sample order_payments (Stripe + Revolut, mix of matched and unmatched)
-- ---------------------------------------------------------------------------
do $$
declare
  ord1_id uuid;
  ord2_id uuid;
  ord3_id uuid;
  ord5_id uuid;
  ord6_id uuid;
begin
  -- Only insert if order_payments is empty
  if exists (select 1 from public.order_payments limit 1) then
    return;
  end if;

  select id into ord1_id from public.orders where customer_name = 'Margaret Thompson' limit 1;
  select id into ord2_id from public.orders where customer_name like 'James%' limit 1;
  select id into ord3_id from public.orders where customer_name = 'Robert Williams' limit 1;
  select id into ord5_id from public.orders where customer_name like 'David%' limit 1;
  select id into ord6_id from public.orders where customer_name = 'Patricia Green' limit 1;

  -- Matched Stripe payments
  if ord1_id is not null then
    insert into public.order_payments (order_id, source, external_id, amount, currency, payment_type, reference, match_reason, matched_at, matched_by, status, received_at)
    values (ord1_id, 'stripe', 'pi_sample_thompson_deposit', 1325.00, 'GBP', 'deposit', 'pi_3QxY7kABC_Thompson', 'metadata.order_id present', now() - interval '75 days', 'auto', 'matched', now() - interval '75 days');
  end if;

  if ord2_id is not null then
    insert into public.order_payments (order_id, source, external_id, amount, currency, payment_type, reference, match_reason, matched_at, matched_by, status, received_at)
    values (ord2_id, 'stripe', 'pi_sample_patel_deposit', 1600.00, 'GBP', 'deposit', 'pi_3RaB2kDEF_Patel', 'metadata.order_id present', now() - interval '58 days', 'auto', 'matched', now() - interval '58 days');
  end if;

  if ord3_id is not null then
    insert into public.order_payments (order_id, source, external_id, amount, currency, payment_type, reference, match_reason, matched_at, matched_by, status, received_at)
    values
      (ord3_id, 'stripe', 'pi_sample_williams_deposit', 900.00, 'GBP', 'deposit', 'pi_3PwX9kGHI_Williams', 'metadata.order_id present', now() - interval '130 days', 'auto', 'matched', now() - interval '130 days'),
      (ord3_id, 'revolut', 'rev_sample_williams_final', 1200.00, 'GBP', 'final', 'WILLIAMS MEMORIAL FINAL', 'Amount + name match', now() - interval '32 days', 'auto', 'matched', now() - interval '32 days');
  end if;

  if ord5_id is not null then
    insert into public.order_payments (order_id, source, external_id, amount, currency, payment_type, reference, match_reason, matched_at, matched_by, status, received_at)
    values (ord5_id, 'revolut', 'rev_sample_morrison_deposit', 1400.00, 'GBP', 'deposit', 'MORRISON headstone dep', 'Reference contains customer surname', now() - interval '62 days', 'auto', 'matched', now() - interval '62 days');
  end if;

  if ord6_id is not null then
    insert into public.order_payments (order_id, source, external_id, amount, currency, payment_type, reference, match_reason, matched_at, matched_by, status, received_at)
    values (ord6_id, 'stripe', 'pi_sample_green_deposit', 425.00, 'GBP', 'deposit', 'pi_3ScD4kJKL_Green', 'metadata.order_id present', now() - interval '30 days', 'auto', 'matched', now() - interval '30 days');
  end if;

  -- Unmatched payments (need manual review)
  insert into public.order_payments (order_id, source, external_id, amount, currency, reference, match_reason, match_candidates, status, received_at)
  values
    (null, 'revolut', 'rev_sample_unmatched_1', 2200.00, 'GBP', 'MEMORIAL PAYMENT KUMAR',
     'No matching orders found for surname "KUMAR"',
     '[{"order_id": "' || coalesce(ord2_id::text, '00000000-0000-0000-0000-000000000000') || '", "order_ref": "2", "customer_name": "James & Sarah Patel", "expected_amount": 1600.00, "confidence": "amount", "reason": "Closest amount match"}]'::jsonb,
     'unmatched', now() - interval '3 days'),

    (null, 'stripe', 'pi_sample_unmatched_2', 750.00, 'GBP', 'pi_3TfG7kMNO_unknown',
     'Stripe customer ID not found in system',
     null,
     'unmatched', now() - interval '1 day'),

    (null, 'revolut', 'rev_sample_unmatched_3', 1325.00, 'GBP', 'HEADSTONE DEPOSIT',
     'Amount matches multiple orders — manual review needed',
     case when ord1_id is not null then
       ('[{"order_id": "' || ord1_id::text || '", "order_ref": "1", "customer_name": "Margaret Thompson", "expected_amount": 1325.00, "confidence": "exact", "reason": "Amount matches expected deposit"}]')::jsonb
     else null end,
     'unmatched', now() - interval '5 hours'),

    -- Permit pass-through example
    (null, 'revolut', 'rev_sample_permit_passthru', 385.00, 'GBP', 'CEMETERY FEE BEACONSFIELD',
     'Marked as permit pass-through', null,
     'pass_through', now() - interval '14 days');
end $$;

-- ---------------------------------------------------------------------------
-- 5. Sample order_extras (AI-detected changes from conversations)
-- ---------------------------------------------------------------------------
do $$
declare
  ord1_id uuid;
  ord2_id uuid;
  ord3_id uuid;
  ord5_id uuid;
begin
  if exists (select 1 from public.order_extras limit 1) then
    return;
  end if;

  select id into ord1_id from public.orders where customer_name = 'Margaret Thompson' limit 1;
  select id into ord2_id from public.orders where customer_name like 'James%' limit 1;
  select id into ord3_id from public.orders where customer_name = 'Robert Williams' limit 1;
  select id into ord5_id from public.orders where customer_name like 'David%' limit 1;

  -- High confidence: confirmed changes
  if ord1_id is not null then
    insert into public.order_extras (order_id, source, change_type, description, quote_snippet, quote_date, quote_sender, confidence, confidence_reason, suggested_amount, status)
    values (ord1_id, 'gmail', 'photo_plaque', 'Photo plaque addition — ceramic oval with gilded edge',
      'Yes please go ahead with the photo plaque. The oval one with the gold edge looks lovely. We''ll send the photo over this weekend.',
      now() - interval '18 days', 'Margaret Thompson', 'high',
      'Customer explicitly agreed to photo plaque addition. Price discussed in previous message (£185).',
      185.00, 'pending');
  end if;

  if ord2_id is not null then
    insert into public.order_extras (order_id, source, change_type, description, quote_snippet, quote_date, quote_sender, confidence, confidence_reason, suggested_amount, status)
    values (ord2_id, 'whatsapp', 'inscription_increase', 'Inscription extended by 24 additional characters',
      'We''d like to add "Forever in our hearts, always in our thoughts" below the main text. Is that OK? Happy to pay the extra.',
      now() - interval '12 days', 'Sarah Patel', 'high',
      'Customer confirmed additional text and acknowledged extra cost. 24 chars at £3.50/char = £84.',
      84.00, 'pending');
  end if;

  -- Medium confidence: needs review
  if ord5_id is not null then
    insert into public.order_extras (order_id, source, change_type, description, quote_snippet, quote_date, quote_sender, confidence, confidence_reason, suggested_amount, status)
    values (ord5_id, 'gmail', 'colour_change', 'Stone colour change from Dark Grey to Rustic Sandstone',
      'We''ve been thinking and actually prefer the rustic look. Would it be possible to change to the sandstone? What would the difference in cost be?',
      now() - interval '25 days', 'David Morrison', 'medium',
      'No price confirmed in conversation — verify material cost difference with Matthew before invoicing.',
      250.00, 'pending');
  end if;

  if ord1_id is not null then
    insert into public.order_extras (order_id, source, change_type, description, quote_snippet, quote_date, quote_sender, confidence, confidence_reason, suggested_amount, status)
    values (ord1_id, 'phone_note', 'vase', 'Granite vase to match headstone discussed on call',
      'Margaret called to ask about adding a matching granite vase. Quoted £120. She said she''d think about it and call back.',
      now() - interval '8 days', 'Aylin', 'medium',
      'Customer was quoted but has not confirmed yet. Awaiting callback.',
      120.00, 'pending');
  end if;

  -- Low confidence
  if ord2_id is not null then
    insert into public.order_extras (order_id, source, change_type, description, quote_snippet, quote_date, quote_sender, confidence, confidence_reason, suggested_amount, status)
    values (ord2_id, 'gmail', 'other', 'Possible kerb set addition mentioned in passing',
      'By the way, do you also do kerb sets? Just wondering for future reference.',
      now() - interval '20 days', 'James Patel', 'low',
      'Customer only enquired about kerb sets — no confirmation or pricing discussed. Likely not actionable.',
      null, 'pending');
  end if;

  -- Already actioned example
  if ord3_id is not null then
    insert into public.order_extras (order_id, source, change_type, description, quote_snippet, quote_date, quote_sender, confidence, confidence_reason, suggested_amount, status, actioned_by, actioned_at)
    values (ord3_id, 'gmail', 'vase', 'Granite flower vase added to order',
      'Yes definitely add the vase please, the grey granite one. £120 is fine.',
      now() - interval '60 days', 'Robert Williams', 'high',
      'Customer confirmed vase and price.',
      120.00, 'added_to_invoice', 'Aylin', now() - interval '55 days');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Sample order_comments (phone notes for extras detection)
-- ---------------------------------------------------------------------------
do $$
declare
  ord1_id uuid;
  ord5_id uuid;
begin
  select id into ord1_id from public.orders where customer_name = 'Margaret Thompson' limit 1;
  select id into ord5_id from public.orders where customer_name like 'David%' limit 1;

  if ord1_id is not null and not exists (select 1 from public.order_comments where order_id = ord1_id and comment_type = 'phone_note') then
    insert into public.order_comments (order_id, author, body, comment_type, created_at)
    values
      (ord1_id, 'Aylin', 'Margaret called to ask about adding a matching granite vase. Quoted £120. She said she''d think about it and call back.', 'phone_note', now() - interval '8 days'),
      (ord1_id, 'Aylin', 'Margaret confirmed she wants the photo plaque. Sending photo this weekend. Oval with gilded edge — £185.', 'phone_note', now() - interval '19 days');
  end if;

  if ord5_id is not null and not exists (select 1 from public.order_comments where order_id = ord5_id and comment_type = 'phone_note') then
    insert into public.order_comments (order_id, author, body, comment_type, created_at)
    values
      (ord5_id, 'Aylin', 'David Morrison rang — wants to change stone colour from dark grey to rustic sandstone. Need to check cost diff with Matthew.', 'phone_note', now() - interval '26 days');
  end if;
end $$;
