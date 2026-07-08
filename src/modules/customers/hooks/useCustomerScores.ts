import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { useOrganization } from "@/shared/context/OrganizationContext";

export interface CustomerScore {
  id: string;
  first_name: string;
  last_name: string;
  order_count: number;
  total_value: number;
  score: number;
  band: "Priority" | "Established" | "Standard";
  breakdown: Record<string, number>;
}

export const customerScoresKeys = {
  all: ["customer-scores"] as const,
  list: (organizationId: string) => ["customer-scores", "list", organizationId] as const,
};

async function fetchCustomerScores(organizationId: string) {
  const { data, error } = await supabase
    .from("customer_scores")
    .select("id, first_name, last_name, order_count, total_value, score, band, breakdown")
    .eq("organization_id", organizationId);
  if (error) throw error;
  return data as CustomerScore[];
}

export function useCustomerScores() {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: organizationId
      ? customerScoresKeys.list(organizationId)
      : ["customer-scores", "list", "disabled"],
    queryFn: () => fetchCustomerScores(organizationId!),
    enabled: !!organizationId,
  });
}