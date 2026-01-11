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

// DEV ONLY: expose Supabase client in browser console for debugging
if (import.meta.env.DEV) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.supabase = supabase;
}