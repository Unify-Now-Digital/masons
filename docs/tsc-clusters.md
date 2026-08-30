# tsc error clusters

Updated: 2026-08-30
Source: `specs/inbox-sidebar-multi-tabs/tsc-baseline-items.txt` (54 items, `tsconfig.app.json`). Read-only audit; no tsc run. Bracketed `[n]` = baseline line number. Root causes only — no edits proposed here.

Two facts that shape most clusters:
- The app client is `createClient<any>` (`src/shared/lib/supabase.ts:38`, rationale comment at `:36`). The checked-in generated types (`src/shared/types/database.types.ts`) are therefore never consumed by PostgREST typing; every `.select()` embed is typed as an array and every scalar as `any`. Clusters 3, 6, 7 and singleton [8] trace to this.
- `strictNullChecks` is off (`tsconfig.json:17`; `tsconfig.app.json:18` `strict: false`), so every `z.infer<>` object key becomes optional. Cluster 5 is this directly; Cluster 1's error text shows it.

| Cluster | Count |
|---|---|
| 1 — RHF drawers vs pruned zod schemas | 9 |
| 2 — `ScheduleStop` vs `JobLike` naming | 8 |
| 3 — `createClient<any>` embedded-relation arrays | 7 |
| 4 — `organization_id` rollout not in hand-written types | 6 |
| 5 — zod optionality under `strictNullChecks: false` | 4 |
| 6 — non-literal `.select()` string in `useMemorials` | 4 |
| 7 — `Omit`-derived `*Insert` require generated columns | 3 |
| 8 — `Worker` not re-exported from `useWorkers` | 3 |
| 9 — `React.cloneElement` on opaque element | 2 |
| 10 — `[unknown, unknown]` tuple annotation | 2 |
| 11 — singletons | 6 |
| **Total** | **54** |

## Clusters

### Cluster 1 — RHF drawers reference form fields the zod schema no longer declares (9)

- **Error codes:** TS2353 ×4, TS2322 ×2, TS2345 ×1, TS2339 ×2
- **Files:**
  - `src/modules/invoicing/components/EditInvoiceDrawer.tsx:100` [11], `:115` [12], `:149` [13] — field `order_id`
  - `src/modules/jobs/components/EditJobDrawer.tsx:103` [17], `:121` [18], `:149` [19], `:206` [20] — field `customer_name`
  - `src/modules/invoicing/components/OrderFormInline.tsx:83` [16] — field `productId`
  - `src/modules/orders/components/EditOrderDrawer.tsx:395` [38] — field `person_name`
- **Root cause:** schemas were pruned, consumers were not. `src/modules/invoicing/schemas/invoice.schema.ts:4` records `// order_id removed: Orders will be created inline, not selected`; `src/modules/jobs/schemas/job.schema.ts:4` records `// Removed: order_id, customer_name`. `InvoiceFormData`/`JobFormData` (`invoice.schema.ts:28`, `job.schema.ts:22`) no longer carry keys that `defaultValues`/`reset`/`setValue`/`<FormField name>` still pass. Two are naming drift: `OrderFormInline.tsx:83` writes `productId` where the schema key is `product_id` (`src/modules/orders/schemas/order.schema.ts:84`); `EditOrderDrawer.tsx:395` destructures `person_name`, never added to `orderFormSchema` (`order.schema.ts:32-92`) though present on the row type (`src/modules/orders/types/orders.types.ts:39`).
- **Probable single fix:** the zod schemas are the source of truth for the RHF generic; three drawers plus one inline form still address columns dropped from (or never added to) those schemas during the invoice-inline-order and jobs-pipeline cutovers (`supabase/migrations/20260820170000_quote_to_job_cutover.sql`, `20260801210000_jobs_pipeline_schema.sql`). Row types still expose the columns, so schemas and drawers disagree about which fields the form owns.
- **Blast radius:** `JobFormData` 10 lines / 4 files; `InvoiceFormData` 7 lines / 3 files; `OrderFormData` 17 lines / 5 files. Any schema change also moves Cluster 5.
- **Count cleared:** 9

### Cluster 2 — `ScheduleStop` (camelCase) passed to `JobLike` (snake_case) helpers (8)

