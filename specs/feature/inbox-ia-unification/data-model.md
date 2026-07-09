# Data Model: Inbox IA Unification (Phase 1)

No database change. The "data model" of this feature is client-side view state and its persistence/compat surfaces.

## Entities

### InboxView (new)
| Field | Type | Values | Source of truth |
|---|---|---|---|
| `view` | union | `'all' \| 'triage' \| 'customers'` | URL `?view=` → localStorage `inbox.desktop.view.v2` → literal `'customers'` (D3) |
| `board` | boolean | `?board=1` present | URL only; never persisted; default off |

Owned by a new hook `src/modules/inbox/hooks/useInboxView.ts` returning `{ view, setView, board, setBoard }`. Setters write URL params with `replace: true` (same idiom as the existing `channel` param, `UnifiedInboxPage.tsx:271-283`); `setView` additionally persists to `inbox.desktop.view.v2`.

### Legacy state (replaced)
| Old | Type | Mapped to |
|---|---|---|
| `viewMode: 'conversations'` | localStorage-initialized `useState` | `view: 'all'` (default mapping) — note both `all` and `triage` are "conversations-shaped" |
| `viewMode: 'customers'` | 〃 | `view: 'customers'` |
| `segment: 'enquiries'` | URL-derived | `board: true` for gate remapping; `view: 'triage'` for incoming-link normalization (D5) |
| `segment: 'all'` | URL-derived (param absent) | no-op (param absent) |

### TriageMembership (derived, not stored)
```
triage(c) = aging(c) != null
         && (aging(c).ball.side === 'us' || aging(c).level !== 'fresh')
```
where `aging(c)` comes from the existing `bucketAndAgingByConversationId` map (already built in the page from `deriveBallInCourt` + `computeAging`, `src/modules/inbox/utils/inboxBuckets.ts`). Relationship to existing signals: `isStuck` (red-only) ⊂ triage; `stuckCount` remains the red-only count and is unchanged.

### Unchanged entities
- `inbox_conversations` rows, `ListFilter`/`CustomerListFilter` pill types, `ChannelFilter`, `?conversation=` / `?channel=` / OAuth params — all untouched.
- `enquiry_stage` — still read by `useEnquiryPipeline` (board) and written by `useUpdateEnquiryStage` (per-row action); never used for triage membership.

## State-transition rules

1. **Init order**: read `?view=` → if invalid/absent, read v2 key → if absent, migrate v1 key (`customers`→`customers`, `conversations`→`all`, write v2) → else `'customers'`.
2. **Legacy URL normalization** (one-shot mount effect, `replace: true`): per D5 table in research.md; must preserve `conversation`, `channel`, `gmail`, `error` params.
3. **View switch**: sets `?view=`, persists v2 key. Board toggle: sets/removes `?board=1`, no persistence.
4. **Gate bijection** (applies to inventory V1–V14, S1–S6 in research.md):
   - `viewMode === 'conversations'` → `view !== 'customers'`
   - `viewMode === 'customers'` → `view === 'customers'`
   - `segment === 'enquiries'` → `board`
   - Exception (deliberate widening, D7): S6 `EnquiryCreateOrderPanel` gate becomes `board || view === 'triage'`.
5. **Filtering pipeline** for the list views: existing `baseFilters` (pills, search) → channel → per-view: `view === 'triage'` additionally filters by `TriageMembership` (intersection, FR-005). `view === 'all'` applies no extra predicate.
