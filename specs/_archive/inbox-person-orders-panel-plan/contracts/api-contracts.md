# API Contracts: Person Orders

## fetchOrdersByPersonId

**Signature:**
```typescript
function fetchOrdersByPersonId(personId: string): Promise<Order[]>
```

**Query:** `orders_with_options_total` where `person_id = personId`, order by `created_at` desc.

**Returns:** Order[] (normalized via `normalizeOrder`).

## useOrdersByPersonId

**Signature:**
```typescript
function useOrdersByPersonId(personId: string | null | undefined): UseQueryResult<Order[]>
```

**Key:** `['orders', 'byPerson', personId]`  
**Enabled:** `!!personId`