- **Error codes:** TS2559 ×5, TS2345 ×2, TS2769 ×1
- **Files:** `src/modules/logistics/components/mapTab/DayCard.tsx:102` [22], `:151` [23], `:236` [24], `:251` [25]; `mapTab/UkJobsMap.tsx:69` [26]; `mapTab/UnscheduledList.tsx:68` [27]; `src/modules/logistics/utils/autoSchedule.ts:96` [28], `:97` [29]
- **Root cause:** `JobLike` has exactly one member, `order_type?: string | null` (`src/modules/logistics/utils/jobTypeClassifier.ts:3-5`); the Map-tab scheduler unit carries the same datum as `orderType: string` (`src/modules/logistics/utils/scheduleTypes.ts:15`). Zero shared properties → TS2559. TS2769 at `autoSchedule.ts:97` is the same cause via `filter(isKerb)`.
- **Probable single fix:** classifier/capacity layer (`jobTypeClassifier.ts`, `capacityRules.ts`) was written against raw DB row shape; the Map-tab scheduler introduced a camelCase view-model. Naming was never reconciled. No migration involved.
- **Blast radius:** `ScheduleStop` 27 lines / 7 files; `isKerb`/`compose(`/`canAdd(` 19 lines. Consumers: `capacityRules.ts:13`, `:30` and the four Map-tab files.
- **Count cleared:** 8

### Cluster 3 — `createClient<any>` makes every embedded PostgREST relation an array (7)

- **Error codes:** TS2352 ×5, TS2345 ×2
- **Files:** `src/modules/finance/api/finance.api.ts:174` [1]; `src/modules/hub/api/hub.api.ts:232` [2]; `src/modules/logistics/api/logistics.api.ts:116` [21]; `src/modules/priority/api/priority.api.ts:142` [45], `:209` [46]; `src/modules/workers/api/workers.api.ts:97` [47], `:112` [48]
- **Root cause:** with `Database = any`, postgrest-js (1.19.4) takes the schema-less branch at `node_modules/@supabase/postgrest-js/dist/cjs/select-query-parser/result.d.ts:22`, typing any embed with children as `ProcessNodesWithoutSchema<...>[]`. Each call site declares the embed as singular nullable (`finance.api.ts:160-163`, `hub.api.ts:221`, `logistics.api.ts:114`, `priority.api.ts:133-140`, `:198-206`, `workers.api.ts:97`, `:112`), so `X[]` vs `X | null` never overlap.
- **Probable single fix:** a single decision about the client generic, not per-site casts; all 7 sites hand-write the cardinality the type system would infer with a real `Database` type (schema-aware resolution at `result.d.ts:99-122`).
- **Blast radius:** 80 files import `supabase` from `@/shared/lib/supabase` — re-typing the generic re-checks the whole data layer. Narrow alternative (fix the 7 declared shapes) touches only the 7 files.
- **Count cleared:** 7

### Cluster 4 — `organization_id` rollout not propagated into hand-written types and one hook signature (6)

- **Error codes:** TS2353 ×2, TS2339 ×2, TS2554 ×2
- **Files:** `src/modules/inbox/api/inboxConversations.api.ts:94` [3]; `src/shared/tableViewPresets/api/tableViewPresets.api.ts:31` [52], `:41` [53]; `src/shared/tableViewPresets/components/PresetsTab.tsx:65` [54]; `src/modules/invoicing/components/InvoiceWorkspace.tsx:106` [14]; `src/modules/orders/pages/OrdersPage.tsx:75` [44]
- **Root cause:** DB and generated types both have the column (`database.types.ts:1005`, `:4248`); the hand-written module types do not — `InboxConversationInsert` derives from `InboxConversation` (`src/modules/inbox/types/inbox.types.ts:82`, interface at `:24-49`, no `organization_id`); `TableViewPresetInsert` is standalone with only `module`, `name`, `config`, `is_default` (`src/shared/tableViewPresets/types/tableViewPresets.types.ts:34-39`). The two TS2554s: `usePresetsByModule(module, organizationId)` gained a required second param (`src/shared/tableViewPresets/hooks/useTableViewPresets.ts:15`); `PresetsTab.tsx:42` was updated, `InvoiceWorkspace.tsx:106` and `OrdersPage.tsx:75` were not.
- **Probable single fix:** migrations `20260411140300_add_organization_id_inbox_comms.sql:3-4` and `20260411140400_add_organization_id_remaining.sql:96` added tenant scoping that runtime code adopted but hand-maintained interfaces did not. "Regenerate Supabase types" does not apply — the generated file is already correct and unused.
- **Blast radius:** `InboxConversation` 20 files; `createPreset`/`useCreatePreset` 7 lines; `usePresetsByModule` 7 lines / 4 files.
- **Count cleared:** 6

### Cluster 5 — zod-inferred optionality (from `strictNullChecks: false`) vs required hand-written interfaces (4)

