-- Create reporting views for Phase 1

-- Monthly revenue summary
create or replace view public.v_monthly_revenue as
select 
  date_trunc('month', i.issue_date) as month,
  count(*) as invoice_count,
  sum(case when i.status = 'paid' then i.amount else 0 end) as paid_amount,
  sum(case when i.status in ('pending', 'overdue') then i.amount else 0 end) as outstanding_amount,
  sum(i.amount) as total_amount
from public.invoices i
group by date_trunc('month', i.issue_date)
order by month desc;

-- Order status summary
create or replace view public.v_order_status_summary as
select 
  count(*) as total_orders,
  count(*) filter (where stone_status = 'In Stock' and permit_status = 'approved' and proof_status = 'Lettered') as ready_for_install,
  count(*) filter (where due_date < current_date and progress < 100) as overdue,
  count(*) filter (where permit_status in ('pending', 'form_sent') or proof_status = 'Not_Received') as pending_approval,
  avg(progress) as avg_progress
from public.orders;

-- Top products by revenue
create or replace view public.v_top_products as
select 
  o.order_type as product_name,
  count(*) as order_count,
  sum(o.value) as total_revenue
from public.orders o
where o.value is not null
group by o.order_type
order by total_revenue desc
limit 10;

