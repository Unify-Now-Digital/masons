# Data Model: Inbox Person Orders Panel

## No Schema Changes

No migrations. Uses existing `orders.person_id` FK.

## Query

```sql
-- Fetch orders for a person (via orders_with_options_total view)
SELECT o.*, coalesce(sum(ao.cost), 0)::numeric as additional_options_total
FROM orders o
LEFT JOIN order_additional_options ao ON ao.order_id = o.id
WHERE o.person_id = $1
GROUP BY o.id
ORDER BY o.created_at DESC;
```

Supabase: `.from('orders_with_options_total').select('*, customers(id, first_name, last_name)').eq('person_id', personId).order('created_at', { ascending: false })`
