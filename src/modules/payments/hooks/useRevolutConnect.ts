import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export function useRevolutConnect() {
  return useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke<{ url: string }>(
        'revolut-oauth-start',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (error) throw new Error(error.message);
      if (!data?.url) throw new Error('No authorization URL returned');

      window.location.href = data.url;
    },
  });
}
