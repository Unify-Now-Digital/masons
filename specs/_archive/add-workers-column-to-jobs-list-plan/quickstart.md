# Quickstart: Add Workers Column to Jobs List

## Quick Implementation Steps

### Step 1: Add Batch Fetch API Function

**File:** `src/modules/workers/api/workers.api.ts`

```typescript
export async function fetchWorkersByJobs(jobIds: string[]): Promise<Record<string, Worker[]>> {
  if (jobIds.length === 0) return {};
  
  const { data, error } = await supabase
    .from('job_workers')
    .select('job_id, workers(*)')
    .in('job_id', jobIds);

  if (error) throw error;

  const workersByJob: Record<string, Worker[]> = {};
  (data || []).forEach((item: { job_id: string; workers: Worker | null }) => {
    if (item.workers) {
      if (!workersByJob[item.job_id]) {
        workersByJob[item.job_id] = [];
      }
      workersByJob[item.job_id].push(item.workers);
    }
  });

  return workersByJob;
}
```

### Step 2: Add React Query Hook

**File:** `src/modules/workers/hooks/useWorkers.ts`

```typescript
export function useWorkersByJobs(jobIds: string[]) {
  const sortedJobIds = useMemo(() => [...jobIds].sort(), [jobIds]);
  
  return useQuery({
    queryKey: ['workers', 'byJobs', sortedJobIds],
    queryFn: () => fetchWorkersByJobs(sortedJobIds),
    enabled: sortedJobIds.length > 0,
  });
}
```

**Don't forget to:**
- Import `fetchWorkersByJobs` from API
- Import `useMemo` from React
- Export the hook

### Step 3: Add Workers Column to JobsPage

**File:** `src/modules/jobs/pages/JobsPage.tsx`

**3a. Add column header:**
```typescript
<TableHead>Workers</TableHead> // After Priority, before Duration
```

**3b. Fetch workers:**
```typescript
const jobIds = useMemo(() => filteredJobs.map(j => j.id), [filteredJobs]);
const { data: workersByJobId, isLoading: isLoadingWorkers } = useWorkersByJobs(jobIds);
```

**3c. Render workers in table cell:**
```typescript
<TableCell>
  {isLoadingWorkers ? (
    <Skeleton className="h-6 w-20" />
  ) : (() => {
    const workers = workersByJobId?.[job.id] ?? [];
    if (workers.length === 0) {
      return <span className="text-muted-foreground">—</span>;
    }
    
    return (
      <div className="flex flex-wrap gap-1">
        {workers.slice(0, 3).map((worker) => {
          const initials = worker.full_name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          return (
            <Tooltip key={worker.id}>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className="h-6 px-2 text-xs">
                  <span className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px] mr-1">
                    {initials}
                  </span>
                  {worker.full_name}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {worker.full_name} ({worker.role})
              </TooltipContent>
            </Tooltip>
          );
        })}
        {workers.length > 3 && (
          <Badge variant="outline" className="h-6 px-2 text-xs">
            +{workers.length - 3} more
          </Badge>
        )}
      </div>
    );
  })()}
</TableCell>
```

**Don't forget to:**
- Import `useWorkersByJobs` from workers hooks
- Import `Tooltip`, `TooltipTrigger`, `TooltipContent` from shadcn/ui
- Import `useMemo` if not already imported

### Step 4: Test

1. Navigate to Jobs page
2. Verify "Workers" column appears
3. Verify workers display as chips with initials
4. Verify "+N more" appears for jobs with >3 workers
5. Verify "—" appears for jobs with no workers
6. Check browser DevTools Network tab - should see ONE batch query

## Expected Result

- Jobs table shows "Workers" column
- Each job row displays assigned workers as chips
- Chips show initials, name, and role on hover
- Jobs with no workers show "—"
- Jobs with >3 workers show first 3 + "+N more"
- Single batch query (no N+1)

## Troubleshooting

**Workers not showing:**
- Check `workersByJobId` has data
- Check `job.id` matches keys in mapping
- Check browser console for errors

**Multiple queries:**
- Verify `jobIds` is memoized
- Check React Query cache key is stable
- Ensure hook is not called multiple times

**Styling issues:**
- Verify Badge component imported
- Check Tooltip component imported
- Verify Tailwind classes are correct

