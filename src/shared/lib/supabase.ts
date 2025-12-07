import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database.types';

const SUPABASE_URL = "https://nktarjmrmhnxwlmdzigk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rdGFyam1ybWhueHdsbWR6aWdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4NDY1NDAsImV4cCI6MjA2MTQyMjU0MH0.mB37tAfPnQJo4-1m7JCASPOUG8720lussePiz5_NY7g";

// Import the supabase client like this:
// import { supabase } from "@/shared/lib/supabase";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);