- **Error codes:** TS2322 ×3, TS2345 ×1
- **Files:** `src/modules/orders/components/CreateOrderDrawer.tsx:291` [36], `:474` [37]; `src/modules/orders/components/EditOrderDrawer.tsx:445` [39], `:682` [40]
- **Root cause:** `orderPeopleSchema` declares both members required (`order.schema.ts:27-30`), yet `field.value` is `{ person_id?; is_primary? }[]` because under `strictNullChecks: false` zod's `addQuestionMarks` (`undefined extends T[k]`) is true for every key. `OrderPeoplePicker` declares both required (`src/modules/orders/components/OrderPeoplePicker.tsx:16-19`).
- **Probable single fix:** compiler config degrades every `z.infer<>` to all-optional; `OrderPersonSelection` was written as if strict were on. Only observable at the form-state → picker boundary.
- **Blast radius:** `OrderPeoplePicker` 6 lines; `OrderFormData` 17 lines / 5 files. Flipping `strictNullChecks` re-checks all of `src`; scoping to the picker prop type touches 2 files.
- **Count cleared:** 4

### Cluster 6 — `useMemorials` passes a runtime-built string to `.select()` (4)

- **Error codes:** TS2352 ×4
- **Files:** `src/modules/memorials/hooks/useMemorials.ts:74` [31], `:85` [32], `:96` [33], `:108` [34]
- **Root cause:** `MEMORIAL_FIELDS` is `[...].join(', ')` (`useMemorials.ts:39-64`) → type `string`; postgrest-js short-circuits to `GenericStringError` (`select-query-parser/parser.d.ts:10`, `:227`). The `as Memorial`/`as Memorial[]` casts have nothing to overlap.
- **Probable single fix:** column list is runtime-computed rather than a literal; schema and `Memorial` interface (`:4-29`) are fine — all names appear in `memorials` at `database.types.ts:1887`.
- **Blast radius:** `useMemorials` imported on 7 lines; fix is file-local but covers every memorials read path.
- **Count cleared:** 4

### Cluster 7 — `*Insert` types derived by `Omit<Row, 'id'|'created_at'|'updated_at'>` demand DB-generated columns (3)

- **Error codes:** TS2345 ×3
- **Files:** `src/modules/invoicing/components/CreateInvoiceDrawer.tsx:339` [9] (`InvoiceInsert`), `:426` [10] (`OrderInsert`); `src/modules/orders/components/CreateOrderDrawer.tsx:289` [35] (`OrderInsert`)
- **Root cause:** `InvoiceInsert` (`src/modules/invoicing/types/invoicing.types.ts:65`) keeps DB-assigned `invoice_number` required (`:8`); `OrderInsert` (`src/modules/orders/types/orders.types.ts:116`) keeps `order_number` (`:32`) and `geocode_status`/`geocode_error`/`geocoded_at`/`geocode_place_id` (`:70-73`) required. Neither payload constructs them.
- **Probable single fix:** `Insert` aliases omit only the three universal audit columns, so every other server-generated column stays required. Generated types model this correctly (`invoices.Insert` at `database.types.ts:1634-1642`) but are unused.
- **Blast radius:** `OrderInsert` 15 lines; `InvoiceInsert` 6 lines. Widening relaxes every insert path in orders and invoicing.
- **Count cleared:** 3

### Cluster 8 — `Worker` imported from the hook instead of the types module (3)

- **Error codes:** TS2305 ×3
- **Files:** `src/modules/workers/components/DeleteWorkerDialog.tsx:14` [49]; `src/modules/workers/components/EditWorkerDrawer.tsx:26` [50]; `src/modules/workers/pages/WorkersPage.tsx:10` [51]
- **Root cause:** `Worker` is exported only from `src/modules/workers/types/workers.types.ts:1`; `useWorkers.ts:15` imports `WorkerInsert, WorkerUpdate, WorkerAvailabilityInsert` without re-exporting `Worker`.
- **Probable single fix:** a re-export was removed or never added; the API layer already imports from the right place (`workers.api.ts:1-8`).
- **Blast radius:** 10 files reference `workers.api`/`useWorkers`; only the 3 listed go through the hook. Additive.
- **Count cleared:** 3

### Cluster 9 — `React.cloneElement` on an `isValidElement`-narrowed node (2)

