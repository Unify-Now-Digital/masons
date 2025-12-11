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
      } catch (err: unknown) {
        setIsConnected(false);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
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

