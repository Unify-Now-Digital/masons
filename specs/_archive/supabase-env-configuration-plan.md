# Implementation Plan: Supabase Environment Configuration

**Branch:** `feature/supabase-env-configuration`  
**Specification:** `specs/supabase-env-configuration.md`

---

## Task Summary

| # | Task | Type | File | Priority | Dependencies |
|---|------|------|------|----------|--------------|
| 1 | Create .env.example template | Create | `.env.example` | High | None |
| 2 | Create .env file with current values | Create | `.env` | High | None |
| 3 | Update .gitignore | Update | `.gitignore` | High | None |
| 4 | Update supabase.ts to use env vars | Update | `src/shared/lib/supabase.ts` | High | Tasks 1-2 |
| 5 | Create connection test hook | Create | `src/shared/hooks/useSupabaseConnection.ts` | Medium | Task 4 |
| 6 | Verify CRUD hooks use shared client | Verify | All API files | High | Task 4 |
| 7 | Validate build and runtime | Verify | - | High | Tasks 1-6 |

---

## Task 1: Create .env.example Template

**File:** `.env.example`  
**Action:** CREATE

**Content:**
```env
# Supabase Configuration
# Copy this file to .env and fill in your actual values
# Get these from your Supabase project settings: https://app.supabase.com/project/_/settings/api

VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Purpose:** Template file for other developers (committed to git)

---

## Task 2: Create .env File

**File:** `.env`  
**Action:** CREATE

**Content:**
```env
VITE_SUPABASE_URL=https://nktarjmrmhnxwlmdzigk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rdGFyam1ybWhueHdsbWR6aWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4NDY1NDAsImV4cCI6MjA2MTQyMjU0MH0.mB37tAfPnQJo4-1m7JCASPOUG8720lussePiz5_NY7g
```

**Purpose:** Local environment variables (will be gitignored)

**Note:** Uses current hardcoded values from `supabase.ts` as starting point

---

## Task 3: Update .gitignore

**File:** `.gitignore`  
**Action:** UPDATE

**Add to end of file:**
```
# Environment variables
.env
.env.local
.env.*.local
```

**Before:**
```
*.sw?
```

**After:**
```
*.sw?

# Environment variables
.env
.env.local
.env.*.local
```

**Purpose:** Ensure `.env` files are never committed to version control

---

## Task 4: Update Supabase Client to Use Environment Variables

**File:** `src/shared/lib/supabase.ts`  
**Action:** UPDATE (replace entire file)

**Before:**
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database.types';

const SUPABASE_URL = "https://nktarjmrmhnxwlmdzigk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rdGFyam1ybWhueHdsbWR6aWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4NDY1NDAsImV4cCI6MjA2MTQyMjU0MH0.mB37tAfPnQJo4-1m7JCASPOUG8720lussePiz5_NY7g";

// Import the supabase client like this:
// import { supabase } from "@/shared/lib/supabase";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
```

**After:**
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database.types';

// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Development-time validation and logging
if (import.meta.env.DEV) {
  if (!supabaseUrl) {
    console.error('❌ Missing VITE_SUPABASE_URL environment variable');
    console.error('   Please create a .env file with VITE_SUPABASE_URL=your_url');
  }
  if (!supabaseKey) {
    console.error('❌ Missing VITE_SUPABASE_ANON_KEY environment variable');
    console.error('   Please create a .env file with VITE_SUPABASE_ANON_KEY=your_key');
  }
  if (supabaseUrl && supabaseKey) {
    console.log('✅ Supabase environment variables loaded');
    console.log(`   URL: ${supabaseUrl}`);
  }
}

// Fail-fast: throw error if environment variables are missing
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'Please create a .env file in the project root with:\n' +
    '  VITE_SUPABASE_URL=your_supabase_project_url\n' +
    '  VITE_SUPABASE_ANON_KEY=your_supabase_anon_key\n\n' +
    'See .env.example for a template.'
  );
}

