import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useOrganization } from "@/shared/context/OrganizationContext";

export const customerFlagKeys = {
  all: ["customer-flag-by-person"] as const,
  list: (organizationId: string) => ["customer-flag-by-person", "list", organizationId] as const,
};

async function fetchCustomerFlags(organizationId: string): Promise<Map<string, boolean>> {
  const { data, error } = await supabase
    .from("people")
    .select("id, is_customer, is_customer_override")
    .eq("organization_id", organizationId);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, p.is_customer || p.is_customer_override === true]));
}

export function useCustomerFlagByPersonId() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? customerFlagKeys.list(organizationId)
      : ["customer-flag-by-person", "list", "disabled"],
    queryFn: () => fetchCustomerFlags(organizationId!),
    enabled: !!organizationId,
  });
}
