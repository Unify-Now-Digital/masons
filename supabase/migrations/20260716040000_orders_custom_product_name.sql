-- Free-text product name for memorial products not in the products list.
-- Wins over product_id in invoice line-item naming. Applied via Dashboard SQL editor 2026-07-16.
alter table orders add column custom_product_name text;
