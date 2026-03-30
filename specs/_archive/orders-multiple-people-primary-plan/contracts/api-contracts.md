# API Contracts: order_people

## fetchOrderPeople

```typescript
function fetchOrderPeople(orderId: string): Promise<OrderPerson[]>
```

Returns rows with person_id, is_primary, plus optional join to customers (id, first_name, last_name, email, phone).

## upsertOrderPeople

```typescript
function upsertOrderPeople(
  orderId: string,
  people: { person_id: string; is_primary: boolean }[]
): Promise<void>
```

- Delete rows for persons not in list
- Upsert remaining with is_primary flags
- Exactly one primary; if none provided, set first as primary
- Optionally mirror primary into orders.person_id and orders.person_name

## OrderPerson type

```typescript
interface OrderPerson {
  id: string;
  order_id: string;
  person_id: string;
  is_primary: boolean;
  created_at: string;
  customers?: { id: string; first_name: string; last_name: string; email?: string | null; phone?: string | null };
}
```
