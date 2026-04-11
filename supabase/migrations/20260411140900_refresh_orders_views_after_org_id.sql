-- orders gained organization_id; recreate dependent views so o.* / i.* include it.

drop view if exists public.invoices_with_breakdown cascade;
drop view if exists public.orders_with_options_total cascade;

create view public.orders_with_options_total as
select
  o.*,
  coalesce(sum(ao.cost), 0)::numeric as additional_options_total
from public.orders o
left join public.order_additional_options ao
  on ao.order_id = o.id
group by o.id;

create view public.invoices_with_breakdown as
select
  i.*,
  b.main_product_total,
  b.permit_total_cost,
  b.additional_options_total
from public.invoices i
left join lateral (
  select
    sum(
      case
        when owt.order_type = 'Renovation' then coalesce(owt.renovation_service_cost, 0)
        else coalesce(owt.value, 0)
      end
    )::numeric as main_product_total,
    sum(coalesce(owt.permit_cost, 0))::numeric as permit_total_cost,
    sum(coalesce(owt.additional_options_total, 0))::numeric as additional_options_total
  from public.orders_with_options_total owt
  where owt.invoice_id = i.id
) b on true;