- **Error codes:** TS2769 ×2
- **Files:** `src/modules/invoicing/components/InvoiceWorkspace.tsx:640` [15]; `src/modules/orders/components/SortableOrdersTable.tsx:469` [43]
- **Root cause:** `React.isValidElement<P>` (`@types/react/index.d.ts:780`, 18.3.12) leaves `P` uninferred at `InvoiceWorkspace.tsx:637` / `SortableOrdersTable.tsx:466`; the `cloneElement(cell, { key, style })` then matches none of the seven overloads (`index.d.ts:562-597`) because `style` is not known to belong to `Partial<P>`. Same opacity breaks `cell.props.style` (`:641`, `:470`).
- **Probable single fix:** identical copy-pasted "apply column width to a TanStack `flexRender` cell" block in both files, against an untyped `ReactElement`.
- **Blast radius:** exactly 2 `React.cloneElement` occurrences in `src`; the blocks are duplicates.
- **Count cleared:** 2

### Cluster 10 — over-wide `[unknown, unknown]` tuple annotation on `getQueriesData` rollback (2)

- **Error codes:** TS2345 ×2
- **Files:** `src/modules/inbox/hooks/useInboxConversations.ts:158` [6], `:193` [7]
- **Root cause:** rollback handlers annotate `([key, value]: [unknown, unknown])` (`:157`, `:192`), discarding the `[QueryKey, unknown]` element type from `getQueriesData`, so `key` is `unknown` at `setQueryData(key, value)`. Sibling handlers without the annotation (`:146`, `:181`) compile.
- **Probable single fix:** a manual annotation wider than the inferred tuple breaks the next call.
- **Blast radius:** 2 lines, 1 file (`useMarkAsRead`/`useMarkAsUnread` rollbacks).
- **Count cleared:** 2

### Cluster 11 — singletons (6)

| # | File:line | Code | Root cause (evidence) |
|---|---|---|---|
| [4] | `src/modules/inbox/components/AllMessagesTimeline.tsx:87` | TS2322 | Passes `secondaryLine`, omits required `handleLine`; `ConversationHeaderProps` declares `handleLine: string` (`ConversationHeader.tsx:5`), no `secondaryLine` in `:3-26`. |
| [5] | `src/modules/inbox/components/ConversationView.tsx:209` | TS2367 | Dead comparison: `channel` (`'email' \| 'sms' \| 'whatsapp'`, `:41`) already narrowed by `channel === 'sms'` at `:196`; re-test at `:209` can never be true. |
| [8] | `src/modules/invoicing/api/invoicing.api.ts:49` | TS2352 | `INVOICES_LIST_SELECT` (`:34`) omits `organization_id` (required on `Invoice`, `invoicing.types.ts:7`) and selects `deleted_at` (absent from `Invoice`). Query targets view `invoices_with_breakdown` (`:41`; generated def `database.types.ts:4694`). |
| [30] | `src/modules/memorials/hooks/useMemorials.ts:70` (col 53) | TS2769 | `nullsLast: true` is not an `.order()` option; overloads accept `ascending`, `nullsFirst`, `referencedTable`/`foreignTable` only (`PostgrestTransformBuilder.d.ts:15-19`). Distinct from Cluster 6. |
| [41] | `src/modules/orders/components/EditOrderDrawer.tsx:1192` | TS2322 | `size="xs"` on `<Button>`; cva `size` enumerates `default \| sm \| lg \| icon` (`src/shared/components/ui/button-variants.tsx:18-23`). Sole `xs` in `src`. |
| [42] | `src/modules/orders/components/OrderDetailsSidebar.tsx:761` | TS2552 | `format` used, never imported; only `formatDateTimeDMY, formatGbpDecimal` from `@/shared/lib/formatters` (`:37`); no `date-fns` import. |

- **Count cleared:** 6

## Open questions

1. `createClient<any>` (`src/shared/lib/supabase.ts:38`) — load-bearing or provisional? Clusters 3, 6, 7 and [8] trace to it; reverting re-typechecks 80 importers.
2. `strictNullChecks: false` (`tsconfig.json:17`) — permanent? It is the mechanical cause of Cluster 5. Turning it on reshapes several clusters and adds errors outside this baseline.
3. `inbox_conversations.organization_id` nullability: migration `20260411140300` adds it nullable; generated type marks it non-null (`database.types.ts:982`, `:1005`). No later `set not null` migration found in the repo.
4. Cluster 1 intent for `EditInvoiceDrawer` (`order_id`) and `EditJobDrawer` (`customer_name`): schema wins or drawer wins? The `// Removed:` comments state the removal, not the migration path.
5. [4] `AllMessagesTimeline` header: is `secondaryLine` a new optional prop or a rename of `handleLine`? Spec under `specs/inbox-sidebar-multi-tabs/` not consulted.
6. `src/integrations/supabase/` (named in CLAUDE.md's repo layout) does not exist; types are at `src/shared/types/database.types.ts`. See F-007.
