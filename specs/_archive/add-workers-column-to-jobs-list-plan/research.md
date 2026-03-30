# Research: Add Workers Column to Jobs List

## Technical Decisions

### Batch Fetching Strategy

**Decision:** Use single query with join (Option A)

**Rationale:**
- More efficient than two-step fetch (Option B)
- Single round-trip to database
- Supabase handles join efficiently
- Simpler code

**Implementation:**
```typescript
const { data } = await supabase
  .from('job_workers')
  .select('job_id, workers(*)')
  .in('job_id', jobIds);
```

**Alternative Considered:** Two-step fetch (rejected - more complex, two queries)

---

### Component Architecture

**Decision:** Inline worker chips in JobsPage

**Rationale:**
- Simpler for now (no need for shared component yet)
- Matches EditJobDrawer pattern (inline)
- Can extract later if needed elsewhere
- Reduces file count

**Alternative Considered:** Extract to `JobWorkersChips` component (deferred - can do later if needed)

---

### Initials Calculation

**Decision:** Inline calculation in JobsPage

**Rationale:**
- Simple one-liner
- No need for utility function yet
- Matches EditJobDrawer pattern
- Can extract later if needed

**Formula:**
```typescript
worker.full_name
  .split(' ')
  .map(n => n[0])
  .join('')
  .toUpperCase()
  .slice(0, 2)
```

---

### Max Visible Workers

**Decision:** Show max 3 chips, "+N more" if >3

**Rationale:**
- Prevents layout issues with many workers
- Keeps table column width reasonable
- Tooltip shows all workers on hover
- Consistent with common UI patterns

**Alternative Considered:** Show all workers (rejected - could cause layout issues)

---

### Loading State

**Decision:** Show skeleton or empty until loaded

**Rationale:**
- Workers are secondary information
- Don't block table rendering
- Subtle loading indicator is sufficient
- Matches spec decision

**Alternative Considered:** Show spinner (rejected - too prominent for secondary info)

---

### Column Positioning

**Decision:** Place after "Priority" column

**Rationale:**
- Logical grouping (Priority → Workers → Duration)
- Keeps related information together
- Matches spec decision

**Alternative Considered:** End before Actions (rejected - less logical grouping)

---

## Performance Considerations

### Query Optimization

**Batch Fetching:**
- Single query for all visible jobs
- React Query caching prevents refetches
- Only fetches when jobIds change

**Cache Strategy:**
- Query key includes sorted jobIds for stable cache
- React Query handles invalidation automatically
- No manual cache management needed

**Edge Cases:**
- Empty jobIds: Return immediately, no query
- Jobs with no workers: Return empty array for that job
- Large job lists: Monitor performance, consider pagination if needed

---

### Rendering Optimization

**Memoization:**
- `jobIds` computed with `useMemo` based on `filteredJobs`
- Workers data cached by React Query
- No unnecessary re-renders

**Component Optimization:**
- Worker chips rendered inline (no extra component overhead)
- Tooltips lazy-loaded (only on hover)
- Skeleton shown during loading (prevents layout shift)

---

## Styling Consistency

### Badge Styling

**Match EditJobDrawer:**
- `variant="secondary"`
- `h-6` or `h-8` (smaller for table: `h-6`)
- `px-2` or `px-3` (smaller for table: `px-2`)
- Flex layout with gap

**Initials Avatar:**
- Circular: `rounded-full`
- Background: `bg-primary/10`
- Size: `h-4 w-4` (smaller for table)
- Text: `text-[10px]` (smaller for table)

**Differences for Table:**
- Slightly smaller chips to fit table column
- More compact spacing
- Same visual style, just scaled down

---

## Error Handling

### API Errors

**Handling:**
- React Query handles errors automatically
- Show empty state on error (graceful degradation)
- Error logged to console for debugging

**User Experience:**
- Table still renders (workers column shows empty)
- No blocking errors
- User can still interact with other columns

---

### Edge Cases

**Empty jobIds:**
- Hook disabled, no query
- Returns `undefined`, handled with `?? []`

**Jobs with no workers:**
- Returns empty array for that job
- Shows "—" placeholder

**Null workers from join:**
- Filtered out in grouping logic
- Prevents null reference errors

---

## Testing Strategy

### Unit Testing (Recommended)

```typescript
describe('fetchWorkersByJobs', () => {
  it('returns empty object for empty jobIds', async () => {
    const result = await fetchWorkersByJobs([]);
    expect(result).toEqual({});
  });

  it('groups workers by job_id', async () => {
    const result = await fetchWorkersByJobs(['job1', 'job2']);
    expect(result).toHaveProperty('job1');
    expect(result).toHaveProperty('job2');
  });

  it('handles jobs with no workers', async () => {
    const result = await fetchWorkersByJobs(['job-with-no-workers']);
    expect(result['job-with-no-workers']).toEqual([]);
  });
});
```

### Integration Testing

- Test JobsPage renders workers column
- Test batch fetch works correctly
- Test loading states
- Test empty states
- Test overflow handling ("+N more")

---

## Security Considerations

**No Security Implications:**
- Read-only operation
- No data modification
- Uses existing RLS policies
- No new permissions needed

---

## Accessibility Considerations

**Tooltips:**
- Provide full worker information on hover
- Keyboard accessible (if Tooltip component supports it)
- Screen reader friendly (worker names in badges)

**Empty States:**
- Clear indication when no workers assigned
- Not confusing or misleading

---

## Future Enhancements (Out of Scope)

**Potential Improvements:**
- Click "+N more" to show all workers in popover
- Filter jobs by clicking worker chip
- Sort by number of workers
- Show worker availability status

**Not Included:**
- Worker editing from table
- Worker assignment from table
- Advanced worker filtering

