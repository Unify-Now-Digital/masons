# Implementation Plan: Rename Jobs Module to Map Module

**Branch:** `feature/rename-jobs-to-map`  
**Plan:** `specs/rename-jobs-to-map-plan.md`

---

## Overview

Rename the existing `jobs` module (Map of Jobs feature) to `map` to free up the `jobs` name for a future CRUD module. This is a refactoring task that involves directory renaming and import path updates only. The route URL `/dashboard/map` already exists and will remain unchanged.

---

## Current State Analysis

### Current Structure
```
src/modules/jobs/
├── api/
│   └── jobs.api.ts
├── components/
│   └── GoogleMap.tsx
├── hooks/
│   └── useJobs.ts
├── index.ts
├── pages/
│   └── JobsMapPage.tsx
└── types/
    └── jobs.types.ts
```

### Current Imports
- `src/app/router.tsx`: `import { JobsMapPage } from "@/modules/jobs";`
- Route URL: `/dashboard/map` (already correct, no change needed)
- Sidebar URL: `/dashboard/map` (already correct, no change needed)

### Internal Imports (Relative)
- All internal imports use relative paths (`../components/GoogleMap`, etc.)
- These will remain unchanged after directory rename

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Create new map directory structure | Create | `src/modules/map/` | High | None |
| 2 | Move files from jobs to map | Move | All files in `src/modules/jobs/` | High | Task 1 |
| 3 | Update router import | Update | `src/app/router.tsx` | High | Task 2 |
| 4 | Update barrel exports | Update | `src/modules/map/index.ts` | Medium | Task 2 |
| 5 | Delete old jobs directory | Delete | `src/modules/jobs/` | High | Tasks 2-4 |
| 6 | Validate build | Verify | - | High | Tasks 1-5 |
| 7 | Validate lint | Verify | - | High | Tasks 1-5 |

---

## Task 1: Create New Map Directory Structure

**Action:** CREATE directories

**Steps:**
1. Create `src/modules/map/` directory
2. Create subdirectories:
   - `src/modules/map/api/`
   - `src/modules/map/components/`
   - `src/modules/map/hooks/`
   - `src/modules/map/pages/`
   - `src/modules/map/types/`

**Validation:**
- All directories exist before proceeding

---

## Task 2: Move Files from Jobs to Map

**Action:** MOVE files (preserve content, update paths)

**File Moves:**

| Source | Destination | Notes |
|--------|-------------|-------|
| `src/modules/jobs/api/jobs.api.ts` | `src/modules/map/api/jobs.api.ts` | Keep filename (references DB table) |
| `src/modules/jobs/components/GoogleMap.tsx` | `src/modules/map/components/GoogleMap.tsx` | No changes needed |
| `src/modules/jobs/hooks/useJobs.ts` | `src/modules/map/hooks/useJobs.ts` | Keep filename (references DB table) |
| `src/modules/jobs/pages/JobsMapPage.tsx` | `src/modules/map/pages/JobsMapPage.tsx` | No changes needed |
| `src/modules/jobs/types/jobs.types.ts` | `src/modules/map/types/jobs.types.ts` | Keep filename (references DB table) |
| `src/modules/jobs/index.ts` | `src/modules/map/index.ts` | Update export paths |

**Important Notes:**
- **DO NOT** rename files that reference database tables (`jobs.api.ts`, `useJobs.ts`, `jobs.types.ts`)
- These files interact with the `jobs` database table and should keep their names
- Only the module directory name changes from `jobs` to `map`
- All relative imports within files remain unchanged (they use `../` paths)

**Validation:**
- All files moved successfully
- File contents unchanged (except index.ts exports)

---

## Task 3: Update Router Import

**File:** `src/app/router.tsx`  
**Action:** UPDATE

**Current Code:**
```typescript
import { JobsMapPage } from "@/modules/jobs";
```

**Updated Code:**
```typescript
import { JobsMapPage } from "@/modules/map";
```

**Change:**
- Line 5: Change import path from `@/modules/jobs` to `@/modules/map`
- Route path `/dashboard/map` remains unchanged (already correct)

**Validation:**
- Import resolves correctly
- Route still works at `/dashboard/map`

---

## Task 4: Update Barrel Exports

**File:** `src/modules/map/index.ts`  
**Action:** UPDATE

**Current Content:**
```typescript
export { JobsMapPage } from './pages/JobsMapPage';
export { GoogleMap } from './components/GoogleMap';
```

**Updated Content:**
```typescript
export { JobsMapPage } from './pages/JobsMapPage';
export { GoogleMap } from './components/GoogleMap';
```

**Note:** No changes needed - relative paths remain valid after directory move.

**Validation:**
- Exports work correctly
- Components accessible via `@/modules/map`

---

## Task 5: Delete Old Jobs Directory

**Action:** DELETE

**Steps:**
1. Verify all files have been moved to `src/modules/map/`
2. Verify router import updated
3. Delete `src/modules/jobs/` directory and all contents

**Safety Check:**
- Confirm no remaining references to `@/modules/jobs` in codebase
- Confirm `src/modules/jobs/` directory is empty before deletion

