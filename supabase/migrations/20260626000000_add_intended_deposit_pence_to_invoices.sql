-- Deposit amount chosen at invoice creation; pre-fills the partial-payment collect card.
-- Applied manually via Supabase Dashboard SQL editor on production (bfwohzcugtwbhhxdqgme).
alter table invoices add column intended_deposit_pence bigint null;
