# Research: Workers/Team Module + Job Worker Assignments

## Technical Decisions

### Database Schema Decisions

1. **Worker Role Storage**
   - **Decision:** Use CHECK constraint with enum values ('installer', 'driver', 'stonecutter', 'other')
   - **Rationale:** Simple, type-safe, easy to query. Can migrate to separate table later if needed.
   - **Alternative Considered:** Separate roles table (rejected for v1 complexity)

2. **Availability Storage**
   - **Decision:** Store as separate table with boolean columns per weekday
   - **Rationale:** Simple querying, clear structure, easy to extend
   - **Alternative Considered:** JSONB column (rejected for query complexity)

3. **Job-Worker Relationship**
   - **Decision:** Many-to-many join table with composite primary key
   - **Rationale:** Standard pattern, efficient queries, prevents duplicates
   - **Foreign Key Behavior:** 
     - `job_id` → cascade delete (clean up assignments when job deleted)
     - `worker_id` → restrict delete (prevent accidental worker deletion if assigned)

4. **Soft Delete Pattern**
   - **Decision:** Use `is_active` boolean flag, no hard delete in UI
   - **Rationale:** Preserves historical data, allows reactivation, safer than hard delete
   - **Implementation:** UI only shows soft-delete option

### API Design Decisions

1. **Worker Assignment Strategy**
   - **Decision:** Replace-all strategy (delete existing, insert new)
   - **Rationale:** Simpler than diff-based updates, ensures consistency
   - **Trade-off:** Slightly less efficient but more reliable

2. **Query Patterns**
   - **Decision:** Use Supabase PostgREST query builder with filters
   - **Rationale:** Consistent with existing app patterns, type-safe
   - **Search:** Use `ilike` for case-insensitive search on name/phone

3. **React Query Key Structure**
   - **Decision:** Follow existing pattern: `['workers']`, `['workers', id]`, `['workers', 'byJob', jobId]`
   - **Rationale:** Consistent with app, easy to invalidate related queries

### UI/UX Decisions

1. **Worker Display Format**
   - **Decision:** Use initials in colored badges/chips
   - **Rationale:** Simple, no photo storage needed, visually clear
   - **Future:** Can add photo uploads later if needed

2. **Availability Enforcement**
   - **Decision:** Informational only, show warnings but don't block assignment
   - **Rationale:** Flexibility for real-world scheduling, avoids blocking workflows
   - **UI:** Optional warning badge/icon when assigning unavailable worker

3. **Filter UI Pattern**
   - **Decision:** Multi-select dropdown similar to existing filters
   - **Rationale:** Consistent with app, familiar UX pattern

4. **Assignment UI Location**
   - **Decision:** Both CreateJobDrawer and Job details view
   - **Rationale:** Allows assignment at creation time and later updates

## Constraints & Limitations

1. **No Worker Authentication**
   - Workers are managed internally, no login/portal
   - Future: Could add worker portal for self-service availability updates

2. **No Scheduling Conflict Detection**
   - Availability is informational only
   - Future: Could add conflict detection and warnings

3. **No Company Linkage**
   - Workers are not linked to companies
   - Future: Multi-tenant support would require company_id on workers

4. **No Time Tracking**
   - Assignment tracking only, no hours/time logging
   - Future: Could add time tracking table

## Performance Considerations

1. **Indexes**
   - `idx_workers_is_active` - Fast filtering of active workers
   - `idx_workers_role` - Fast role-based filtering
   - `idx_job_workers_job_id` - Fast job → workers lookup
   - `idx_job_workers_worker_id` - Fast worker → jobs lookup

2. **Query Optimization**
   - Use `select('*, worker_availability(*)')` for eager loading
   - Filter at database level, not client-side
   - Use indexes for all foreign key lookups

3. **React Query Caching**
   - Invalidate related queries on mutations
   - Use optimistic updates where appropriate
   - Cache worker lists to reduce API calls

## Security Considerations

1. **RLS Policies**
   - All new tables have RLS enabled
   - Current pattern: Allow all authenticated users (matches existing app)
   - Future: Could add role-based restrictions

2. **Data Validation**
   - Zod schemas for form validation
   - Database constraints for data integrity
   - TypeScript types for compile-time safety

3. **Foreign Key Constraints**
   - Prevent orphaned records
   - Cascade deletes where appropriate
   - Restrict deletes to prevent data loss

## Testing Strategy

1. **Database Migrations**
   - Test on local Supabase first
   - Verify all constraints work
   - Test RLS policies

2. **API Functions**
   - Test all CRUD operations
   - Test edge cases (empty arrays, null values)
   - Test error handling

3. **UI Components**
   - Test form validation
   - Test assignment flows
   - Test filtering
   - Test empty/loading/error states

4. **Integration**
   - Test job creation with workers
   - Test job editing with workers
   - Test filtering jobs by workers
   - Verify no regressions

## Future Enhancements (Out of Scope)

1. **Worker Portal**
   - Self-service availability updates
   - View assigned jobs
   - Time tracking

2. **Advanced Scheduling**
   - Conflict detection
   - Automatic assignment suggestions
   - Calendar integration

3. **Performance Tracking**
   - Job completion rates per worker
   - Time estimates vs actual
   - Skill/role matching

4. **Multi-tenant Support**
   - Company linkage
   - Company-specific workers
   - Cross-company visibility controls