**Validation:**
- Old directory removed
- No broken imports remain

---

## Task 6: Validate Build

**Action:** VERIFY

**Command:**
```bash
npm run build
```

**Expected Results:**
- Build succeeds without errors
- No TypeScript errors related to missing modules
- All imports resolve correctly

**Failure Handling:**
- If build fails, check for:
  - Missing file moves
  - Incorrect import paths
  - TypeScript path alias issues

---

## Task 7: Validate Lint

**Action:** VERIFY

**Command:**
```bash
npm run lint
```

**Expected Results:**
- Lint passes without errors
- No unused import warnings
- No path-related warnings

---

## Files That Will NOT Change

### Database-Related Files (Keep Names)
- `jobs.api.ts` - References `jobs` database table
- `useJobs.ts` - References `jobs` database table  
- `jobs.types.ts` - References `jobs` database table

**Rationale:** These files interact with the Supabase `jobs` table and should maintain their names for clarity.

### Internal Relative Imports (No Changes)
- `JobsMapPage.tsx` uses `../components/GoogleMap` - remains valid
- `useJobs.ts` uses `../api/jobs.api` - remains valid
- All relative imports (`../`, `./`) remain unchanged

### Route URLs (No Changes)
- Route path: `/dashboard/map` - already correct
- Sidebar URL: `/dashboard/map` - already correct
- Page title: "Map of Jobs" - remains the same

---

## Safety Checklist

Before starting:
- [ ] Confirm `src/modules/jobs/` exists
- [ ] Confirm route `/dashboard/map` works currently
- [ ] Backup or commit current state

During execution:
- [ ] Verify each file moved successfully
- [ ] Check no files left in old directory
- [ ] Confirm router import updated

After completion:
- [ ] Build succeeds
- [ ] Lint passes
- [ ] App loads `/dashboard/map` successfully
- [ ] Map functionality works (Google Maps loads)
- [ ] No console errors

---

## Search & Replace Safety Rules

### DO Change:
- `@/modules/jobs` → `@/modules/map` (import paths)
- Directory name: `src/modules/jobs/` → `src/modules/map/`

### DO NOT Change:
- File names: `jobs.api.ts`, `useJobs.ts`, `jobs.types.ts` (reference DB table)
- Database table references: `from('jobs')` (Supabase queries)
- Route URLs: `/dashboard/map` (already correct)
- Component names: `JobsMapPage`, `GoogleMap` (UI components)
- Hook names: `useJobs`, `jobsKeys` (API-related)
- Type names: `Job`, `JobInsert`, `JobUpdate` (database types)
- Any references to future "Jobs CRUD module" (doesn't exist yet)

---

## Expected File Tree After Rename

```
src/modules/map/
├── api/
│   └── jobs.api.ts          (keeps name - references DB table)
├── components/
│   └── GoogleMap.tsx
├── hooks/
│   └── useJobs.ts            (keeps name - references DB table)
├── index.ts
├── pages/
│   └── JobsMapPage.tsx
└── types/
    └── jobs.types.ts         (keeps name - references DB table)
```

---

## Rollback Plan

If issues occur:

1. **Restore from git:**
   ```bash
   git checkout src/modules/jobs/
   git checkout src/app/router.tsx
   ```

2. **Manual rollback:**
   - Move files back from `src/modules/map/` to `src/modules/jobs/`
   - Revert router import change
   - Delete `src/modules/map/` directory

---

## Success Criteria

✅ **Implementation is successful when:**

1. **Directory Structure:**
   - `src/modules/map/` exists with all files
   - `src/modules/jobs/` no longer exists

2. **Imports:**
   - Router imports from `@/modules/map`
   - No references to `@/modules/jobs` remain

3. **Functionality:**
   - Route `/dashboard/map` loads successfully
   - Map page renders correctly
   - Google Maps integration works
   - No console errors

4. **Build & Lint:**
   - `npm run build` succeeds
   - `npm run lint` passes
   - No TypeScript errors

5. **Future Readiness:**
   - `jobs` module name is now available for future CRUD module
   - No conflicts with existing map functionality

---

## Implementation Notes

### Why Keep Some Filenames?

Files that reference the database table `jobs` should keep their names:
- `jobs.api.ts` - Makes it clear this interacts with `jobs` table
- `useJobs.ts` - Hook name matches database entity
- `jobs.types.ts` - Type definitions for `jobs` table

This maintains clarity about what database table the code interacts with, even though the module is now called `map`.

### Module Name vs Database Table

- **Module name:** `map` (UI/organizational structure)
- **Database table:** `jobs` (data persistence)
- **Route URL:** `/dashboard/map` (user-facing)

These can differ - the module name is about code organization, not database structure.

---

## Execution Order

1. **Sequential:** Tasks 1-5 must run in order
2. **Validation:** Tasks 6-7 run after all moves complete
3. **No Parallel:** Each task depends on previous completion

---

*Implementation Plan created: Rename Jobs Module to Map Module*  
*Ready for execution via `/implement` command*

