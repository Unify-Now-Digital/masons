import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { useOrganization } from '@/shared/context/OrganizationContext';

export function useRevolutConnect() {
  const { organizationId } = useOrganization();
  return useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error('No organisation selected');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke<{ url: string }>(
        'revolut-oauth-start',
        { body: { organization_id: organizationId }, headers: { Authorization: `Bearer ${token}` } },
      );
      if (error) throw new Error(error.message);
      if (!data?.url) throw new Error('No authorization URL returned');

      window.location.href = data.url;
    },
  });
}
