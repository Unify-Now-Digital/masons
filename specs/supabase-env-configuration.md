# Supabase Environment Configuration

## Overview

Connect the project to a real Supabase backend by:
1. Adding environment variable configuration via `.env` file
2. Updating the Supabase client to use environment variables
3. Adding development-time validation and connection testing
4. Ensuring all CRUD hooks use the shared Supabase client

---

## Current State Analysis

### Supabase Client (`src/shared/lib/supabase.ts`)
- **Status**: Currently uses hardcoded values
- **URL**: `https://nktarjmrmhnxwlmdzigk.supabase.co`
- **Key**: Hardcoded anon key in source code
- **Issue**: Credentials are committed to version control

### CRUD Hooks Status
All modules already use the shared Supabase client:
- ✅ `src/modules/orders/api/orders.api.ts` - Uses `@/shared/lib/supabase`
- ✅ `src/modules/jobs/api/jobs.api.ts` - Uses `@/shared/lib/supabase`
- ✅ `src/modules/invoicing/api/invoicing.api.ts` - Uses `@/shared/lib/supabase`
- ✅ `src/modules/inbox/api/inbox.api.ts` - Uses `@/shared/lib/supabase`
- ✅ `src/modules/reporting/api/reporting.api.ts` - Uses `@/shared/lib/supabase`

**No changes needed to CRUD hooks** - they already use the shared client correctly.

### Environment Files
- **Status**: No `.env` file exists
- **`.gitignore`**: Does not explicitly exclude `.env` files (should add)

### Vite Configuration
- **Status**: Standard Vite config - automatically loads `.env` files
- **Environment Variables**: Vite exposes env vars via `import.meta.env.VITE_*`

---

## Target State

### Environment Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJhbGci...` |

### Files to Create
1. `.env` - Local environment variables (gitignored)
2. `.env.example` - Template for other developers

### Files to Modify
1. `src/shared/lib/supabase.ts` - Use environment variables
2. `.gitignore` - Add `.env` exclusion

---

## Implementation Details

### 1. Environment File Structure

**`.env`** (create, gitignored):
```env
VITE_SUPABASE_URL=https://nktarjmrmhnxwlmdzigk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rdGFyam1ybWhueHdsbWR6aWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4NDY1NDAsImV4cCI6MjA2MTQyMjU0MH0.mB37tAfPnQJo4-1m7JCASPOUG8720lussePiz5_NY7g
```

**`.env.example`** (create, committed):
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Supabase Client Update

**`src/shared/lib/supabase.ts`** changes:

**Before:**
```typescript
const SUPABASE_URL = "https://nktarjmrmhnxwlmdzigk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGci...";
```

**After:**
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Development-time validation
if (import.meta.env.DEV) {
  if (!supabaseUrl) {
    console.error('❌ Missing VITE_SUPABASE_URL environment variable');
  }
  if (!supabaseKey) {
    console.error('❌ Missing VITE_SUPABASE_ANON_KEY environment variable');
  }
  if (supabaseUrl && supabaseKey) {
    console.log('✅ Supabase environment variables loaded');
  }
}

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
```

### 3. Connection Test Hook (Optional)

**`src/shared/hooks/useSupabaseConnection.ts`** (create):

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/shared/lib/supabase';

export function useSupabaseConnection() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV) {
      // Simple connection test - just check if we can access the client
      const testConnection = async () => {
        try {
          // Try a simple query that doesn't require auth
          const { error } = await supabase.from('orders').select('id').limit(1);
          
          if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned (OK)
            throw error;
          }
          
          setIsConnected(true);
          console.log('✅ Supabase connection successful');
        } catch (err: any) {
          setIsConnected(false);
          setError(err.message);
          console.error('❌ Supabase connection failed:', err);
        }
      };

      testConnection();
    }
  }, []);

  return { isConnected, error };
}
```

**Note**: This hook is optional and only runs in development mode. It can be added to a dev-only component or used for debugging.

### 4. Gitignore Update

**`.gitignore`** - Add to file:
```
# Environment variables
.env
.env.local
.env.*.local
```

---

## Validation Checklist

After implementation, verify:

- [ ] `.env` file exists with correct variables
- [ ] `.env.example` file exists as template
- [ ] `.gitignore` excludes `.env` files
- [ ] `supabase.ts` uses `import.meta.env.VITE_*` variables
- [ ] Development console shows validation messages
- [ ] Production build works with environment variables
- [ ] All CRUD hooks continue to work (no changes needed)
- [ ] Error messages appear if env vars are missing

---

## Testing Steps

1. **Development Mode:**
   ```bash
   npm run dev
   ```
   - Check browser console for validation messages
   - Verify Supabase connection works
   - Test a CRUD operation (e.g., fetch orders)

2. **Production Build:**
   ```bash
   npm run build
   ```
   - Verify build succeeds
   - Check that env vars are replaced at build time

3. **Missing Env Vars Test:**
   - Temporarily rename `.env` to `.env.backup`
   - Run `npm run dev`
   - Verify error messages appear
   - Restore `.env` file

---

## Security Considerations

1. **Never commit `.env` files** - Already handled by `.gitignore`
2. **Use `.env.example`** - Template file without real credentials
3. **Anon Key is Public** - Safe to expose in frontend (RLS protects data)
4. **Service Role Key** - Never use in frontend (only in backend/Edge Functions)

---

## Migration Notes

### Current Hardcoded Values
The current hardcoded values in `supabase.ts` should be:
1. Moved to `.env` file
2. Removed from source code
3. Documented in `.env.example`

### Backward Compatibility
- If env vars are missing, the app will throw an error (fail-fast approach)
- This ensures developers notice missing configuration immediately

---

## Files Summary

### New Files (3)
| File | Purpose |
|------|---------|
| `.env` | Local environment variables (gitignored) |
| `.env.example` | Template for environment variables |
| `src/shared/hooks/useSupabaseConnection.ts` | Optional dev connection test hook |

### Modified Files (2)
| File | Changes |
|------|---------|
| `src/shared/lib/supabase.ts` | Use env vars, add dev validation |
| `.gitignore` | Add `.env` exclusions |

### No Changes Needed
- All CRUD hooks already use shared client ✅
- Vite config already supports env vars ✅

---

## Out of Scope

The following are explicitly NOT included:

- Database migrations (already exist)
- RLS policy updates
- Authentication setup
- Service role key configuration
- Production deployment configuration
- CI/CD environment variable setup

---

## Implementation Notes

1. **Vite Environment Variables:**
   - Must be prefixed with `VITE_` to be exposed to client code
   - Available via `import.meta.env.VITE_*`
   - Loaded at build time (not runtime)

2. **Development vs Production:**
   - Validation messages only show in development (`import.meta.env.DEV`)
   - Production builds will fail if env vars are missing (fail-fast)

3. **Connection Test Hook:**
   - Optional - can be removed if not needed
   - Only runs in development mode
   - Uses a simple query to test connection

4. **Error Handling:**
   - Fail-fast approach: throw error if env vars missing
   - Clear error messages guide developers to fix configuration