// Create and export the Supabase client
// Import the supabase client like this:
// import { supabase } from "@/shared/lib/supabase";

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
```

**Key Changes:**
1. Replace hardcoded values with `import.meta.env.VITE_*`
2. Add development-time validation with console messages
3. Add fail-fast error if env vars missing
4. Clear error messages guide developers to fix configuration

---

## Task 5: Create Connection Test Hook (Optional)

**File:** `src/shared/hooks/useSupabaseConnection.ts`  
**Action:** CREATE

**Content:**
```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase';

/**
 * Development-only hook to test Supabase connection
 * Only runs in development mode (import.meta.env.DEV)
 * 
 * @returns Connection status and error message
 */
export function useSupabaseConnection() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only run in development mode
    if (!import.meta.env.DEV) {
      return;
    }

    const testConnection = async () => {
      try {
        // Try a simple query that doesn't require auth
        // Using a table that should exist (orders)
        const { error: queryError } = await supabase
          .from('orders')
          .select('id')
          .limit(1);
        
        // PGRST116 = no rows returned (this is OK, means table exists)
        // Any other error indicates a real problem
        if (queryError && queryError.code !== 'PGRST116') {
          throw queryError;
        }
        
        setIsConnected(true);
        setError(null);
        console.log('✅ Supabase connection test successful');
      } catch (err: any) {
        setIsConnected(false);
        const errorMessage = err.message || 'Unknown error';
        setError(errorMessage);
        console.error('❌ Supabase connection test failed:', errorMessage);
        console.error('   Full error:', err);
      }
    };

    // Run test after a short delay to allow app to initialize
    const timeoutId = setTimeout(testConnection, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  return { isConnected, error };
}
```

**Purpose:** 
- Optional development tool to verify Supabase connection
- Can be used in a dev-only component or for debugging
- Only runs in development mode

**Usage Example (optional):**
```typescript
// In a dev-only component or App.tsx (wrapped in DEV check)
if (import.meta.env.DEV) {
  const { isConnected, error } = useSupabaseConnection();
  // Log or display connection status
}
```

---

## Task 6: Verify CRUD Hooks Use Shared Client

**Action:** VERIFY (no changes needed)

**Files to Check:**
- ✅ `src/modules/orders/api/orders.api.ts`
- ✅ `src/modules/jobs/api/jobs.api.ts`
- ✅ `src/modules/invoicing/api/invoicing.api.ts`
- ✅ `src/modules/inbox/api/inbox.api.ts`
- ✅ `src/modules/reporting/api/reporting.api.ts`

**Verification Steps:**
1. Search for any `createClient` calls outside of `src/shared/lib/supabase.ts`
2. Verify all API files import from `@/shared/lib/supabase`
3. Confirm no duplicate Supabase client instances

**Expected Result:** All hooks already use shared client - no changes needed ✅

---

## Task 7: Validate Build and Runtime

**Actions:**

### 7.1 Development Mode Test
```bash
npm run dev
```

**Check:**
- [ ] Browser console shows "✅ Supabase environment variables loaded"
- [ ] No error messages about missing env vars
- [ ] App loads successfully
- [ ] Can perform a CRUD operation (e.g., fetch orders)

### 7.2 Production Build Test
```bash
npm run build
```

**Check:**
- [ ] Build succeeds without errors
- [ ] No TypeScript errors
- [ ] Environment variables are replaced at build time

### 7.3 Missing Env Vars Test
1. Temporarily rename `.env` to `.env.backup`
2. Run `npm run dev`
3. Verify:
   - [ ] Error messages appear in console
   - [ ] App fails to load with clear error message
4. Restore `.env` file

### 7.4 Connection Test Hook (if implemented)
- [ ] Hook runs in development mode
- [ ] Console shows connection status
- [ ] No errors in console

---

## Execution Order

| Step | Task | Dependencies | Can Run Parallel? |
|------|------|--------------|-------------------|
| 1 | Create .env.example | None | ✅ Yes |
| 2 | Create .env | None | ✅ Yes (with Task 1) |
| 3 | Update .gitignore | None | ✅ Yes (with Tasks 1-2) |
| 4 | Update supabase.ts | Tasks 1-2 | ❌ No (needs env files) |
| 5 | Create connection hook | Task 4 | ❌ No (needs updated supabase.ts) |
| 6 | Verify CRUD hooks | Task 4 | ❌ No (verify after update) |
| 7 | Validate build | Tasks 1-6 | ❌ No (final validation) |

**Recommended Execution:**
1. **Parallel:** Tasks 1, 2, 3 (create files and update gitignore)
2. **Sequential:** Task 4 (update supabase.ts)
3. **Sequential:** Task 5 (create hook - optional)
4. **Sequential:** Task 6 (verify hooks)
5. **Sequential:** Task 7 (final validation)

---

## Import Path Reference

All imports must use absolute paths with `@/` alias:

| Component | Import Path |
|-----------|-------------|
| Supabase client | `@/shared/lib/supabase` |
| Connection hook | `@/shared/hooks/useSupabaseConnection` |
| Database types | `@/shared/types/database.types` |

---

## Safety Checklist

- [ ] `.env` file is gitignored (never committed)
- [ ] `.env.example` is committed (template for others)
- [ ] No hardcoded credentials in source code
- [ ] All CRUD hooks use shared client (no duplication)
- [ ] Error messages are clear and helpful
- [ ] Development validation works
- [ ] Production build succeeds
- [ ] Missing env vars cause clear errors

---

## Files Summary

### New Files (3)
| File | Purpose | Git Status |
|------|---------|------------|
| `.env` | Local environment variables | ❌ Gitignored |
| `.env.example` | Template for developers | ✅ Committed |
| `src/shared/hooks/useSupabaseConnection.ts` | Dev connection test hook | ✅ Committed |

### Modified Files (2)
| File | Changes |
|------|---------|
| `src/shared/lib/supabase.ts` | Use env vars, add validation |
| `.gitignore` | Add `.env` exclusions |

### Verified Files (5 - No Changes)
| File | Status |
|------|--------|
| `src/modules/orders/api/orders.api.ts` | ✅ Uses shared client |
| `src/modules/jobs/api/jobs.api.ts` | ✅ Uses shared client |
| `src/modules/invoicing/api/invoicing.api.ts` | ✅ Uses shared client |
| `src/modules/inbox/api/inbox.api.ts` | ✅ Uses shared client |
| `src/modules/reporting/api/reporting.api.ts` | ✅ Uses shared client |

---

## Testing Checklist

After implementation, verify:

### Environment Setup
- [ ] `.env` file exists with correct values
- [ ] `.env.example` exists as template
- [ ] `.gitignore` excludes `.env` files
- [ ] `.env` is not tracked by git

### Code Changes
- [ ] `supabase.ts` uses `import.meta.env.VITE_*` variables
- [ ] Hardcoded values removed from source code
- [ ] Development validation messages appear
- [ ] Error messages are clear and helpful

### Functionality
- [ ] Development mode loads successfully
- [ ] Console shows validation messages
- [ ] CRUD operations work (test fetch orders)
- [ ] Production build succeeds
- [ ] Missing env vars cause clear errors

### Connection Test (if implemented)
- [ ] Hook runs in development mode
- [ ] Connection status logged to console
- [ ] No errors in console

---

## Rollback Plan

If issues occur:

1. **Restore hardcoded values:**
   - Revert `src/shared/lib/supabase.ts` to previous version
   - Remove `.env` file (optional)

2. **Keep improvements:**
   - Keep `.gitignore` updates
   - Keep `.env.example` template
   - Keep connection test hook (optional)

---

## Success Criteria

✅ **Implementation is successful when:**
1. All environment variables load from `.env` file
2. No hardcoded credentials in source code
3. Development console shows validation messages
4. Production build succeeds
5. All CRUD hooks continue to work
6. Missing env vars show clear error messages
7. No duplicate Supabase client instances

